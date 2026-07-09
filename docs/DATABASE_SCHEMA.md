# Database Schema

## Principles

- Use Supabase Auth for identities.
- Store application profile and role data in public tables tied to `auth.users`.
- Enable Row Level Security on every table.
- Use UUID primary keys and server-generated timestamps.
- Keep AI provider keys, email provider keys, and service-role credentials out of the database and frontend.

## Proposed Tables

### profiles

- `id uuid primary key references auth.users(id)`
- `role text check role in ('buyer', 'manufacturer', 'admin')`
- `full_name text`
- `email text`
- `status text`
- `created_at timestamptz`
- `updated_at timestamptz`

### manufacturers

- `id uuid primary key`
- `owner_id uuid references profiles(id)`
- `company_name text`
- `country text`
- `province text`
- `city text`
- `website text`
- `verification_status text`
- `factory_profile jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

### products

- `id uuid primary key`
- `manufacturer_id uuid references manufacturers(id)`
- `name text`
- `category text`
- `description text`
- `base_price numeric`
- `size_sqft integer`
- `lead_time_weeks integer`
- `status text`
- `specifications jsonb`
- `compliance_notes jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

### product_media

- `id uuid primary key`
- `product_id uuid references products(id)`
- `storage_path text`
- `alt_text text`
- `sort_order integer`
- `created_at timestamptz`

### quote_requests

- `id uuid primary key`
- `buyer_id uuid references profiles(id)`
- `product_id uuid references products(id)`
- `manufacturer_id uuid references manufacturers(id)`
- `status text`
- `budget numeric`
- `destination_state text`
- `destination_zip text`
- `customization jsonb`
- `created_at timestamptz`
- `updated_at timestamptz`

### quotes

- `id uuid primary key`
- `quote_request_id uuid references quote_requests(id)`
- `manufacturer_id uuid references manufacturers(id)`
- `base_price numeric`
- `shipping_estimate numeric`
- `lead_time_days integer`
- `terms text`
- `status text`
- `created_at timestamptz`
- `updated_at timestamptz`

### messages

- `id uuid primary key`
- `quote_request_id uuid references quote_requests(id)`
- `sender_id uuid references profiles(id)`
- `recipient_id uuid references profiles(id)`
- `body text`
- `created_at timestamptz`
- `read_at timestamptz`

### crm_companies

- `id uuid primary key`
- `manufacturer_id uuid references manufacturers(id)`
- `name text`
- `website text`
- `region text`
- `stage text`
- `metadata jsonb`
- `created_at timestamptz`

### crm_contacts

- `id uuid primary key`
- `company_id uuid references crm_companies(id)`
- `name text`
- `email text`
- `phone text`
- `title text`
- `created_at timestamptz`

### email_events

- `id uuid primary key`
- `contact_id uuid references crm_contacts(id)`
- `event_type text`
- `provider_message_id text`
- `subject text`
- `metadata jsonb`
- `created_at timestamptz`

### documents

- `id uuid primary key`
- `owner_id uuid references profiles(id)`
- `quote_request_id uuid references quote_requests(id)`
- `document_type text`
- `storage_path text`
- `status text`
- `created_at timestamptz`

### advisor_sessions

- `id uuid primary key`
- `buyer_id uuid references profiles(id)`
- `title text`
- `context jsonb`
- `created_at timestamptz`

### advisor_messages

- `id uuid primary key`
- `session_id uuid references advisor_sessions(id)`
- `role text`
- `content text`
- `metadata jsonb`
- `created_at timestamptz`

### admin_logs

- `id uuid primary key`
- `actor_id uuid references profiles(id)`
- `action text`
- `entity_type text`
- `entity_id uuid`
- `details jsonb`
- `created_at timestamptz`

## Storage Buckets

- `product-media`: public or signed depending on moderation status.
- `import-documents`: private, signed URL access only.
- `manufacturer-verification`: private, admin/manufacturer scoped.

## RLS Summary

- Buyers can read public approved listings.
- Buyers can manage their own quote requests, messages, documents, and advisor sessions.
- Manufacturers can manage products and quotes tied to their manufacturer record.
- Admins can read and moderate all marketplace records.
- Service-role access is reserved for trusted server jobs only.
