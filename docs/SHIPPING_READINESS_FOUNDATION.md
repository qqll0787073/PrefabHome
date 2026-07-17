# PH-010A Shipping Readiness Foundation

PH-010A adds internal shipping-readiness preparation for confirmed Purchase Orders that already have an accepted Contract and issued Invoice. It does not book carriers, arrange freight, create tracking, generate BOLs or labels, calculate tariffs, process customs, insure shipments, or call logistics providers.

## Tables

- `public.shipping_readiness_records`
  - One record per Purchase Order.
  - Generated `shipping_number` format: `SHP-YYYY-NNNNNN`.
  - Statuses: `shipping_draft`, `ready_for_logistics`, `cancelled`.
  - Modes: `ocean`, `air`, `truck`, `rail`, `multimodal`, `other`.
  - Incoterms: `EXW`, `FCA`, `FOB`, `CFR`, `CIF`, `CPT`, `CIP`, `DAP`, `DPU`, `DDP`, `OTHER`, `UNSPECIFIED`.
  - Immutable source references and snapshots for Purchase Order, Contract, Invoice, cargo, and readiness values.
- `public.shipping_readiness_events`
  - Trusted lifecycle timeline.
  - Event types: `shipping_readiness_created`, `shipping_readiness_updated`, `shipping_readiness_marked_ready`, `shipping_readiness_cancelled`.

## Eligibility

A Manufacturer may create a shipping readiness record only when:

- The Purchase Order is `confirmed`.
- The source Contract is `accepted`.
- The source Invoice is `issued`.
- The Manufacturer owns the assigned manufacturer profile.
- No shipping readiness record already exists for that Purchase Order.

Payments, signatures, customs, carrier credentials, provider integrations, labels, BOLs, and tracking are intentionally not prerequisites for PH-010A.

## Address Schema

Supported address fields:

- `address_line1`
- `address_line2`
- `city`
- `state_region`
- `postal_code`
- `country_code`

Drafts may store partial addresses. Before marking ready, both origin and destination must include all required fields except `address_line2`. Address values are trimmed, `country_code` is uppercased, blank optional values are omitted, and unsupported keys are dropped.

## Ready Requirements

Before `mark_shipping_readiness_ready`, the record must contain:

- Complete origin and destination addresses.
- Non-empty `cargo_description` within the configured limit.
- `package_count > 0`.
- `gross_weight_kg > 0`.
- `volume_cbm > 0`.
- `estimated_ready_date >= current_date`.
- `requested_ship_date >= current_date`.
- `requested_ship_date >= estimated_ready_date`.

The date validator is `STABLE` because it uses database `current_date`.

## RPCs

- `create_shipping_readiness(purchase_order_uuid)`
  - Creates a draft and trusted created event.
- `update_shipping_readiness_draft(...)`
  - Updates draft-only planning fields and trusted updated event.
- `mark_shipping_readiness_ready(shipping_uuid)`
  - Freezes the record as `ready_for_logistics`, sets `ready_at`, and creates a trusted marked-ready event.
- `cancel_shipping_readiness(shipping_uuid, reason_text)`
  - Cancels a draft or ready record, sets `cancelled_at`, stores a reason, and creates a trusted cancelled event.

All direct table writes are denied by trigger-level protections. Lifecycle RPCs lock the target row with `FOR UPDATE` and use state-conditional updates with `RETURNING`.

## Authorization

- Anonymous users cannot read or mutate shipping readiness records.
- Buyer users can read records for their own Purchase Orders.
- Assigned Manufacturers can read and manage their own draft/ready shipping records through RPCs.
- Admins can read all records and events.
- Buyers, Admins, other Manufacturers, and Anonymous users cannot mutate records.
- Events are immutable and only created by trusted database functions.

## UI

- Manufacturer Portal: create eligible records, save drafts, mark ready, cancel, and view timeline.
- Buyer Portal: read-only shipping readiness records and timeline.
- Admin Portal: read-only records, snapshots, and timeline.

All UI copy states that readiness does not mean a carrier is booked, freight is arranged, pickup is scheduled, shipment is dispatched, customs service is confirmed, or delivery is complete.

## Verification

Rollback-only SQL verification lives in:

- `supabase/tests/shipping_readiness_foundation_security.sql`

Frontend helper tests live in:

- `src/lib/shippingReadiness.test.ts`
