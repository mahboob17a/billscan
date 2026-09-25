-- BillScan · Phase 0 schema
-- Multi-user from day one: an admin creates supervisor accounts; each person's
-- bills stay on their own phone (SQLite) and are never visible to others.
-- The server keeps only user profiles and a log of AI calls (for cost control).

create type public.app_role as enum ('admin', 'supervisor');

-- ── Profiles ─────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text not null default '',
  designation  text not null default 'Maintenance Supervisor',
  site         text not null default 'UTAS Nizwa',
  employee_id  text unique,
  role         public.app_role not null default 'supervisor',
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'One row per BillScan user. full_name + designation fill "Prepared By" on the report.';

-- Is the current user an active admin? (security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$;

-- Create a profile automatically when an account is created (invite or sign-up).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, employee_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'employee_id', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

create policy "Read own profile, admins read all"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "Update own name and designation"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins manage all profiles"
  on public.profiles for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Supervisors may only change their own name/designation; role, active and
-- employee_id are admin-only.
revoke update on public.profiles from authenticated;
grant update (full_name, designation) on public.profiles to authenticated;

-- ── AI call log ──────────────────────────────────────────────────────────
create table public.ai_calls (
  id                 bigint generated always as identity primary key,
  user_id            uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  model              text not null,
  pages              smallint not null default 1,
  prompt_tokens      integer,
  completion_tokens  integer,
  duration_ms        integer,
  ok                 boolean not null,
  error              text
);

create index ai_calls_user_created on public.ai_calls (user_id, created_at desc);

alter table public.ai_calls enable row level security;

-- Written only by the Edge Function (service role). Users see their own; admins see all.
create policy "Read own AI calls, admins read all"
  on public.ai_calls for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
