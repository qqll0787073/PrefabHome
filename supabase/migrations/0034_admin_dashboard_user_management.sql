-- Sprint 5D.1: active-profile authority, Admin user management, and dashboard summaries.

begin;

create or replace function public.is_active_profile()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'active'
  )
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  )
$$;

create or replace function public.owns_manufacturer(manufacturer_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.manufacturers m
    join public.profiles p on p.id = m.owner_id
    where m.id = manufacturer_uuid
      and m.owner_id = auth.uid()
      and p.role = 'manufacturer'
      and p.status = 'active'
  )
$$;

revoke all on function public.is_active_profile() from public, anon, authenticated, service_role;
revoke all on function public.current_profile_role() from public, anon, authenticated, service_role;
revoke all on function public.is_admin() from public, anon, authenticated, service_role;
revoke all on function public.owns_manufacturer(uuid) from public, anon, authenticated, service_role;
grant execute on function public.is_active_profile() to authenticated;
grant execute on function public.current_profile_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_manufacturer(uuid) to authenticated;

create or replace function public.admin_list_users(
  search_text text default null,
  role_filter text default null,
  status_filter text default null,
  page_limit integer default 25,
  page_offset integer default 0
)
returns table (
  profile_id uuid,
  full_name text,
  account_email text,
  profile_role text,
  profile_status text,
  profile_created_at timestamptz,
  profile_updated_at timestamptz,
  manufacturer_exists boolean,
  manufacturer_application_status text,
  manufacturer_name text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_search text := nullif(btrim(search_text), '');
begin
  if not public.is_admin() then
    raise exception 'Active Administrator access is required.' using errcode = '42501';
  end if;
  if role_filter is not null and role_filter not in ('buyer', 'manufacturer', 'admin') then
    raise exception 'Invalid role filter.' using errcode = '22023';
  end if;
  if status_filter is not null and status_filter not in ('active', 'pending', 'suspended') then
    raise exception 'Invalid status filter.' using errcode = '22023';
  end if;
  if page_limit < 1 or page_limit > 100 or page_offset < 0 then
    raise exception 'Pagination is outside the supported range.' using errcode = '22023';
  end if;

  return query
  select p.id, p.full_name, p.email, p.role, p.status, p.created_at, p.updated_at,
    (m.id is not null), m.application_status,
    coalesce(m.company_display_name, m.company_legal_name, m.company_name),
    count(*) over ()
  from public.profiles p
  left join lateral (
    select owned.id, owned.application_status, owned.company_display_name,
      owned.company_legal_name, owned.company_name
    from public.manufacturers owned
    where owned.owner_id = p.id
    order by owned.created_at, owned.id
    limit 1
  ) m on true
  where (role_filter is null or p.role = role_filter)
    and (status_filter is null or p.status = status_filter)
    and (
      normalized_search is null
      or p.full_name ilike '%' || normalized_search || '%'
      or p.email ilike '%' || normalized_search || '%'
      or coalesce(m.company_display_name, m.company_legal_name, m.company_name, '') ilike '%' || normalized_search || '%'
    )
  order by lower(coalesce(p.full_name, p.email)), lower(p.email), p.id
  limit page_limit offset page_offset;
end;
$$;

create or replace function public.admin_set_profile_status(target_profile_id uuid, new_status text)
returns table (profile_id uuid, profile_role text, profile_status text, profile_updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  target public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Active Administrator access is required.' using errcode = '42501';
  end if;
  if new_status not in ('active', 'pending', 'suspended') then
    raise exception 'Invalid profile status.' using errcode = '22023';
  end if;

  -- Serialize Admin deactivation decisions, then lock the target row.
  perform pg_advisory_xact_lock(hashtextextended('public.admin_set_profile_status:active-admins', 0));
  select * into target from public.profiles where id = target_profile_id for update;
  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;
  if target.status = new_status then
    return query select target.id, target.role, target.status, target.updated_at;
    return;
  end if;
  if not (
    (target.status = 'pending' and new_status in ('active', 'suspended'))
    or (target.status = 'active' and new_status = 'suspended')
    or (target.status = 'suspended' and new_status = 'active')
  ) then
    raise exception 'Unsupported profile status transition.' using errcode = '22023';
  end if;
  if target.id = actor_id and new_status = 'suspended' then
    raise exception 'Administrators cannot suspend their own active session.' using errcode = '42501';
  end if;
  if target.role = 'admin' and target.status = 'active' and new_status <> 'active'
     and not exists (
       select 1 from public.profiles p
       where p.role = 'admin' and p.status = 'active' and p.id <> target.id
     ) then
    raise exception 'The final active Administrator cannot be suspended.' using errcode = '23514';
  end if;

  return query
  update public.profiles p set status = new_status
  where p.id = target.id
  returning p.id, p.role, p.status, p.updated_at;
end;
$$;

create or replace function public.admin_dashboard_summary()
returns table (
  total_users bigint,
  active_buyers bigint,
  active_manufacturers bigint,
  active_admins bigint,
  suspended_users bigint,
  pending_users bigint,
  manufacturer_reviews bigint,
  product_reviews bigint,
  actionable_rfqs bigint,
  actionable_purchase_orders bigint,
  contracts_in_review bigint,
  open_invoices bigint,
  shipping_handoffs bigint,
  logistics_arrangements bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'Active Administrator access is required.' using errcode = '42501';
  end if;
  return query select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles where role='buyer' and status='active'),
    (select count(*) from public.profiles where role='manufacturer' and status='active'),
    (select count(*) from public.profiles where role='admin' and status='active'),
    (select count(*) from public.profiles where status='suspended'),
    (select count(*) from public.profiles where status='pending'),
    (select count(*) from public.manufacturers where application_status in ('submitted','under_review')),
    (select count(*) from public.products where status='submitted'),
    (select count(*) from public.rfqs where status in ('submitted','manufacturer_review','quoted','buyer_review','revision_requested')),
    (select count(*) from public.purchase_orders where status in ('submitted','manufacturer_review','revision_requested')),
    (select count(*) from public.contracts where status in ('ready','participant_review','revision_requested')),
    (select count(*) from public.invoices where status='issued'),
    (select count(*) from public.shipping_readiness_records where status in ('shipping_draft','ready_for_logistics')),
    (select count(*) from public.logistics_booking_requests where status in ('submitted_for_arrangement','carrier_options_available','carrier_selected'));
end;
$$;

revoke all on function public.admin_list_users(text,text,text,integer,integer) from public, anon, authenticated, service_role;
revoke all on function public.admin_set_profile_status(uuid,text) from public, anon, authenticated, service_role;
revoke all on function public.admin_dashboard_summary() from public, anon, authenticated, service_role;
grant execute on function public.admin_list_users(text,text,text,integer,integer) to authenticated;
grant execute on function public.admin_set_profile_status(uuid,text) to authenticated;
grant execute on function public.admin_dashboard_summary() to authenticated;

-- Profile mutation remains RPC-only for browser clients.
revoke insert, update, delete on table public.profiles from authenticated;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own_or_admin" on public.profiles;

commit;
