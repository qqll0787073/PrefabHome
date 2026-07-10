-- Harden auth/profile role assignment.
-- Users may self-register only as buyers or manufacturers. Admin assignment
-- must happen through trusted operator/database workflows, never user metadata.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'buyer');
begin
  if requested_role not in ('buyer', 'manufacturer') then
    requested_role := 'buyer';
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    status
  )
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    requested_role,
    'active'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    role = public.profiles.role,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if auth.uid() = old.id and (
    new.role is distinct from old.role
    or new.status is distinct from old.status
  ) then
    raise exception 'Profile role and status can only be changed by an admin.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_privilege_escalation on public.profiles;

create trigger prevent_profile_privilege_escalation
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();
