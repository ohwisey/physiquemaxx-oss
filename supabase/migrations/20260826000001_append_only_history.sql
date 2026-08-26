-- PhysiqueMaxx — append-only check-in history (additive, guarded, idempotent;
-- never edits the already-applied 20260824000001 / 20260824000004 /
-- 20260825000001 objects). Applied by the orchestrator after review.
--
-- The bug this fixes: `unique (user_id, local_date)` + a "one check-in per user
-- per local date, extra angles UPDATE that row" save path collapsed every
-- distinct capture session on a day onto a single row — overwriting a prior
-- session's photos and stacking unrelated analyses on one check-in. Worse, a
-- capture OF the pair partner was stored under the capturer's identity and
-- analysed against the capturer's profile.
--
-- The fix, at the schema level:
--   1. subject_user_id — WHO the photos depict (may differ from the creator).
--   2. submission_id — a per-capture-session client UUID; the idempotency key
--      that makes each session its OWN check-in and lets a retry resume the
--      same row instead of forging a new one.
--   3. Drop the per-day unique so a day can hold many check-ins.
--   4. Freeze creator / subject / pair / submission after insert (immutable
--      provenance; weight, attestation, archive flag stay mutable).
--   5. Subject- and pair-scoped history indexes for the append-only ordering
--      (local_date desc, created_at desc, id desc).
--   6. RLS: creator inserts for self OR an active pair subject; reads for the
--      subject, the creator, or an active pair member of the subject.

-- ------------------------------------------------- subject + submission cols

alter table public.physiquemaxx_checkins
  add column if not exists subject_user_id uuid references public.physiquemaxx_profiles (id),
  add column if not exists submission_id uuid;

-- Backfill BEFORE the freeze trigger exists (the trigger would otherwise reject
-- these very writes). Pre-existing rows depict their own creator; each row's id
-- is a deterministic, already-unique seed for its submission_id.
update public.physiquemaxx_checkins
   set subject_user_id = user_id
 where subject_user_id is null;

update public.physiquemaxx_checkins
   set submission_id = id
 where submission_id is null;

-- Safe fallbacks for any client insert that omits them (RLS still gates who may
-- be named as subject; the app always sends both explicitly).
alter table public.physiquemaxx_checkins
  alter column subject_user_id set default auth.uid();
alter table public.physiquemaxx_checkins
  alter column submission_id set default gen_random_uuid();

alter table public.physiquemaxx_checkins
  alter column subject_user_id set not null;
alter table public.physiquemaxx_checkins
  alter column submission_id set not null;

comment on column public.physiquemaxx_checkins.subject_user_id is
  'Profile depicted by this check-in''s photos. Equals user_id for a self-capture; the partner''s id when the creator captured them. Analysis context (profile, weight, age, history) resolves from THIS id, never the capturer. Immutable after insert.';
comment on column public.physiquemaxx_checkins.submission_id is
  'Client-generated per-capture-session UUID, frozen at capture start. The save idempotency key: a new session is a new check-in; a retry with the same id resumes the same row. Immutable after insert.';

-- One check-in per submission; a retry maps to the same row instead of forging
-- a duplicate. Guarded add (Postgres has no ADD CONSTRAINT IF NOT EXISTS).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'physiquemaxx_checkins_submission_id_key'
      and conrelid = 'public.physiquemaxx_checkins'::regclass
  ) then
    alter table public.physiquemaxx_checkins
      add constraint physiquemaxx_checkins_submission_id_key unique (submission_id);
  end if;
end
$$;

-- Drop the per-day unique: a day may now hold many distinct check-ins. Do NOT
-- add any replacement per-day/per-subject-per-day unique.
alter table public.physiquemaxx_checkins
  drop constraint if exists physiquemaxx_checkins_user_id_local_date_key;

-- ------------------------------------------------- immutable provenance cols

-- Creator, subject, pair and submission are frozen the moment a check-in is
-- inserted; weight_kg, archive_only, comparison_attested_at and the
-- trigger-maintained capture_kind stay mutable. SECURITY INVOKER is fine — this
-- only inspects NEW vs OLD and raises; it touches no other table.
create or replace function public.physiquemaxx_checkins_freeze()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'physiquemaxx_checkins.user_id is immutable';
  end if;
  if new.subject_user_id is distinct from old.subject_user_id then
    raise exception 'physiquemaxx_checkins.subject_user_id is immutable';
  end if;
  if new.pair_id is distinct from old.pair_id then
    raise exception 'physiquemaxx_checkins.pair_id is immutable';
  end if;
  if new.submission_id is distinct from old.submission_id then
    raise exception 'physiquemaxx_checkins.submission_id is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists physiquemaxx_checkins_freeze_cols on public.physiquemaxx_checkins;
create trigger physiquemaxx_checkins_freeze_cols
  before update on public.physiquemaxx_checkins
  for each row execute function public.physiquemaxx_checkins_freeze();

-- ---------------------------------------------------- append-only history idx

-- Individual scope (subject) and the US timeline (pair) page newest-first with a
-- total, stable order that never merges same-day rows.
create index if not exists physiquemaxx_checkins_subject_hist_idx
  on public.physiquemaxx_checkins (subject_user_id, local_date desc, created_at desc, id desc);

create index if not exists physiquemaxx_checkins_pair_hist_idx
  on public.physiquemaxx_checkins (pair_id, local_date desc, created_at desc, id desc)
  where pair_id is not null;

-- ------------------------------------------------------------------- RLS

-- Replace ONLY the check-in SELECT + INSERT policies. UPDATE and DELETE stay
-- exactly as they were (creator-only) — a partner never edits or deletes a
-- shared check-in. Photos, analyses and storage policies are unchanged: they
-- key on the parent check-in's user_id / pair_id, which the app still sets.

-- SELECT: the subject, the creator, or an active pair member of the subject.
drop policy if exists "physiquemaxx_checkins_select" on public.physiquemaxx_checkins;
create policy "physiquemaxx_checkins_select" on public.physiquemaxx_checkins
  for select to authenticated
  using (
    subject_user_id = (select auth.uid())
    or user_id = (select auth.uid())
    or public.physiquemaxx_is_pair_member((select auth.uid()), subject_user_id)
  );

-- INSERT: the caller is the creator, AND depicts either themselves or an active
-- pair partner. The pair_id-validity clause is retained (defence in depth — a
-- creator can never forge a foreign pair_id, on which photo/analysis reads key).
drop policy if exists "physiquemaxx_checkins_insert" on public.physiquemaxx_checkins;
create policy "physiquemaxx_checkins_insert" on public.physiquemaxx_checkins
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      subject_user_id = (select auth.uid())
      or public.physiquemaxx_is_pair_member((select auth.uid()), subject_user_id)
    )
    and (
      pair_id is null
      or public.physiquemaxx_is_member_of_pair(pair_id, (select auth.uid()))
    )
  );

-- ----------------------------------------------------------------- grants

-- Extend the column-level insert grant so the browser may name the subject and
-- its own frozen submission id. Neither is in the UPDATE grant: both immutable.
grant insert (subject_user_id, submission_id)
  on table public.physiquemaxx_checkins to authenticated;
