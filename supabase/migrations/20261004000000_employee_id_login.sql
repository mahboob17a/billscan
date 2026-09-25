-- BillScan · Phase 1: sign in with employee ID
-- The app turns an employee ID into the account email before signing in.
-- Returns NULL for unknown or inactive IDs. Only an exact ID match returns an email.

create or replace function public.email_for_employee_id(eid text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where p.employee_id = trim(eid) and p.active
  limit 1;
$$;

revoke all on function public.email_for_employee_id(text) from public;
grant execute on function public.email_for_employee_id(text) to anon, authenticated;
