begin;

create temp table rfq_security_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

create temp table rfq_security_subjects (
  subject_name text primary key,
  subject_id uuid not null
) on commit drop;

grant select, insert on rfq_security_results to anon, authenticated;
grant select, insert on rfq_security_subjects to anon, authenticated;

do $$
declare
  buyer_id uuid := gen_random_uuid();
  other_buyer_id uuid := gen_random_uuid();
  manufacturer_owner_id uuid := gen_random_uuid();
  other_manufacturer_owner_id uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  )
  values
    ('00000000-0000-0000-0000-000000000000', buyer_id, 'authenticated', 'authenticated', 'rfq-buyer-' || buyer_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"RFQ Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_buyer_id, 'authenticated', 'authenticated', 'rfq-other-buyer-' || other_buyer_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"RFQ Other Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', manufacturer_owner_id, 'authenticated', 'authenticated', 'rfq-manufacturer-' || manufacturer_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"RFQ Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_manufacturer_owner_id, 'authenticated', 'authenticated', 'rfq-other-manufacturer-' || other_manufacturer_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"RFQ Other Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', 'rfq-admin-' || admin_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"RFQ Admin","role":"buyer"}'::jsonb, now(), now(), false, false);

  update public.profiles set role = 'admin' where id = admin_id;

  insert into rfq_security_subjects(subject_name, subject_id)
  values
    ('buyer', buyer_id),
    ('other_buyer', other_buyer_id),
    ('manufacturer_owner', manufacturer_owner_id),
    ('other_manufacturer_owner', other_manufacturer_owner_id),
    ('admin', admin_id);
end;
$$;

set local role authenticated;

do $$
declare
  admin_id uuid;
  manufacturer_owner_id uuid;
  other_manufacturer_owner_id uuid;
  manufacturer_id uuid;
  other_manufacturer_id uuid;
  product_id uuid;
  other_product_id uuid;
begin
  select subject_id into admin_id from rfq_security_subjects where subject_name = 'admin';
  select subject_id into manufacturer_owner_id from rfq_security_subjects where subject_name = 'manufacturer_owner';
  select subject_id into other_manufacturer_owner_id from rfq_security_subjects where subject_name = 'other_manufacturer_owner';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (manufacturer_owner_id, 'RFQ Factory Legal', 'RFQ Factory', 'China', 'draft')
  returning id into manufacturer_id;

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (other_manufacturer_owner_id, 'Other RFQ Factory Legal', 'Other RFQ Factory', 'Vietnam', 'draft')
  returning id into other_manufacturer_id;

  update public.manufacturers
  set application_status = 'approved',
      review_notes = 'Approved for rollback-only RFQ verification.'
  where id in (manufacturer_id, other_manufacturer_id);

  insert into public.products(
    manufacturer_id,
    name,
    model_name,
    category,
    description,
    status,
    bedrooms,
    bathrooms,
    floor_area_sq_ft,
    currency,
    fob_price
  )
  values (
    manufacturer_id,
    'RFQ Test Product',
    'RFQ Test Product',
    'modular',
    'RFQ security test product.',
    'published',
    3,
    2,
    1200,
    'USD',
    95000
  )
  returning id into product_id;

  insert into public.products(manufacturer_id, name, model_name, category, description, status)
  values (other_manufacturer_id, 'Other RFQ Test Product', 'Other RFQ Test Product', 'modular', 'Other RFQ security test product.', 'published')
  returning id into other_product_id;

  insert into rfq_security_subjects(subject_name, subject_id)
  values
    ('manufacturer', manufacturer_id),
    ('other_manufacturer', other_manufacturer_id),
    ('product', product_id),
    ('other_product', other_product_id);
end;
$$;

do $$
declare
  buyer_id uuid;
  other_buyer_id uuid;
  manufacturer_id uuid;
  other_manufacturer_id uuid;
  product_id uuid;
  other_product_id uuid;
  rfq_id uuid;
  other_rfq_id uuid;
  draft_delete_rfq_id uuid;
  invalid_transition_rfq_id uuid;
  fractional_rfq_id uuid;
  blocked boolean;
begin
  select subject_id into buyer_id from rfq_security_subjects where subject_name = 'buyer';
  select subject_id into other_buyer_id from rfq_security_subjects where subject_name = 'other_buyer';
  select subject_id into manufacturer_id from rfq_security_subjects where subject_name = 'manufacturer';
  select subject_id into other_manufacturer_id from rfq_security_subjects where subject_name = 'other_manufacturer';
  select subject_id into product_id from rfq_security_subjects where subject_name = 'product';
  select subject_id into other_product_id from rfq_security_subjects where subject_name = 'other_product';

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.rfqs (
    buyer_id,
    manufacturer_id,
    product_id,
    status,
    requested_quantity,
    requested_currency,
    incoterm,
    destination_country,
    destination_port,
    buyer_message
  )
  values (
    buyer_id,
    manufacturer_id,
    product_id,
    'draft',
    2,
    'usd',
    'fob',
    'United States',
    'Los Angeles',
    'Please quote this test RFQ.'
  )
  returning id into rfq_id;

  insert into public.rfq_messages(rfq_id, sender_profile_id, sender_role, message)
  values (rfq_id, buyer_id, 'admin', 'Initial buyer message.');

  perform public.record_rfq_event(rfq_id, 'draft_created', '{"source":"security_test"}'::jsonb);

  insert into public.rfqs (
    buyer_id,
    manufacturer_id,
    product_id,
    status,
    requested_quantity,
    requested_currency,
    destination_country,
    buyer_message
  )
  values (
    buyer_id,
    manufacturer_id,
    product_id,
    'draft',
    1.5,
    'USD',
    'United States',
    'Fractional quantity RFQ.'
  )
  returning id into fractional_rfq_id;

  insert into public.rfqs (
    buyer_id,
    manufacturer_id,
    product_id,
    status,
    requested_quantity,
    requested_currency,
    destination_country,
    buyer_message
  )
  values (
    buyer_id,
    manufacturer_id,
    product_id,
    'draft',
    1,
    'USD',
    'United States',
    'Draft to delete.'
  )
  returning id into draft_delete_rfq_id;

  insert into public.rfqs (
    buyer_id,
    manufacturer_id,
    product_id,
    status,
    requested_quantity,
    requested_currency,
    destination_country,
    buyer_message
  )
  values (
    buyer_id,
    manufacturer_id,
    product_id,
    'draft',
    1,
    'USD',
    'United States',
    'Invalid transition test.'
  )
  returning id into invalid_transition_rfq_id;

  blocked := false;
  begin
    insert into public.rfqs (
      buyer_id,
      manufacturer_id,
      product_id,
      status,
      requested_quantity,
      requested_currency,
      destination_country
    )
    values (
      buyer_id,
      manufacturer_id,
      product_id,
      'draft',
      0,
      'USD',
      'United States'
    );
  exception when others then
    blocked := true;
  end;
  insert into rfq_security_results values ('quantity must be positive', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    insert into public.rfqs (
      buyer_id,
      manufacturer_id,
      product_id,
      status,
      requested_quantity,
      requested_currency,
      destination_country
    )
    values (
      buyer_id,
      manufacturer_id,
      product_id,
      'draft',
      1,
      'US1',
      'United States'
    );
  exception when others then
    blocked := true;
  end;
  insert into rfq_security_results values ('currency must be ISO alpha uppercase', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', other_buyer_id::text, true);

  insert into public.rfqs (
    buyer_id,
    manufacturer_id,
    product_id,
    status,
    requested_quantity,
    requested_currency,
    destination_country,
    buyer_message
  )
  values (
    other_buyer_id,
    other_manufacturer_id,
    other_product_id,
    'submitted',
    1,
    'USD',
    'Canada',
    'Other buyer submitted RFQ.'
  )
  returning id into other_rfq_id;

  insert into rfq_security_subjects(subject_name, subject_id)
  values
    ('rfq', rfq_id),
    ('other_rfq', other_rfq_id),
    ('draft_delete_rfq', draft_delete_rfq_id),
    ('invalid_transition_rfq', invalid_transition_rfq_id),
    ('fractional_rfq', fractional_rfq_id);
end;
$$;

do $$
declare
  buyer_id uuid;
  other_buyer_id uuid;
  manufacturer_owner_id uuid;
  other_manufacturer_owner_id uuid;
  admin_id uuid;
  product_id uuid;
  target_rfq_id uuid;
  other_rfq_id uuid;
  draft_delete_rfq_id uuid;
  invalid_transition_rfq_id uuid;
  fractional_rfq_id uuid;
  visible_count integer;
  blocked boolean;
  stored_text text;
  stored_number numeric;
  before_snapshot jsonb;
  after_snapshot jsonb;
  event_names text[];
begin
  select subject_id into buyer_id from rfq_security_subjects where subject_name = 'buyer';
  select subject_id into other_buyer_id from rfq_security_subjects where subject_name = 'other_buyer';
  select subject_id into manufacturer_owner_id from rfq_security_subjects where subject_name = 'manufacturer_owner';
  select subject_id into other_manufacturer_owner_id from rfq_security_subjects where subject_name = 'other_manufacturer_owner';
  select subject_id into admin_id from rfq_security_subjects where subject_name = 'admin';
  select subject_id into product_id from rfq_security_subjects where subject_name = 'product';
  select subject_id into target_rfq_id from rfq_security_subjects where subject_name = 'rfq';
  select subject_id into other_rfq_id from rfq_security_subjects where subject_name = 'other_rfq';
  select subject_id into draft_delete_rfq_id from rfq_security_subjects where subject_name = 'draft_delete_rfq';
  select subject_id into invalid_transition_rfq_id from rfq_security_subjects where subject_name = 'invalid_transition_rfq';
  select subject_id into fractional_rfq_id from rfq_security_subjects where subject_name = 'fractional_rfq';

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*) into visible_count from public.rfqs where id = target_rfq_id;
  insert into rfq_security_results values ('buyer own read', visible_count = 1, 'visible: ' || visible_count);

  select count(*) into visible_count from public.rfqs where id = other_rfq_id;
  insert into rfq_security_results values ('buyer other read blocked', visible_count = 0, 'visible: ' || visible_count);

  select requested_currency into stored_text from public.rfqs where id = target_rfq_id;
  insert into rfq_security_results values ('currency normalized uppercase', stored_text = 'USD', 'currency: ' || coalesce(stored_text, '<null>'));

  select incoterm into stored_text from public.rfqs where id = target_rfq_id;
  insert into rfq_security_results values ('incoterm normalized uppercase', stored_text = 'FOB', 'incoterm: ' || coalesce(stored_text, '<null>'));

  select requested_quantity into stored_number from public.rfqs where id = fractional_rfq_id;
  insert into rfq_security_results values ('fractional quantity allowed', stored_number = 1.5, 'quantity: ' || coalesce(stored_number::text, '<null>'));

  update public.rfqs
  set destination_port = 'Long Beach'
  where id = target_rfq_id;
  select count(*) into visible_count from public.rfqs where id = target_rfq_id and destination_port = 'Long Beach';
  insert into rfq_security_results values ('draft update allowed', visible_count = 1, 'updated: ' || visible_count);

  blocked := false;
  begin
    update public.rfqs
    set status = 'accepted'
    where id = invalid_transition_rfq_id;
  exception when others then
    blocked := true;
  end;
  insert into rfq_security_results values ('draft to accepted transition blocked', blocked, 'blocked: ' || blocked);

  select product_snapshot into before_snapshot from public.rfqs where id = target_rfq_id;
  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  update public.products set name = 'RFQ Test Product Renamed' where id = product_id;
  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  select product_snapshot into after_snapshot from public.rfqs where id = target_rfq_id;
  insert into rfq_security_results values (
    'product snapshot immutable after product change',
    before_snapshot = after_snapshot and after_snapshot->>'name' = 'RFQ Test Product',
    'snapshot name: ' || coalesce(after_snapshot->>'name', '<null>')
  );

  blocked := false;
  begin
    update public.rfqs
    set product_snapshot = '{"name":"tampered"}'::jsonb
    where id = target_rfq_id;
  exception when others then
    blocked := true;
  end;
  insert into rfq_security_results values ('product snapshot update blocked', blocked, 'blocked: ' || blocked);

  update public.rfqs
  set status = 'submitted'
  where id = target_rfq_id;
  select status into stored_text from public.rfqs where id = target_rfq_id;
  insert into rfq_security_results values ('draft submit allowed', stored_text = 'submitted', 'status: ' || coalesce(stored_text, '<null>'));

  blocked := false;
  begin
    update public.rfqs
    set status = 'accepted'
    where id = target_rfq_id;
  exception when others then
    blocked := true;
  end;
  insert into rfq_security_results values ('submitted to accepted transition blocked', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    update public.rfqs
    set destination_port = 'Seattle'
    where id = target_rfq_id;
  exception when others then
    blocked := true;
  end;
  insert into rfq_security_results values ('submitted field edit denied', blocked, 'blocked: ' || blocked);

  update public.rfqs
  set status = 'cancelled'
  where id = target_rfq_id;
  select status into stored_text from public.rfqs where id = target_rfq_id;
  insert into rfq_security_results values ('submitted cancel allowed', stored_text = 'cancelled', 'status: ' || coalesce(stored_text, '<null>'));

  delete from public.rfqs where id = draft_delete_rfq_id;
  select count(*) into visible_count from public.rfqs where id = draft_delete_rfq_id;
  insert into rfq_security_results values ('buyer can delete draft', visible_count = 0, 'remaining: ' || visible_count);

  select sender_role into stored_text
  from public.rfq_messages
  where rfq_id = target_rfq_id
  order by created_at asc
  limit 1;
  insert into rfq_security_results values ('buyer message role derived by database', stored_text = 'buyer', 'sender_role: ' || coalesce(stored_text, '<null>'));

  perform public.record_rfq_event(target_rfq_id, 'buyer_opened', '{"order":2}'::jsonb);
  insert into public.rfq_events(rfq_id, event_type, actor_profile_id, metadata, created_at)
  values
    (target_rfq_id, 'submitted', admin_id, '{"order":1}'::jsonb, '2026-01-01 00:00:01+00'),
    (target_rfq_id, 'cancelled', admin_id, '{"order":3}'::jsonb, '2026-01-01 00:00:03+00');
  select array_agg(event_type order by created_at asc)
  into event_names
  from public.rfq_events
  where rfq_id = target_rfq_id
    and event_type in ('submitted', 'cancelled');
  insert into rfq_security_results values (
    'events order ascending by created_at',
    event_names = array['submitted','cancelled'],
    'events: ' || coalesce(array_to_string(event_names, ','), '<none>')
  );

  blocked := false;
  begin
    insert into public.rfq_events(rfq_id, event_type, actor_profile_id, metadata)
    values (target_rfq_id, 'rfq_message_posted', buyer_id, '{}'::jsonb);
  exception when others then
    blocked := true;
  end;
  insert into rfq_security_results values ('invalid event type blocked', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  select count(*) into visible_count from public.rfqs where id = target_rfq_id;
  insert into rfq_security_results values ('manufacturer own read', visible_count = 1, 'visible: ' || visible_count);

  select count(*) into visible_count from public.rfqs where id = other_rfq_id;
  insert into rfq_security_results values ('manufacturer other read blocked', visible_count = 0, 'visible: ' || visible_count);

  insert into public.rfq_messages(rfq_id, sender_profile_id, sender_role, message)
  values (target_rfq_id, manufacturer_owner_id, 'buyer', 'Manufacturer reply.');

  select sender_role into stored_text
  from public.rfq_messages
  where rfq_id = target_rfq_id
    and sender_profile_id = manufacturer_owner_id
  order by created_at desc
  limit 1;
  insert into rfq_security_results values ('manufacturer message role derived by database', stored_text = 'manufacturer', 'sender_role: ' || coalesce(stored_text, '<null>'));

  select count(*) into visible_count from public.rfq_messages where rfq_id = target_rfq_id;
  insert into rfq_security_results values ('message visibility participant', visible_count = 2, 'messages: ' || visible_count);

  select count(*) into visible_count from public.rfq_events where rfq_id = target_rfq_id;
  insert into rfq_security_results values ('event visibility participant', visible_count >= 4, 'events: ' || visible_count);

  perform set_config('request.jwt.claim.sub', other_manufacturer_owner_id::text, true);
  select count(*) into visible_count from public.rfq_messages where rfq_id = target_rfq_id;
  insert into rfq_security_results values ('message visibility blocks unrelated manufacturer', visible_count = 0, 'messages: ' || visible_count);

  select count(*) into visible_count from public.rfq_events where rfq_id = target_rfq_id;
  insert into rfq_security_results values ('event visibility blocks unrelated manufacturer', visible_count = 0, 'events: ' || visible_count);

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  select count(*) into visible_count from public.rfqs where id in (target_rfq_id, other_rfq_id);
  insert into rfq_security_results values ('admin full access', visible_count = 2, 'visible: ' || visible_count);

  blocked := false;
  begin
    update public.rfqs
    set status = 'accepted'
    where id = other_rfq_id;
  exception when others then
    blocked := true;
  end;
  insert into rfq_security_results values ('admin illegal transition blocked', blocked, 'blocked: ' || blocked);
end;
$$;

set local role anon;

do $$
declare
  target_rfq_id uuid;
  blocked boolean := false;
  visible_count integer := 0;
begin
  select subject_id into target_rfq_id from rfq_security_subjects where subject_name = 'rfq';

  begin
    select count(*) into visible_count from public.rfqs where id = target_rfq_id;
  exception when others then
    blocked := true;
  end;
  insert into rfq_security_results values (
    'anonymous rfq blocked',
    blocked or visible_count = 0,
    'blocked: ' || blocked || ', visible: ' || visible_count
  );

  blocked := false;
  visible_count := 0;
  begin
    select count(*) into visible_count from public.rfq_messages where rfq_id = target_rfq_id;
  exception when others then
    blocked := true;
  end;
  insert into rfq_security_results values (
    'anonymous messages blocked',
    blocked or visible_count = 0,
    'blocked: ' || blocked || ', visible: ' || visible_count
  );

  blocked := false;
  visible_count := 0;
  begin
    select count(*) into visible_count from public.rfq_events where rfq_id = target_rfq_id;
  exception when others then
    blocked := true;
  end;
  insert into rfq_security_results values (
    'anonymous events blocked',
    blocked or visible_count = 0,
    'blocked: ' || blocked || ', visible: ' || visible_count
  );
end;
$$;

select check_name, passed, detail
from rfq_security_results
order by check_name;

rollback;
