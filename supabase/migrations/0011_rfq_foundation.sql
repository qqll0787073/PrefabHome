-- PH-006A RFQ foundation.
-- Additive schema, policies, and trigger protections for request-for-quotation flows.

create table if not exists public.rfqs (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  status text not null default 'draft',
  requested_quantity integer not null,
  requested_currency text not null default 'USD',
  destination_country text not null,
  destination_port text,
  target_delivery_date date,
  buyer_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rfqs_status_check check (
    status in (
      'draft',
      'submitted',
      'manufacturer_review',
      'quoted',
      'buyer_review',
      'accepted',
      'declined',
      'expired',
      'cancelled'
    )
  ),
  constraint rfqs_requested_quantity_check check (requested_quantity > 0),
  constraint rfqs_requested_currency_check check (char_length(requested_currency) = 3),
  constraint rfqs_buyer_message_length_check check (
    buyer_message is null or char_length(buyer_message) <= 2000
  )
);

create table if not exists public.rfq_messages (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  sender_role text not null,
  message text not null,
  attachment_path text,
  created_at timestamptz not null default now(),
  constraint rfq_messages_sender_role_check check (
    sender_role in ('buyer', 'manufacturer', 'admin')
  ),
  constraint rfq_messages_message_length_check check (
    char_length(message) between 1 and 4000
  )
);

create table if not exists public.rfq_events (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rfqs_buyer_status_idx
  on public.rfqs (buyer_id, status, created_at desc);

create index if not exists rfqs_manufacturer_status_idx
  on public.rfqs (manufacturer_id, status, created_at desc);

create index if not exists rfqs_product_idx
  on public.rfqs (product_id);

create index if not exists rfq_messages_rfq_created_idx
  on public.rfq_messages (rfq_id, created_at);

create index if not exists rfq_events_rfq_created_idx
  on public.rfq_events (rfq_id, created_at);

alter table public.rfqs enable row level security;
alter table public.rfq_messages enable row level security;
alter table public.rfq_events enable row level security;

grant select, insert, update, delete on table public.rfqs to authenticated;
grant select, insert, update, delete on table public.rfq_messages to authenticated;
grant select, insert, update, delete on table public.rfq_events to authenticated;

revoke all on table public.rfqs from anon;
revoke all on table public.rfq_messages from anon;
revoke all on table public.rfq_events from anon;

create or replace function public.can_access_rfq(rfq_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rfqs r
    where r.id = rfq_uuid
      and (
        r.buyer_id = auth.uid()
        or public.owns_manufacturer(r.manufacturer_id)
        or public.is_admin()
      )
  )
$$;

create or replace function public.set_rfq_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create or replace function public.protect_rfq_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.buyer_id is distinct from auth.uid() then
      raise exception 'Buyers can create only their own RFQs.';
    end if;

    if public.current_profile_role() <> 'buyer' then
      raise exception 'Only buyers can create RFQs.';
    end if;

    if new.status not in ('draft', 'submitted') then
      raise exception 'Buyers can create only draft or submitted RFQs.';
    end if;

    return new;
  end if;

  if old.buyer_id is distinct from auth.uid() then
    raise exception 'Only the RFQ buyer can update this RFQ.';
  end if;

  if old.status <> 'draft' then
    raise exception 'Only draft RFQs can be updated by buyers.';
  end if;

  if new.buyer_id is distinct from old.buyer_id
    or new.manufacturer_id is distinct from old.manufacturer_id
    or new.product_id is distinct from old.product_id then
    raise exception 'RFQ participant and product fields cannot be changed.';
  end if;

  if new.status not in ('draft', 'submitted', 'cancelled') then
    raise exception 'Invalid buyer RFQ status transition.';
  end if;

  return new;
end;
$$;

create or replace function public.protect_rfq_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rfq_record public.rfqs%rowtype;
begin
  select * into rfq_record
  from public.rfqs
  where id = new.rfq_id;

  if not found then
    raise exception 'RFQ does not exist.';
  end if;

  if public.is_admin() then
    if new.sender_profile_id is distinct from auth.uid() then
      raise exception 'Message sender must match authenticated user.';
    end if;
    new.sender_role := 'admin';
    return new;
  end if;

  if new.sender_profile_id is distinct from auth.uid() then
    raise exception 'Message sender must match authenticated user.';
  end if;

  if rfq_record.buyer_id = auth.uid() then
    new.sender_role := 'buyer';
    return new;
  end if;

  if public.owns_manufacturer(rfq_record.manufacturer_id) then
    new.sender_role := 'manufacturer';
    return new;
  end if;

  raise exception 'Only RFQ participants can post messages.';
end;
$$;

create or replace function public.record_rfq_event(
  rfq_uuid uuid,
  event_name text,
  event_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_rfq(rfq_uuid) then
    raise exception 'Only RFQ participants can record events.';
  end if;

  insert into public.rfq_events (rfq_id, event_type, actor_profile_id, metadata)
  values (rfq_uuid, event_name, auth.uid(), coalesce(event_metadata, '{}'::jsonb));
end;
$$;

create or replace function public.protect_rfq_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_rfq(new.rfq_id) then
    raise exception 'Only RFQ participants can record events.';
  end if;

  new.actor_profile_id := auth.uid();
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists set_rfqs_updated_at on public.rfqs;
create trigger set_rfqs_updated_at
before update on public.rfqs
for each row execute function public.set_rfq_updated_at();

drop trigger if exists protect_rfq_write on public.rfqs;
create trigger protect_rfq_write
before insert or update on public.rfqs
for each row execute function public.protect_rfq_write();

drop trigger if exists protect_rfq_message_insert on public.rfq_messages;
create trigger protect_rfq_message_insert
before insert on public.rfq_messages
for each row execute function public.protect_rfq_message_insert();

drop trigger if exists protect_rfq_event_insert on public.rfq_events;
create trigger protect_rfq_event_insert
before insert on public.rfq_events
for each row execute function public.protect_rfq_event_insert();

drop policy if exists "rfqs_select_participant_or_admin" on public.rfqs;
drop policy if exists "rfqs_insert_buyer" on public.rfqs;
drop policy if exists "rfqs_update_draft_buyer_or_admin" on public.rfqs;
drop policy if exists "rfqs_admin_delete" on public.rfqs;

create policy "rfqs_select_participant_or_admin"
on public.rfqs
for select
to authenticated
using (
  buyer_id = auth.uid()
  or public.owns_manufacturer(manufacturer_id)
  or public.is_admin()
);

create policy "rfqs_insert_buyer"
on public.rfqs
for insert
to authenticated
with check (
  buyer_id = auth.uid()
  and public.current_profile_role() = 'buyer'
);

create policy "rfqs_update_draft_buyer_or_admin"
on public.rfqs
for update
to authenticated
using (
  public.is_admin()
  or (buyer_id = auth.uid() and status = 'draft')
)
with check (
  public.is_admin()
  or (
    buyer_id = auth.uid()
    and status in ('draft', 'submitted', 'cancelled')
  )
);

create policy "rfqs_admin_delete"
on public.rfqs
for delete
to authenticated
using (public.is_admin());

drop policy if exists "rfq_messages_select_participant_or_admin" on public.rfq_messages;
drop policy if exists "rfq_messages_insert_participant" on public.rfq_messages;
drop policy if exists "rfq_messages_admin_delete" on public.rfq_messages;

create policy "rfq_messages_select_participant_or_admin"
on public.rfq_messages
for select
to authenticated
using (public.can_access_rfq(rfq_id));

create policy "rfq_messages_insert_participant"
on public.rfq_messages
for insert
to authenticated
with check (public.can_access_rfq(rfq_id));

create policy "rfq_messages_admin_delete"
on public.rfq_messages
for delete
to authenticated
using (public.is_admin());

drop policy if exists "rfq_events_select_participant_or_admin" on public.rfq_events;
drop policy if exists "rfq_events_insert_participant_or_admin" on public.rfq_events;
drop policy if exists "rfq_events_admin_delete" on public.rfq_events;

create policy "rfq_events_select_participant_or_admin"
on public.rfq_events
for select
to authenticated
using (public.can_access_rfq(rfq_id));

create policy "rfq_events_insert_participant_or_admin"
on public.rfq_events
for insert
to authenticated
with check (public.can_access_rfq(rfq_id));

create policy "rfq_events_admin_delete"
on public.rfq_events
for delete
to authenticated
using (public.is_admin());
