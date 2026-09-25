-- Phase 4: crash and error reports from the app (written by signed-in users, read by admins).
create table if not exists public.app_errors (
  id           bigint generated always as identity primary key,
  user_id      uuid references auth.users (id) on delete set null default auth.uid(),
  received_at  timestamptz not null default now(),
  occurred_at  timestamptz,
  app_version  text,
  platform     text,
  message      text not null,
  stack        text,
  context      text,
  fatal        boolean not null default false
);

create index if not exists app_errors_received on public.app_errors (received_at desc);

alter table public.app_errors enable row level security;

drop policy if exists "Users add their own error reports" on public.app_errors;
create policy "Users add their own error reports"
  on public.app_errors for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins read error reports" on public.app_errors;
create policy "Admins read error reports"
  on public.app_errors for select to authenticated
  using (public.is_admin());

grant insert (user_id, occurred_at, app_version, platform, message, stack, context, fatal) on public.app_errors to authenticated;
grant select on public.app_errors to authenticated;
