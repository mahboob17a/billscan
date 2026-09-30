-- Record of each user's acceptance of the User Guide, Privacy Policy and Disclaimer.
create table if not exists public.user_consents (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  version      text not null,
  documents    text not null default 'guide,privacy,disclaimer',
  accepted_at  timestamptz not null,
  recorded_at  timestamptz not null default now(),
  app_version  text,
  platform     text,
  unique (user_id, version)
);

alter table public.user_consents enable row level security;

drop policy if exists "Users record their own consent" on public.user_consents;
create policy "Users record their own consent"
  on public.user_consents for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Read own consent, admins read all" on public.user_consents;
create policy "Read own consent, admins read all"
  on public.user_consents for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant insert (user_id, version, documents, accepted_at, app_version, platform) on public.user_consents to authenticated;
grant select on public.user_consents to authenticated;
