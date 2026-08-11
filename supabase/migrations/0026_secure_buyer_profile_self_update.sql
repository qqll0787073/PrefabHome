-- Establish a database-enforced Buyer profile self-update boundary.
-- Browser clients may read their authorized profile row but may not mutate
-- public.profiles directly. Approved self-service changes use the narrow RPC.

begin;

do $$
declare
  missing_columns text[];
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Migration 0026 preflight failed: public.profiles is missing.';
  end if;

  select array_agg(expected.column_name order by expected.column_name)
  into missing_columns
  from (values
    ('id'), ('role'), ('full_name'), ('email'), ('status'), ('created_at'), ('updated_at')
  ) as expected(column_name)
  where not exists (
    select 1
    from information_schema.columns actual
    where actual.table_schema = 'public'
      and actual.table_name = 'profiles'
      and actual.column_name = expected.column_name
  );

  if missing_columns is not null then
    raise exception 'Migration 0026 preflight failed: profile columns are missing: %.', missing_columns;
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_own_or_admin'
  ) then
    raise exception 'Migration 0026 preflight failed: the profile SELECT policy is missing.';
  end if;

  if not has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then
    raise exception 'Migration 0026 preflight failed: expected legacy authenticated UPDATE privilege is missing.';
  end if;

  if exists (
    select 1
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'update_my_buyer_profile'
      and (proc.pronargs <> 1 or proc.proargtypes <> '25'::oidvector)
  ) then
    raise exception 'Migration 0026 preflight failed: an incompatible Buyer profile RPC overload exists.';
  end if;
end;
$$;

revoke insert, update, delete on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;

create or replace function public.update_my_buyer_profile(full_name_text text)
returns table (
  full_name text,
  role text,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  normalized_full_name text := btrim(full_name_text);
  actor_profile public.profiles%rowtype;
begin
  if actor_uuid is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select p.*
  into actor_profile
  from public.profiles p
  where p.id = actor_uuid
  for update;

  if not found then
    raise exception 'An active Buyer profile is required.' using errcode = '42501';
  end if;

  if actor_profile.role <> 'buyer' or actor_profile.status <> 'active' then
    raise exception 'An active Buyer profile is required.' using errcode = '42501';
  end if;

  if normalized_full_name is null or normalized_full_name = '' then
    raise exception 'Full name is required.' using errcode = '22023';
  end if;

  if char_length(normalized_full_name) > 160 then
    raise exception 'Full name must be 160 characters or fewer.' using errcode = '22023';
  end if;

  return query
  update public.profiles p
  set full_name = normalized_full_name
  where p.id = actor_uuid
  returning p.full_name, p.role, p.status, p.updated_at;
end;
$$;

revoke all on function public.update_my_buyer_profile(text) from public, anon, authenticated, service_role;
grant execute on function public.update_my_buyer_profile(text) to authenticated;

do $$
declare
  function_owner text;
  function_security_definer boolean;
  function_config text[];
begin
  if has_table_privilege('authenticated', 'public.profiles', 'INSERT')
     or has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
     or has_table_privilege('authenticated', 'public.profiles', 'DELETE') then
    raise exception 'Migration 0026 postflight failed: authenticated profile DML remains granted.';
  end if;

  if not has_table_privilege('authenticated', 'public.profiles', 'SELECT') then
    raise exception 'Migration 0026 postflight failed: authenticated profile SELECT is missing.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) then
    raise exception 'Migration 0026 postflight failed: a profile mutation policy remains.';
  end if;

  select owner.rolname, proc.prosecdef, proc.proconfig
  into function_owner, function_security_definer, function_config
  from pg_proc proc
  join pg_namespace namespace on namespace.oid = proc.pronamespace
  join pg_roles owner on owner.oid = proc.proowner
  where namespace.nspname = 'public'
    and proc.oid = 'public.update_my_buyer_profile(text)'::regprocedure;

  if function_owner <> 'postgres'
     or not function_security_definer
     or function_config is distinct from array['search_path=public, pg_temp'] then
    raise exception 'Migration 0026 postflight failed: RPC ownership or search_path is unsafe.';
  end if;

  if (select count(*)
      from pg_proc proc
      join pg_namespace namespace on namespace.oid = proc.pronamespace
      where namespace.nspname = 'public'
        and proc.proname = 'update_my_buyer_profile') <> 1 then
    raise exception 'Migration 0026 postflight failed: Buyer profile RPC overloads are unsafe.';
  end if;

  if exists (
       select 1
       from pg_proc proc,
       lateral aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) privilege
       where proc.oid = 'public.update_my_buyer_profile(text)'::regprocedure
         and privilege.grantee = 0
         and privilege.privilege_type = 'EXECUTE'
     )
     or has_function_privilege('anon', 'public.update_my_buyer_profile(text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.update_my_buyer_profile(text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.update_my_buyer_profile(text)', 'EXECUTE') then
    raise exception 'Migration 0026 postflight failed: RPC execute grants are unsafe.';
  end if;
end;
$$;

commit;
