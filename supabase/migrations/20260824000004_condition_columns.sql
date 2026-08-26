-- Condition-guidance columns: weight logged per check-in; profile facts used
-- by the body-fat estimate and cardio/weight targets.
alter table public.physiquemaxx_checkins
  add column if not exists weight_kg numeric;
alter table public.physiquemaxx_profiles
  add column if not exists birthdate date,
  add column if not exists height_cm int,
  add column if not exists gender text check (gender in ('male', 'female'));
