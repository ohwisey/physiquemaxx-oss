-- PhysiqueMaxx — additive schema on the shared your-supabase-project Supabase project
-- (ref your-project-ref). Contract (your security setup):
--   * ONLY physiquemaxx_-prefixed objects + the private physiquemaxx-photos
--     bucket. Zero references to any pre-existing table; never alters
--     existing objects.
--   * RLS on every table: owner-only insert/update/delete, pair-member reads
--     via ACTIVE pair membership, nothing for outsiders or anon.
--   * No hard-coded user IDs anywhere; identity is auth.uid() + membership
--     rows. Pairing is seeded manually via physiquemaxx_seed_pair (service
--     role only).

-- ------------------------------------------------------------------ tables

create table public.physiquemaxx_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  handle text not null unique check (handle ~ '^[a-z0-9_]{2,32}$'),
  -- Optional condition-guidance facts; all null until the user fills them in.
  birthdate date,
  height_cm int,
  gender text check (gender in ('male', 'female')),
  created_at timestamptz not null default now()
);

comment on table public.physiquemaxx_profiles is
  'PhysiqueMaxx (app-scoped, 1:1 with auth.users). Do not reuse from other apps on this project.';

create table public.physiquemaxx_pairs (
  id uuid primary key default gen_random_uuid(),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.physiquemaxx_pairs is
  'PhysiqueMaxx two-person pair. Membership writes happen via service-role seeding only.';

create table public.physiquemaxx_pair_members (
  pair_id uuid not null references public.physiquemaxx_pairs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (pair_id, user_id)
);

create index physiquemaxx_pair_members_user_idx
  on public.physiquemaxx_pair_members (user_id);

create table public.physiquemaxx_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Optional pair: set → readable by active pair members; null → owner-only.
  pair_id uuid references public.physiquemaxx_pairs (id) on delete set null,
  -- Owner's local calendar date at capture. One check-in per user per local
  -- date; additional angles UPDATE this row's photos, never a second row.
  local_date date not null,
  -- Optional same-day body weight, logged with the check-in.
  weight_kg numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);

-- US merged timeline: both members' shared check-ins, newest first.
create index physiquemaxx_checkins_pair_idx
  on public.physiquemaxx_checkins (pair_id, local_date desc)
  where pair_id is not null;

create table public.physiquemaxx_photos (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.physiquemaxx_checkins (id) on delete cascade,
  view text not null check (view in ('front', 'back', 'left', 'right')),
  -- Exact object key in physiquemaxx-photos: {user_id}/{checkin_id}/{view}.{ext}
  storage_path text not null unique,
  -- Input image hash, persisted for analysis versioning.
  sha256 text not null,
  width integer,
  height integer,
  -- Precomputed ambient palette for the deck background ({top, mid, bottom}).
  palette jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One photo per angle; re-capturing an angle updates the same row.
  unique (checkin_id, view)
);

create table public.physiquemaxx_analyses (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.physiquemaxx_checkins (id) on delete cascade,
  status text not null check (status in ('complete', 'limited', 'failed')),
  -- Final deterministic score; present exactly when the four-view set passed.
  overall smallint check (overall between 0 and 100),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  -- view → sha256 of the exact input images this analysis saw.
  image_hashes jsonb not null,
  model text not null,
  prompt_version text not null,
  rubric_version text not null,
  scoring_version text not null,
  target_profile_version text not null,
  exercise_library_version text not null,
  schema_version text not null,
  -- Raw structured vision evidence (stage 1), kept verbatim.
  raw_evidence jsonb not null,
  -- Full AnalysisResult (src/lib/analysis/types.ts) after deterministic scoring.
  result jsonb not null,
  created_at timestamptz not null default now(),
  check ((status = 'complete') = (overall is not null))
);

-- Append-only history per check-in; latest row wins in the UI. Never compare
-- rows across incompatible major rubric versions.
create index physiquemaxx_analyses_checkin_idx
  on public.physiquemaxx_analyses (checkin_id, created_at desc);

-- --------------------------------------------------------- helper functions

-- SECURITY DEFINER so RLS policies can consult membership without recursing
-- into pair_members' own policies. search_path pinned; all refs qualified.

-- Do users a and b share an ACTIVE pair (both memberships active)?
create function public.physiquemaxx_is_pair_member(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.physiquemaxx_pair_members ma
    join public.physiquemaxx_pair_members mb on mb.pair_id = ma.pair_id
    join public.physiquemaxx_pairs p on p.id = ma.pair_id
    where ma.user_id = a and ma.active
      and mb.user_id = b and mb.active
      and p.active
      and a <> b
  );
$$;

-- Is p_user an ACTIVE member of the ACTIVE pair p_pair?
create function public.physiquemaxx_is_member_of_pair(p_pair uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.physiquemaxx_pair_members m
    join public.physiquemaxx_pairs p on p.id = m.pair_id
    where m.pair_id = p_pair
      and m.user_id = p_user
      and m.active
      and p.active
  );
$$;

-- Safe cast for storage-path segments; never raises on malformed input.
-- Runs as the caller (no table access), but search_path is pinned anyway
-- because storage RLS policies invoke it.
create function public.physiquemaxx_uuid_or_null(t text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;

revoke all on function public.physiquemaxx_is_pair_member(uuid, uuid) from public, anon;
revoke all on function public.physiquemaxx_is_member_of_pair(uuid, uuid) from public, anon;
revoke all on function public.physiquemaxx_uuid_or_null(text) from public, anon;
grant execute on function public.physiquemaxx_is_pair_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.physiquemaxx_is_member_of_pair(uuid, uuid) to authenticated, service_role;
grant execute on function public.physiquemaxx_uuid_or_null(text) to authenticated, service_role;

create function public.physiquemaxx_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger physiquemaxx_checkins_touch
  before update on public.physiquemaxx_checkins
  for each row execute function public.physiquemaxx_set_updated_at();

create trigger physiquemaxx_photos_touch
  before update on public.physiquemaxx_photos
  for each row execute function public.physiquemaxx_set_updated_at();

-- ------------------------------------------------------------------- RLS

alter table public.physiquemaxx_profiles enable row level security;
alter table public.physiquemaxx_pairs enable row level security;
alter table public.physiquemaxx_pair_members enable row level security;
alter table public.physiquemaxx_checkins enable row level security;
alter table public.physiquemaxx_photos enable row level security;
alter table public.physiquemaxx_analyses enable row level security;

-- profiles: own row + active pair partner; writes own row only.
create policy "physiquemaxx_profiles_select" on public.physiquemaxx_profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.physiquemaxx_is_pair_member(id, (select auth.uid())));

create policy "physiquemaxx_profiles_insert" on public.physiquemaxx_profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy "physiquemaxx_profiles_update" on public.physiquemaxx_profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "physiquemaxx_profiles_delete" on public.physiquemaxx_profiles
  for delete to authenticated
  using (id = (select auth.uid()));

-- pairs / pair_members: members read their own pair; no client writes at all
-- (seeding runs under the service role, which bypasses RLS).
create policy "physiquemaxx_pairs_select" on public.physiquemaxx_pairs
  for select to authenticated
  using (public.physiquemaxx_is_member_of_pair(id, (select auth.uid())));

create policy "physiquemaxx_pair_members_select" on public.physiquemaxx_pair_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.physiquemaxx_is_member_of_pair(pair_id, (select auth.uid()))
  );

-- checkins: owner full access; active pair members read shared rows only.
-- A check-in may only be attached to a pair its owner actively belongs to.
create policy "physiquemaxx_checkins_select" on public.physiquemaxx_checkins
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (pair_id is not null
        and public.physiquemaxx_is_member_of_pair(pair_id, (select auth.uid())))
  );

create policy "physiquemaxx_checkins_insert" on public.physiquemaxx_checkins
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (pair_id is null
         or public.physiquemaxx_is_member_of_pair(pair_id, (select auth.uid())))
  );

create policy "physiquemaxx_checkins_update" on public.physiquemaxx_checkins
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (pair_id is null
         or public.physiquemaxx_is_member_of_pair(pair_id, (select auth.uid())))
  );

create policy "physiquemaxx_checkins_delete" on public.physiquemaxx_checkins
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- photos + analyses inherit access from the parent check-in.
create policy "physiquemaxx_photos_select" on public.physiquemaxx_photos
  for select to authenticated
  using (
    exists (
      select 1 from public.physiquemaxx_checkins c
      where c.id = checkin_id
        and (c.user_id = (select auth.uid())
             or (c.pair_id is not null
                 and public.physiquemaxx_is_member_of_pair(c.pair_id, (select auth.uid()))))
    )
  );

create policy "physiquemaxx_photos_insert" on public.physiquemaxx_photos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.physiquemaxx_checkins c
      where c.id = checkin_id and c.user_id = (select auth.uid())
    )
  );

create policy "physiquemaxx_photos_update" on public.physiquemaxx_photos
  for update to authenticated
  using (
    exists (
      select 1 from public.physiquemaxx_checkins c
      where c.id = checkin_id and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.physiquemaxx_checkins c
      where c.id = checkin_id and c.user_id = (select auth.uid())
    )
  );

create policy "physiquemaxx_photos_delete" on public.physiquemaxx_photos
  for delete to authenticated
  using (
    exists (
      select 1 from public.physiquemaxx_checkins c
      where c.id = checkin_id and c.user_id = (select auth.uid())
    )
  );

create policy "physiquemaxx_analyses_select" on public.physiquemaxx_analyses
  for select to authenticated
  using (
    exists (
      select 1 from public.physiquemaxx_checkins c
      where c.id = checkin_id
        and (c.user_id = (select auth.uid())
             or (c.pair_id is not null
                 and public.physiquemaxx_is_member_of_pair(c.pair_id, (select auth.uid()))))
    )
  );

create policy "physiquemaxx_analyses_insert" on public.physiquemaxx_analyses
  for insert to authenticated
  with check (
    exists (
      select 1 from public.physiquemaxx_checkins c
      where c.id = checkin_id and c.user_id = (select auth.uid())
    )
  );

create policy "physiquemaxx_analyses_update" on public.physiquemaxx_analyses
  for update to authenticated
  using (
    exists (
      select 1 from public.physiquemaxx_checkins c
      where c.id = checkin_id and c.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.physiquemaxx_checkins c
      where c.id = checkin_id and c.user_id = (select auth.uid())
    )
  );

create policy "physiquemaxx_analyses_delete" on public.physiquemaxx_analyses
  for delete to authenticated
  using (
    exists (
      select 1 from public.physiquemaxx_checkins c
      where c.id = checkin_id and c.user_id = (select auth.uid())
    )
  );

-- ----------------------------------------------------------------- grants

-- Anon gets nothing at all; authenticated is table-level enabled and row-level
-- constrained by the policies above; service role keeps full access.
revoke all on table
  public.physiquemaxx_profiles,
  public.physiquemaxx_pairs,
  public.physiquemaxx_pair_members,
  public.physiquemaxx_checkins,
  public.physiquemaxx_photos,
  public.physiquemaxx_analyses
from anon;

revoke insert, update, delete, truncate, references, trigger on table
  public.physiquemaxx_pairs,
  public.physiquemaxx_pair_members
from authenticated;

grant select, insert, update, delete on table
  public.physiquemaxx_profiles,
  public.physiquemaxx_checkins,
  public.physiquemaxx_photos,
  public.physiquemaxx_analyses
to authenticated;

grant select on table
  public.physiquemaxx_pairs,
  public.physiquemaxx_pair_members
to authenticated;

grant all on table
  public.physiquemaxx_profiles,
  public.physiquemaxx_pairs,
  public.physiquemaxx_pair_members,
  public.physiquemaxx_checkins,
  public.physiquemaxx_photos,
  public.physiquemaxx_analyses
to service_role;

-- ---------------------------------------------------------------- storage

-- Private bucket; photos are served only via short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'physiquemaxx-photos',
  'physiquemaxx-photos',
  false,
  26214400, -- 25 MB per photo
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Object paths are exactly {user_id}/{checkin_id}/{view}.{ext}. Writes are
-- pinned to the caller's own folder AND an owned check-in; reads are owner or
-- active pair member of the owning check-in's pair (shared check-ins only).

create policy "physiquemaxx_photos_object_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'physiquemaxx-photos'
    and name ~ '^[^/]+/[^/]+/(front|back|left|right)\.[A-Za-z0-9]+$'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.physiquemaxx_checkins c
      where c.id = public.physiquemaxx_uuid_or_null((storage.foldername(name))[2])
        and c.user_id = (select auth.uid())
    )
  );

create policy "physiquemaxx_photos_object_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'physiquemaxx-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'physiquemaxx-photos'
    and name ~ '^[^/]+/[^/]+/(front|back|left|right)\.[A-Za-z0-9]+$'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.physiquemaxx_checkins c
      where c.id = public.physiquemaxx_uuid_or_null((storage.foldername(name))[2])
        and c.user_id = (select auth.uid())
    )
  );

create policy "physiquemaxx_photos_object_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'physiquemaxx-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "physiquemaxx_photos_object_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'physiquemaxx-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.physiquemaxx_checkins c
        where c.id = public.physiquemaxx_uuid_or_null((storage.foldername(name))[2])
          and c.user_id::text = (storage.foldername(name))[1]
          and c.pair_id is not null
          and public.physiquemaxx_is_member_of_pair(c.pair_id, (select auth.uid()))
      )
    )
  );

-- ------------------------------------------------------------------- seed

-- Idempotent pair bootstrap, invoked manually with known emails at deploy
-- time. Service role only — no client role may execute it. No user IDs are
-- hard-coded anywhere; identities resolve from auth.users at call time.
create function public.physiquemaxx_seed_pair(email_a text, email_b text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ua uuid;
  ub uuid;
  v_pair uuid;
begin
  select u.id into ua from auth.users u where lower(u.email) = lower(email_a);
  if ua is null then
    raise exception 'physiquemaxx_seed_pair: no auth user for %', email_a;
  end if;

  select u.id into ub from auth.users u where lower(u.email) = lower(email_b);
  if ub is null then
    raise exception 'physiquemaxx_seed_pair: no auth user for %', email_b;
  end if;

  if ua = ub then
    raise exception 'physiquemaxx_seed_pair: both emails resolve to the same user';
  end if;

  -- Default profiles from the email local part; users can rename later.
  insert into public.physiquemaxx_profiles (id, display_name, handle)
  values
    (ua, initcap(split_part(email_a, '@', 1)),
         regexp_replace(lower(split_part(email_a, '@', 1)), '[^a-z0-9_]', '', 'g')),
    (ub, initcap(split_part(email_b, '@', 1)),
         regexp_replace(lower(split_part(email_b, '@', 1)), '[^a-z0-9_]', '', 'g'))
  on conflict (id) do nothing;

  select ma.pair_id into v_pair
  from public.physiquemaxx_pair_members ma
  join public.physiquemaxx_pair_members mb on mb.pair_id = ma.pair_id
  join public.physiquemaxx_pairs p on p.id = ma.pair_id
  where ma.user_id = ua and mb.user_id = ub and p.active
  limit 1;

  if v_pair is null then
    insert into public.physiquemaxx_pairs default values returning id into v_pair;
  end if;

  insert into public.physiquemaxx_pair_members (pair_id, user_id)
  values (v_pair, ua), (v_pair, ub)
  on conflict (pair_id, user_id) do update set active = true;

  return v_pair;
end;
$$;

revoke all on function public.physiquemaxx_seed_pair(text, text) from public, anon, authenticated;
grant execute on function public.physiquemaxx_seed_pair(text, text) to service_role;
