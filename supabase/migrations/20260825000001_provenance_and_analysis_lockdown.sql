-- PhysiqueMaxx — provenance + analysis lockdown (additive; never edits the
-- already-applied 20260824000001/20260824000004 objects).
--
--   1. Photo/check-in provenance: photos declare source_kind, check-ins carry
--      a server-maintained capture_kind (trigger — a partial browser update
--      can never leave a false label), archive_only, comparison_attested_at.
--   2. Column-level write lockdown so browsers cannot set capture_kind.
--   3. physiquemaxx_analyses becomes service-role-write-only (owner/pair
--      SELECT stays); the server /api/analyze path is the only writer.
--   4. Storage: versioned object keys {user_id}/{checkin_id}/{view}.v{N}.{ext}
--      allowed alongside the original pattern, so photo replacement can
--      upload-new → repoint row → delete-old instead of overwriting in place.
--   5. Conservative backfill: existing rows default to live_capture; check-ins
--      whose latest COMPLETE four-view analysis still matches every current
--      photo hash under the current major rubric get a migration attestation.

-- ------------------------------------------------------ provenance columns

alter table public.physiquemaxx_photos
  add column if not exists source_kind text not null default 'live_capture';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'physiquemaxx_photos_source_kind_check'
      and conrelid = 'public.physiquemaxx_photos'::regclass
  ) then
    alter table public.physiquemaxx_photos
      add constraint physiquemaxx_photos_source_kind_check
      check (source_kind in ('live_capture', 'historical_import'));
  end if;
end
$$;

comment on column public.physiquemaxx_photos.source_kind is
  'Provenance of this photo: live_capture (taken for this check-in) or historical_import (added later from an archive).';

alter table public.physiquemaxx_checkins
  add column if not exists capture_kind text not null default 'live_capture',
  add column if not exists archive_only boolean not null default false,
  add column if not exists comparison_attested_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'physiquemaxx_checkins_capture_kind_check'
      and conrelid = 'public.physiquemaxx_checkins'::regclass
  ) then
    alter table public.physiquemaxx_checkins
      add constraint physiquemaxx_checkins_capture_kind_check
      check (capture_kind in ('live_capture', 'historical_import', 'mixed'));
  end if;
end
$$;

comment on column public.physiquemaxx_checkins.capture_kind is
  'Server-maintained rollup of the photos'' source_kind values (trigger physiquemaxx_photos_capture_kind). Never written by clients.';
comment on column public.physiquemaxx_checkins.archive_only is
  'Historical archive-only check-in: stored for the timeline, excluded from scores, deltas and momentum.';
comment on column public.physiquemaxx_checkins.comparison_attested_at is
  'When the owner attested this check-in''s photos are standardized enough for score comparison. Null → never part of a delta.';

-- ------------------------------------- capture_kind maintenance (trigger)

-- Recompute one check-in's capture_kind from its photos. SECURITY DEFINER so
-- the AFTER trigger can write the parent row regardless of the caller's
-- column-level privileges; search_path pinned; all references qualified.
create or replace function public.physiquemaxx_sync_capture_kind_for(p_checkin uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kinds text[];
  v_kind text;
begin
  if p_checkin is null then
    return;
  end if;
  select array_agg(distinct p.source_kind)
    into v_kinds
    from public.physiquemaxx_photos p
   where p.checkin_id = p_checkin;
  if v_kinds is null or array_length(v_kinds, 1) is null then
    -- No photos (all deleted): fall back to the neutral default.
    v_kind := 'live_capture';
  elsif array_length(v_kinds, 1) = 1 then
    v_kind := v_kinds[1];
  else
    v_kind := 'mixed';
  end if;
  update public.physiquemaxx_checkins c
     set capture_kind = v_kind
   where c.id = p_checkin
     and c.capture_kind is distinct from v_kind;
end;
$$;

revoke all on function public.physiquemaxx_sync_capture_kind_for(uuid)
  from public, anon, authenticated;

create or replace function public.physiquemaxx_photos_capture_kind_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.physiquemaxx_sync_capture_kind_for(new.checkin_id);
  end if;
  if tg_op = 'DELETE'
     or (tg_op = 'UPDATE' and old.checkin_id is distinct from new.checkin_id) then
    perform public.physiquemaxx_sync_capture_kind_for(old.checkin_id);
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.physiquemaxx_photos_capture_kind_sync()
  from public, anon, authenticated;

drop trigger if exists physiquemaxx_photos_capture_kind on public.physiquemaxx_photos;
create trigger physiquemaxx_photos_capture_kind
  after insert or update or delete on public.physiquemaxx_photos
  for each row execute function public.physiquemaxx_photos_capture_kind_sync();

-- --------------------------- check-in column-level write lockdown (client)

-- capture_kind is trigger-maintained truth: browsers may never write it.
-- Postgres column privileges are additive to table privileges, so the table
-- grant is replaced with explicit column lists (created_at/updated_at keep
-- their defaults/trigger; capture_kind keeps its default + trigger).
revoke insert, update on table public.physiquemaxx_checkins from authenticated;
grant insert (id, user_id, pair_id, local_date, weight_kg, archive_only, comparison_attested_at)
  on table public.physiquemaxx_checkins to authenticated;
grant update (pair_id, weight_kg, archive_only, comparison_attested_at)
  on table public.physiquemaxx_checkins to authenticated;

-- ---------------------------------- analyses: service-role writes only

-- The secure /api/analyze route (service client, server-only) is the single
-- analysis writer: it alone can produce verbatim stage-1 raw_evidence and
-- true version/hash tuples. Owner/pair SELECT policy stays untouched.
drop policy if exists "physiquemaxx_analyses_insert" on public.physiquemaxx_analyses;
drop policy if exists "physiquemaxx_analyses_update" on public.physiquemaxx_analyses;
drop policy if exists "physiquemaxx_analyses_delete" on public.physiquemaxx_analyses;
revoke insert, update, delete on table public.physiquemaxx_analyses from authenticated;

-- ----------------------------------------- storage: versioned object keys

-- Replacement uploads write a NEW key {user_id}/{checkin_id}/{view}.v{N}.{ext}
-- first, repoint the photo row, then delete exactly the old object — never an
-- in-place overwrite. Owner-scoped exactly like the original insert policy
-- (same folder pinning + owned-check-in requirement). The existing select
-- policy (owner + active pair member) and delete policy (own folder) match on
-- folder segments only, so they already cover versioned names. Deliberately
-- no UPDATE policy for versioned keys: versioned objects are immutable.
drop policy if exists "physiquemaxx_photos_object_insert_versioned" on storage.objects;
create policy "physiquemaxx_photos_object_insert_versioned" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'physiquemaxx-photos'
    and name ~ '^[^/]+/[^/]+/(front|back|left|right)\.v[0-9]{1,6}\.[A-Za-z0-9]+$'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.physiquemaxx_checkins c
      where c.id = public.physiquemaxx_uuid_or_null((storage.foldername(name))[2])
        and c.user_id = (select auth.uid())
    )
  );

-- ------------------------------------------------------------- backfill

-- Existing photos/check-ins predate the historical-import flow, so the
-- live_capture column defaults above are the correct backfill. Attestation is
-- conservative: only check-ins whose LATEST analysis is complete, covers all
-- four views, matches every current photo hash exactly, and was produced
-- under the current major rubric ('1' — RUBRIC_VERSION 1.1.0 at migration
-- time) receive the migration attestation. Everything else stays null and is
-- simply never comparable until attested through the app.
with latest as (
  select distinct on (a.checkin_id)
         a.checkin_id, a.status, a.image_hashes, a.rubric_version
    from public.physiquemaxx_analyses a
   order by a.checkin_id, a.created_at desc
),
attestable as (
  select c.id
    from public.physiquemaxx_checkins c
    join latest a on a.checkin_id = c.id
   where c.comparison_attested_at is null
     and a.status = 'complete'
     and split_part(a.rubric_version, '.', 1) = '1'
     and (select count(*) from jsonb_object_keys(a.image_hashes)) = 4
     and (select count(*)
            from public.physiquemaxx_photos p
           where p.checkin_id = c.id) = 4
     and not exists (
       select 1
         from public.physiquemaxx_photos p
        where p.checkin_id = c.id
          and (a.image_hashes ->> p.view) is distinct from p.sha256
     )
)
update public.physiquemaxx_checkins c
   set comparison_attested_at = now()
  from attestable t
 where c.id = t.id;
