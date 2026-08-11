-- Run after migrations 0001-0026 in an isolated disposable database.
-- Every fixture and mutation rolls back.

begin;

create temp table buyer_profile_security_subjects (
  label text primary key,
  id uuid not null
) on commit drop;

do $$
declare
  buyer_a uuid := gen_random_uuid();
  buyer_b uuid := gen_random_uuid();
  inactive_buyer uuid := gen_random_uuid();
  manufacturer uuid := gen_random_uuid();
  admin_user uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values
    (buyer_a, 'profile-boundary-buyer-a-' || buyer_a || '@example.test', '{"full_name":"Buyer A","role":"buyer"}'),
    (buyer_b, 'profile-boundary-buyer-b-' || buyer_b || '@example.test', '{"full_name":"Buyer B","role":"buyer"}'),
    (inactive_buyer, 'profile-boundary-inactive-' || inactive_buyer || '@example.test', '{"full_name":"Inactive Buyer","role":"buyer"}'),
    (manufacturer, 'profile-boundary-manufacturer-' || manufacturer || '@example.test', '{"full_name":"Manufacturer","role":"manufacturer"}'),
    (admin_user, 'profile-boundary-admin-' || admin_user || '@example.test', '{"full_name":"Admin","role":"buyer"}');

  update public.profiles set status = 'suspended' where id = inactive_buyer;
  update public.profiles set role = 'admin' where id = admin_user;

  insert into buyer_profile_security_subjects(label, id)
  values ('buyer_a', buyer_a), ('buyer_b', buyer_b), ('inactive', inactive_buyer),
    ('manufacturer', manufacturer), ('admin', admin_user);
end;
$$;

grant select on buyer_profile_security_subjects to authenticated, anon;

do $$
begin
  if has_table_privilege('authenticated', 'public.profiles', 'INSERT')
     or has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
     or has_table_privilege('authenticated', 'public.profiles', 'DELETE') then
    raise exception 'authenticated retains direct profile DML';
  end if;
  if not has_table_privilege('authenticated', 'public.profiles', 'SELECT') then
    raise exception 'authenticated lost profile read access';
  end if;
end;
$$;

set local role authenticated;

do $$
declare
  buyer_a uuid := (select id from buyer_profile_security_subjects where label = 'buyer_a');
  result record;
  original_email text;
  original_role text;
  original_status text;
  original_created_at timestamptz;
begin
  perform set_config('request.jwt.claim.sub', buyer_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select email, role, status, created_at
  into original_email, original_role, original_status, original_created_at
  from public.profiles where id = buyer_a;

  select * into result from public.update_my_buyer_profile('  李 雷  ');
  if result.full_name <> '李 雷' or result.role <> 'buyer' or result.status <> 'active' then
    raise exception 'approved Buyer update did not return the normalized safe profile';
  end if;

  if exists (
    select 1 from public.profiles
    where id = buyer_a
      and (email is distinct from original_email
        or role is distinct from original_role
        or status is distinct from original_status
        or created_at is distinct from original_created_at)
  ) then
    raise exception 'approved RPC changed a protected profile field';
  end if;
end;
$$;

do $$
declare
  buyer_a uuid := (select id from buyer_profile_security_subjects where label = 'buyer_a');
  buyer_b uuid := (select id from buyer_profile_security_subjects where label = 'buyer_b');
  blocked boolean;
  statement text;
begin
  perform set_config('request.jwt.claim.sub', buyer_a::text, true);

  foreach statement in array array[
    format('update public.profiles set full_name = %L where id = %L', 'Direct bypass', buyer_a),
    format('update public.profiles set full_name = %L where id = %L', 'Cross Buyer', buyer_b),
    format('update public.profiles set role = %L where id = %L', 'admin', buyer_a),
    format('update public.profiles set status = %L where id = %L', 'suspended', buyer_a),
    format('update public.profiles set email = %L where id = %L', 'forged@example.test', buyer_a),
    format('update public.profiles set id = %L where id = %L', gen_random_uuid(), buyer_a),
    format('update public.profiles set created_at = now() - interval %L where id = %L', '1 year', buyer_a),
    format('update public.profiles set updated_at = now() - interval %L where id = %L', '1 year', buyer_a)
  ] loop
    blocked := false;
    begin
      execute statement;
    exception when insufficient_privilege then
      blocked := true;
    end;
    if not blocked then
      raise exception 'direct profile mutation was not blocked: %', statement;
    end if;
  end loop;

  if (select full_name from public.profiles where id = buyer_b) <> 'Buyer B' then
    raise exception 'cross-Buyer data changed';
  end if;

  if exists (select 1 from public.profiles where id = buyer_b) then
    raise exception 'RLS exposed another Buyer profile';
  end if;
end;
$$;

do $$
declare
  buyer_a uuid := (select id from buyer_profile_security_subjects where label = 'buyer_a');
  rejected boolean;
  invalid_name text;
begin
  perform set_config('request.jwt.claim.sub', buyer_a::text, true);
  foreach invalid_name in array array[null::text, '   ', repeat('名', 161)] loop
    rejected := false;
    begin
      perform public.update_my_buyer_profile(invalid_name);
    exception when invalid_parameter_value then
      rejected := true;
    end;
    if not rejected then
      raise exception 'invalid full_name was accepted';
    end if;
  end loop;
end;
$$;

do $$
declare
  subject_label text;
  subject_uuid uuid;
  rejected boolean;
begin
  foreach subject_label in array array['inactive', 'manufacturer', 'admin'] loop
    select id into subject_uuid from buyer_profile_security_subjects where label = subject_label;
    perform set_config('request.jwt.claim.sub', subject_uuid::text, true);
    rejected := false;
    begin
      perform public.update_my_buyer_profile('Forbidden Actor');
    exception when insufficient_privilege then
      rejected := true;
    end;
    if not rejected then
      raise exception '% unexpectedly used Buyer profile RPC', subject_label;
    end if;
  end loop;
end;
$$;

reset role;
set local role anon;

do $$
declare
  rejected boolean := false;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.update_my_buyer_profile('Anonymous');
  exception when insufficient_privilege or undefined_function then
    rejected := true;
  end;
  if not rejected then
    raise exception 'anonymous unexpectedly used Buyer profile RPC';
  end if;
end;
$$;

reset role;

do $$
begin
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
    raise exception 'Buyer RPC grants are incorrect';
  end if;
end;
$$;

rollback;
