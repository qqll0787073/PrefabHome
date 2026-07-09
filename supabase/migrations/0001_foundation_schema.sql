-- PrefabHome Marketplace Supabase foundation schema draft.
-- Review before production use.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'buyer'
    check (role in ('buyer', 'manufacturer', 'admin')),
  full_name text,
  email text not null,
  status text not null default 'active'
    check (status in ('active', 'pending', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_key on public.profiles (lower(email));

create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  preferred_state text,
  budget_min numeric(12, 2),
  budget_max numeric(12, 2),
  project_timeline text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  company_name text not null,
  country text not null default 'China',
  province text,
  city text,
  website text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected', 'suspended')),
  factory_profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manufacturers_owner_id_idx on public.manufacturers (owner_id);
create index if not exists manufacturers_status_idx on public.manufacturers (verification_status);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  name text not null,
  category text not null,
  description text,
  base_price numeric(12, 2),
  size_sqft integer,
  lead_time_weeks integer,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'active', 'archived', 'rejected')),
  specifications jsonb not null default '{}'::jsonb,
  compliance_notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_manufacturer_id_idx on public.products (manufacturer_id);
create index if not exists products_status_idx on public.products (status);
create index if not exists products_category_idx on public.products (category);

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  manufacturer_id uuid not null references public.manufacturers(id) on delete restrict,
  status text not null default 'submitted'
    check (status in ('submitted', 'reviewing', 'quoted', 'ordered', 'cancelled')),
  budget numeric(12, 2),
  destination_state text,
  destination_zip text,
  customization jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quote_requests_buyer_id_idx on public.quote_requests (buyer_id);
create index if not exists quote_requests_manufacturer_id_idx on public.quote_requests (manufacturer_id);
create index if not exists quote_requests_product_id_idx on public.quote_requests (product_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists messages_quote_request_id_idx on public.messages (quote_request_id);
create index if not exists messages_recipient_id_idx on public.messages (recipient_id);

create table if not exists public.saved_products (
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (buyer_id, product_id)
);

create index if not exists saved_products_product_id_idx on public.saved_products (product_id);

create table if not exists public.manufacturer_outreach (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers(id) on delete cascade,
  contact_name text,
  contact_email text,
  company_name text not null,
  stage text not null default 'prospect'
    check (stage in ('prospect', 'contacted', 'replied', 'qualified', 'rejected')),
  last_contacted_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists manufacturer_outreach_manufacturer_id_idx
  on public.manufacturer_outreach (manufacturer_id);
create index if not exists manufacturer_outreach_stage_idx
  on public.manufacturer_outreach (stage);

create table if not exists public.import_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  quote_request_id uuid references public.quote_requests(id) on delete set null,
  document_type text not null,
  storage_path text not null,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'reviewing', 'accepted', 'rejected', 'expired')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists import_documents_owner_id_idx on public.import_documents (owner_id);
create index if not exists import_documents_quote_request_id_idx
  on public.import_documents (quote_request_id);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_buyers_updated_at
before update on public.buyers
for each row execute function public.set_updated_at();

create trigger set_manufacturers_updated_at
before update on public.manufacturers
for each row execute function public.set_updated_at();

create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger set_quote_requests_updated_at
before update on public.quote_requests
for each row execute function public.set_updated_at();

create trigger set_manufacturer_outreach_updated_at
before update on public.manufacturer_outreach
for each row execute function public.set_updated_at();

create trigger set_import_documents_updated_at
before update on public.import_documents
for each row execute function public.set_updated_at();
