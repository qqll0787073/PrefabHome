# API And RPC Reference

## Architecture

The browser uses `@supabase/supabase-js` through `src/lib/supabase.ts`. Data-access and validation helpers live in `src/lib`; React components should not recreate authorization logic. Supabase Auth, RLS, constraints, triggers, and trusted RPCs remain authoritative.

This is an application reference, not a promise that every database function is a public API. Functions named `assert_*`, `build_*`, `insert_trusted_*`, `protect_*`, `strip_*`, `is_trusted_*`, and number generators are internal/trigger helpers and must not be granted to ordinary clients.

## Client Configuration

- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: browser-safe publishable/anon key
- `VITE_ENABLE_MARKETPLACE_DEMO`: explicit local marketplace demo flag; default `false`

Never expose a service-role key through Vite. The client persists and refreshes Auth sessions and detects confirmation redirects.

## Data Surfaces

| Area | Frontend module | Read/write model |
| --- | --- | --- |
| Auth/profile | `src/lib/auth.ts` | Supabase Auth plus protected `profiles` row |
| Manufacturer onboarding | `src/lib/manufacturers.ts` | RLS-protected table operations and database lifecycle trigger |
| Products | `src/lib/products.ts` | Private table workflows plus public-safe published projection |
| Product media | `src/lib/productMedia.ts` | Private buckets, protected metadata, atomic primary-image RPC, signed URLs |
| Marketplace | `src/lib/marketplace.ts` | Public-safe views only; no private Product/onboarding fields |
| RFQ/messages | `src/lib/rfq.ts` | Participant/Admin RLS plus trusted event generation |
| Quotes/decisions | `src/lib/quotes.ts`, `quoteDecisions.ts` | Trusted versioning, submission, opened, and decision RPCs |
| Purchase Orders | `src/lib/purchaseOrders.ts` | Trusted lifecycle RPCs and immutable snapshots/items |
| Contracts/signatures | `src/lib/contracts.ts`, `signaturePreparation.ts`, `signatureDelivery.ts` | Trusted lifecycle/preparation RPCs |
| Invoices/payments | `src/lib/invoices.ts`, `payments.ts` | Trusted issue/cancel/record/void RPCs |
| Shipping/logistics | `src/lib/shippingReadiness.ts`, `logisticsBookingRequests.ts`, `logisticsArrangement.ts` | Trusted lifecycle RPCs and separated safe/Admin read RPCs |

## Trusted Authenticated RPCs

The caller must have a valid authenticated session and the role/ownership/status required by the database. Parameters and return records are typed in `src/types.ts` and `src/lib/supabase.types.ts`.

| Domain | RPCs | Intended authority |
| --- | --- | --- |
| Product media | `set_primary_product_media` | Owning approved Manufacturer or Admin; atomic valid-image selection |
| Quote authoring | `create_rfq_quote_draft`, `submit_rfq_quote`, `create_rfq_quote_revision`, `delete_rfq_quote_draft` | Assigned Manufacturer |
| Quote review | `record_rfq_quote_opened`, `accept_rfq_quote`, `reject_rfq_quote`, `request_rfq_quote_revision` | Owning Buyer and current submitted Quote |
| Purchase Order | `create_purchase_order_from_quote`, `update_purchase_order_draft`, `submit_purchase_order`, `cancel_purchase_order_draft`, `record_purchase_order_opened`, `request_purchase_order_revision`, `update_purchase_order_revision`, `resubmit_purchase_order`, `confirm_purchase_order`, `reject_purchase_order` | Owning Buyer or assigned Manufacturer by transition |
| Contract | `create_contract_from_po`, `update_contract_draft`, `mark_contract_ready`, `record_contract_opened`, `accept_contract`, `reject_contract`, `request_contract_revision`, `update_contract_revision`, `resubmit_contract` | Admin or participant by transition |
| Signature preparation | `create_signature_package`, `update_buyer_signature_participant`, `update_manufacturer_signature_participant`, `mark_signature_package_ready` | Admin/participant by action |
| Signature delivery | `create_signature_delivery_request`, `queue_signature_delivery_request`, `cancel_signature_delivery_request` | Admin preparation workflow; no provider call |
| Invoice | `create_invoice_from_purchase_order`, `update_invoice_draft`, `issue_invoice`, `cancel_invoice` | Assigned Manufacturer lifecycle |
| Payment recording | `create_payment_record`, `update_payment_record_draft`, `record_payment`, `void_payment_record`, `get_invoice_payment_summary` | Authorized recording/read flow; external payments only |
| Shipping Readiness | `create_shipping_readiness`, `update_shipping_readiness_draft`, `mark_shipping_readiness_ready`, `cancel_shipping_readiness` | Assigned Manufacturer lifecycle |
| Logistics Booking Request | `create_logistics_booking_request`, `update_logistics_booking_request_draft`, `submit_logistics_booking_request`, `withdraw_logistics_booking_request` | Assigned Manufacturer lifecycle |

## Logistics Arrangement Read Boundary

Participant-safe reads:

- `get_participant_logistics_provider_candidates`
- `get_participant_logistics_provider_selections`
- `get_participant_logistics_arrangement_events`

These require booking-request ownership and return fixed safe columns. They exclude provider contacts, quote references, internal notes, actor IDs, metadata, and internal record versions.

Admin full reads:

- `admin_list_logistics_provider_candidates`
- `admin_list_logistics_provider_selections`
- `admin_list_logistics_arrangement_events`

Admin mutations:

- `admin_create_logistics_provider_candidate`
- `admin_update_logistics_provider_candidate`
- `admin_withdraw_logistics_provider_candidate`
- `admin_select_logistics_provider_candidate`
- `admin_cancel_logistics_provider_selection`
- `admin_mark_ready_for_external_booking`

`provider_type` identifies the organization role; `transport_mode` independently identifies ocean, air, trucking, rail, multimodal, or other service.

## Error Handling

Service modules translate common lifecycle and validation failures into readable errors. Clients should refetch after conflicts and must not retry non-idempotent mutations blindly. Never log Auth credentials, session tokens, service keys, or full signed URLs.

## Change Rules

- Add database changes in a new migration after the latest applied version.
- Revoke `EXECUTE` from `PUBLIC`, `anon`, and `authenticated` for internal security-definer helpers.
- Grant only intended callable RPCs.
- Update handwritten types, service wrappers, SQL rollback tests, frontend tests, and this reference together.
