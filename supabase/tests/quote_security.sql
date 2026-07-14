begin;

create temp table quote_security_results (
  check_name text primary key,
  passed boolean not null,
  detail text not null
) on commit drop;

create temp table quote_security_subjects (
  subject_name text primary key,
  subject_id uuid not null
) on commit drop;

grant select, insert on quote_security_results to anon, authenticated;
grant select, insert on quote_security_subjects to anon, authenticated;

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
    ('00000000-0000-0000-0000-000000000000', buyer_id, 'authenticated', 'authenticated', 'quote-buyer-' || buyer_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Quote Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_buyer_id, 'authenticated', 'authenticated', 'quote-other-buyer-' || other_buyer_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Quote Other Buyer","role":"buyer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', manufacturer_owner_id, 'authenticated', 'authenticated', 'quote-manufacturer-' || manufacturer_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Quote Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', other_manufacturer_owner_id, 'authenticated', 'authenticated', 'quote-other-manufacturer-' || other_manufacturer_owner_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Quote Other Manufacturer","role":"manufacturer"}'::jsonb, now(), now(), false, false),
    ('00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', 'quote-admin-' || admin_id || '@example.test', 'placeholder', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Quote Admin","role":"buyer"}'::jsonb, now(), now(), false, false);

  update public.profiles set role = 'admin' where id = admin_id;

  insert into quote_security_subjects(subject_name, subject_id)
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
  buyer_id uuid;
  other_buyer_id uuid;
  manufacturer_owner_id uuid;
  other_manufacturer_owner_id uuid;
  admin_id uuid;
  manufacturer_id uuid;
  other_manufacturer_id uuid;
  product_id uuid;
  draft_product_id uuid;
  rfq_id uuid;
  draft_rfq_id uuid;
  quote_id uuid;
  draft_quote_id uuid;
  revision_quote_id uuid;
  empty_revision_quote_id uuid;
  item_id uuid;
  visible_count integer := 0;
  stored_text text;
  stored_uuid uuid;
  stored_integer integer;
  stored_numeric numeric;
  blocked boolean := false;
begin
  select subject_id into buyer_id from quote_security_subjects where subject_name = 'buyer';
  select subject_id into other_buyer_id from quote_security_subjects where subject_name = 'other_buyer';
  select subject_id into manufacturer_owner_id from quote_security_subjects where subject_name = 'manufacturer_owner';
  select subject_id into other_manufacturer_owner_id from quote_security_subjects where subject_name = 'other_manufacturer_owner';
  select subject_id into admin_id from quote_security_subjects where subject_name = 'admin';

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (manufacturer_owner_id, 'Quote Factory Legal', 'Quote Factory', 'China', 'draft')
  returning id into manufacturer_id;

  insert into public.manufacturers(owner_id, company_name, company_display_name, country, application_status)
  values (other_manufacturer_owner_id, 'Other Quote Factory Legal', 'Other Quote Factory', 'Vietnam', 'draft')
  returning id into other_manufacturer_id;

  update public.manufacturers
  set application_status = 'approved',
      reviewed_by = admin_id,
      reviewed_at = now()
  where id in (manufacturer_id, other_manufacturer_id);

  insert into public.products(manufacturer_id, name, category, currency, status)
  values (manufacturer_id, 'Quote Test Product', 'Modular', 'USD', 'published')
  returning id into product_id;

  insert into public.products(manufacturer_id, name, category, currency, status)
  values (manufacturer_id, 'Quote Draft Product', 'Modular', 'USD', 'published')
  returning id into draft_product_id;

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);

  insert into public.rfqs (
    buyer_id,
    manufacturer_id,
    product_id,
    status,
    requested_quantity,
    requested_currency,
    destination_country,
    destination_port,
    buyer_message
  )
  values (
    buyer_id,
    manufacturer_id,
    product_id,
    'submitted',
    2,
    'USD',
    'Canada',
    'Vancouver',
    'Please quote.'
  )
  returning id into rfq_id;

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
    draft_product_id,
    'submitted',
    1,
    'USD',
    'Canada'
  )
  returning id into draft_rfq_id;

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);

  update public.rfqs
  set status = 'manufacturer_review'
  where id in (rfq_id, draft_rfq_id);

  insert into quote_security_subjects(subject_name, subject_id)
  values
    ('manufacturer', manufacturer_id),
    ('other_manufacturer', other_manufacturer_id),
    ('rfq', rfq_id),
    ('draft_rfq', draft_rfq_id);

  select id into quote_id from public.create_rfq_quote_draft(rfq_id);

  insert into quote_security_subjects(subject_name, subject_id)
  values ('quote', quote_id);

  insert into public.rfq_quote_items(quote_id, line_order, item_type, description, quantity, unit, unit_price)
  values (quote_id, 1, 'product', 'Base prefab unit', 2, 'unit', 125000)
  returning id into item_id;

  select q.manufacturer_id, q.created_by, q.version, q.subtotal
  into stored_uuid, stored_text, stored_integer, stored_numeric
  from public.rfq_quotes q
  where q.id = quote_id;

  insert into quote_security_results values (
    'ownership fields database-derived',
    stored_uuid = manufacturer_id and stored_text::uuid = manufacturer_owner_id and stored_integer = 1,
    'manufacturer_id: ' || stored_uuid || ', created_by: ' || stored_text || ', version: ' || stored_integer
  );

  insert into quote_security_results values (
    'version database-derived',
    stored_integer = 1,
    'version: ' || stored_integer
  );

  insert into quote_security_results values (
    'amount database-derived',
    exists (select 1 from public.rfq_quote_items where id = item_id and amount = 250000),
    'item amount checked'
  );

  insert into quote_security_results values (
    'subtotal database-derived',
    exists (select 1 from public.rfq_quotes where id = quote_id and subtotal = 250000),
    'quote subtotal checked'
  );

  insert into quote_security_results values (
    'normal item trigger recalculation works',
    exists (select 1 from public.rfq_quotes where id = quote_id and subtotal = 250000),
    'subtotal recalculated by trigger'
  );

  update public.rfq_quotes
  set origin_port = 'Shanghai'
  where id = quote_id;

  insert into quote_security_results values (
    'draft edit allowed',
    exists (select 1 from public.rfq_quotes where id = quote_id and origin_port = 'Shanghai'),
    'draft origin_port editable'
  );

  blocked := false;
  begin
    insert into public.rfq_quote_items(quote_id, line_order, item_type, description, quantity, unit_price)
    values (quote_id, 2, 'freight', 'Invalid quantity', 0, 10);
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('invalid quantity denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    insert into public.rfq_quote_items(quote_id, line_order, item_type, description, quantity, unit_price)
    values (quote_id, 2, 'freight', 'Invalid price', 1, -10);
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('invalid price denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    update public.rfq_quotes set currency = 'US' where id = quote_id;
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('invalid currency denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    update public.rfq_quotes set incoterm = 'BAD' where id = quote_id;
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('invalid incoterm denied', blocked, 'blocked: ' || blocked);

  select id into quote_id from public.submit_rfq_quote(quote_id);

  insert into quote_security_results values (
    'trusted submission moves rfq to quoted',
    exists (select 1 from public.rfqs where id = rfq_id and status = 'quoted'),
    'rfq status checked'
  );

  insert into quote_security_results values (
    'trusted submission creates quote_created event',
    exists (
      select 1 from public.rfq_events e
      where e.rfq_id = (select subject_id from quote_security_subjects where subject_name = 'rfq')
        and e.event_type = 'quote_created'
        and e.actor_profile_id = manufacturer_owner_id
        and e.metadata->>'quote_id' = quote_id::text
    ),
    'quote_created event checked'
  );

  blocked := false;
  begin
    update public.rfq_quotes set origin_port = 'Ningbo' where id = quote_id;
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values (
    'submitted quote immutable',
    blocked or exists (select 1 from public.rfq_quotes where id = quote_id and origin_port = 'Shanghai'),
    'blocked: ' || blocked
  );

  blocked := false;
  begin
    update public.rfq_quote_items set description = 'Changed' where id = item_id;
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values (
    'submitted quote items immutable',
    blocked or exists (select 1 from public.rfq_quote_items where id = item_id and description = 'Base prefab unit'),
    'blocked: ' || blocked
  );

  blocked := false;
  begin
    select id into quote_id from public.submit_rfq_quote(quote_id);
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('duplicate submit blocked', blocked, 'blocked: ' || blocked);

  select id into draft_quote_id from public.create_rfq_quote_draft(draft_rfq_id);

  blocked := false;
  begin
    select id into draft_quote_id from public.submit_rfq_quote(draft_quote_id);
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('empty quote submission denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', other_manufacturer_owner_id::text, true);
  select count(*) into visible_count from public.rfq_quotes where id = quote_id;
  insert into quote_security_results values ('other manufacturer read denied', visible_count = 0, 'visible: ' || visible_count);

  blocked := false;
  begin
    update public.rfq_quotes set origin_port = 'Haiphong' where id = draft_quote_id;
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('other manufacturer draft edit denied', blocked or not found, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', buyer_id::text, true);
  select count(*) into visible_count from public.rfq_quotes where id = quote_id;
  insert into quote_security_results values ('buyer own submitted quote read', visible_count = 1, 'visible: ' || visible_count);

  select count(*) into visible_count from public.rfq_quotes where id = draft_quote_id;
  insert into quote_security_results values ('buyer draft quote hidden', visible_count = 0, 'visible: ' || visible_count);

  perform set_config('request.jwt.claim.sub', other_buyer_id::text, true);
  select count(*) into visible_count from public.rfq_quotes where id = quote_id;
  insert into quote_security_results values ('other buyer read denied', visible_count = 0, 'visible: ' || visible_count);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);
  select count(*) into visible_count from public.rfq_quotes where id = quote_id;
  insert into quote_security_results values ('manufacturer own quote read', visible_count = 1, 'visible: ' || visible_count);

  blocked := false;
  begin
    insert into public.rfq_events(rfq_id, event_type, actor_profile_id, metadata)
    values (rfq_id, 'quote_created', manufacturer_owner_id, '{}'::jsonb);
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('direct quote_created event denied', blocked, 'blocked: ' || blocked);

  select id into revision_quote_id from public.create_rfq_quote_revision(quote_id);
  insert into quote_security_results values (
    'revision creates version plus one',
    exists (select 1 from public.rfq_quotes where id = revision_quote_id and version = 2 and status = 'draft'),
    'revision quote checked'
  );

  insert into quote_security_results values (
    'revision copies line items',
    exists (
      select 1
      from public.rfq_quote_items item
      where item.quote_id = revision_quote_id
        and item.description = 'Base prefab unit'
    ),
    'revision item checked'
  );

  select id into revision_quote_id from public.submit_rfq_quote(revision_quote_id);

  insert into quote_security_results values (
    'revision submission succeeds while rfq quoted',
    exists (select 1 from public.rfq_quotes where id = revision_quote_id and status = 'submitted'),
    'revision submitted'
  );

  insert into quote_security_results values (
    'previous quote superseded on revision submission',
    exists (select 1 from public.rfq_quotes where id = quote_id and status = 'superseded'),
    'previous quote status checked'
  );

  insert into quote_security_results values (
    'rfq remains quoted after revision submission',
    exists (select 1 from public.rfqs where id = rfq_id and status = 'quoted'),
    'rfq status checked'
  );

  insert into quote_security_results values (
    'revision quote_created event created',
    exists (
      select 1 from public.rfq_events e
      where e.rfq_id = (select subject_id from quote_security_subjects where subject_name = 'rfq')
        and e.event_type = 'quote_created'
        and e.actor_profile_id = manufacturer_owner_id
        and e.metadata->>'quote_id' = revision_quote_id::text
        and e.metadata->>'version' = '2'
    ),
    'revision quote_created event checked'
  );

  insert into quote_security_results values (
    'only one submitted quote remains per rfq',
    (
      select count(*)
      from public.rfq_quotes q
      where q.rfq_id = (select subject_id from quote_security_subjects where subject_name = 'rfq')
        and q.status = 'submitted'
    ) = 1,
    'current submitted quote count checked'
  );

  blocked := false;
  begin
    select id into revision_quote_id from public.submit_rfq_quote(revision_quote_id);
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('duplicate revision submit denied', blocked, 'blocked: ' || blocked);

  select id into empty_revision_quote_id from public.create_rfq_quote_revision(revision_quote_id);

  delete from public.rfq_quote_items item where item.quote_id = empty_revision_quote_id;

  blocked := false;
  begin
    select id into empty_revision_quote_id from public.submit_rfq_quote(empty_revision_quote_id);
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('empty revision submission denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', other_manufacturer_owner_id::text, true);

  blocked := false;
  begin
    select id into empty_revision_quote_id from public.submit_rfq_quote(empty_revision_quote_id);
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('other manufacturer submit denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', manufacturer_owner_id::text, true);

  blocked := false;
  begin
    perform public.recalculate_rfq_quote_subtotal(revision_quote_id);
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('direct subtotal helper invocation denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    perform public.insert_trusted_rfq_event(rfq_id, 'quote_created', manufacturer_owner_id, '{}'::jsonb);
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('direct trusted event helper invocation denied', blocked, 'blocked: ' || blocked);

  blocked := false;
  begin
    perform public.is_trusted_quote_write();
  exception when others then
    blocked := true;
  end;
  insert into quote_security_results values ('direct trusted write helper invocation denied', blocked, 'blocked: ' || blocked);

  perform set_config('request.jwt.claim.sub', admin_id::text, true);
  select count(*) into visible_count from public.rfq_quotes where id in (quote_id, draft_quote_id, revision_quote_id, empty_revision_quote_id);
  insert into quote_security_results values ('admin read all quotes', visible_count = 4, 'visible: ' || visible_count);
end;
$$;

set local role anon;

do $$
declare
  quote_id uuid;
  visible_count integer := 0;
  blocked boolean := false;
begin
  select subject_id into quote_id
  from quote_security_subjects
  where subject_name = 'quote';

  begin
    select count(*) into visible_count from public.rfq_quotes where id = quote_id;
  exception when others then
    blocked := true;
  end;

  insert into quote_security_results values (
    'anonymous denied',
    blocked or visible_count = 0,
    'blocked: ' || blocked || ', visible: ' || visible_count
  );
end;
$$;

select check_name, passed, detail
from quote_security_results
order by check_name;

rollback;
