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

## Frontend Service Inventory

Each function below uses the configured Supabase browser client. Result types are records or arrays from `src/types.ts`; database failures are thrown as readable `Error` values. Role statements describe intended callers, while RLS/RPC authority remains final.

| Domain and source | Callable service functions | Inputs and result | Roles/lifecycle/failures |
| --- | --- | --- | --- |
| Auth, `src/lib/auth.ts` | `useAuth` (`login`, `register`, `logout`, session restore/profile load) | Credentials/registration role; returns current `AuthState` | Buyer/Manufacturer self-registration only; Admin metadata is sanitized. Confirmation, invalid credentials, missing profile, and session errors are surfaced. |
| Manufacturers, `src/lib/manufacturers.ts` | `fetchOwnManufacturerApplication`, `fetchManufacturerApplications`, `createManufacturerApplication`, `updateManufacturerApplication`, `submitManufacturerApplication`, `reviewManufacturerApplication` | Owner/application IDs and normalized form/review values; returns application record(s) | Manufacturer owns one draft/rejected application; Admin reviews all. Duplicate owner, locked status, validation, cross-owner, and role escalation are denied. |
| Products, `src/lib/products.ts` | `fetchPublishedProducts`, `fetchOwnProducts`, `fetchAllProductsForAdmin`, `fetchProductById`, `createProductDraft`, `updateProductDraft`, `submitProduct`, `adminReviewProduct`, `archiveProduct` | Owner/Product IDs, Product payload, requested legal transition; returns public/private Product record(s) | Approved Manufacturer manages own editable Product; Admin uses transition matrix. Unapproved owner, stale/illegal transition, duplicate slug/validation, and private read fail. |
| Product media, `src/lib/productMedia.ts` | `fetchOwnProductMedia`, `fetchPublicProductMedia`, `fetchAllProductMediaForAdmin`, `createProductMediaRecord`, `uploadProductImage`, `uploadProductDocument`, `updateProductMediaMetadata`, `setPrimaryProductImage`, `deleteProductMedia`, signed URL helpers | Product/media IDs, file, metadata, expiry; returns media records/authorized URL | Owner/Admin private reads; public projection for published public images. Invalid MIME/size/path, document visibility, direct primary mutation, ownership, and expired URL fail. |
| Marketplace, `src/lib/marketplace.ts` | `fetchMarketplaceProducts`, `fetchMarketplaceProductBySlug`, `fetchMarketplaceProductById`, `fetchMarketplaceProductImages`, `fetchMarketplaceFilterOptions`, `resolveMarketplaceImageUrls` | Search/filter/sort/page or Product identifier; returns public Product page/detail/options | Anonymous/Buyer-safe projection only. Missing config fails unless local demo explicitly enabled; unpublished/private/internal fields never map. |
| RFQ, `src/lib/rfq.ts` | `createDraftRFQ`, `submitRFQ`, `fetchBuyerRFQs`, `fetchManufacturerRFQs`, `fetchAdminRFQs`, `fetchRFQ`, `postRFQMessage`, `fetchRFQMessages`, `fetchRFQEvents`, `cancelDraftRFQ`, `deleteDraftRFQ` | Participant/Product/RFQ IDs, request form, message; returns RFQ/detail/message/event records | Buyer owns request fields; assigned Manufacturer reviews/replies; Admin reads. Invalid transition, immutable snapshot/Buyer field edit, other participant, forged event, and message validation fail. |
| Quotes, `src/lib/quotes.ts` and `quoteDecisions.ts` | `createQuoteDraft`, `submitQuote`, `createQuoteRevision`, `deleteQuoteDraft`, `fetchQuote`, `fetchQuotesForRFQ`, role fetch helpers, `updateQuoteDraft`, `addQuoteItem`, `updateQuoteItem`, `deleteQuoteItem`, `markQuoteOpened`, `acceptQuote`, `rejectQuote`, `requestQuoteRevision`, decision fetch helpers | RFQ/Quote/item IDs, quote values, reason; returns versioned Quotes/items/decision | Assigned Manufacturer authors drafts; owning Buyer opens/decides current submitted version. Empty submit, duplicate submit, stale version, other participant, and arbitrary event insert fail. |
| Purchase Orders, `src/lib/purchaseOrders.ts` | Create-from-Quote, draft/revision update, submit/resubmit/cancel, opened/confirm/reject/request-revision, role fetch/event helpers | Quote/PO IDs, draft values/reason; returns PO, copied items/snapshots/events | Owning Buyer authors/resubmits; assigned Manufacturer reviews; Admin reads. Duplicate PO, stale status, commercial snapshot mutation, forged timestamps/events fail. |
| Contracts, `src/lib/contracts.ts` | Create-from-PO, draft/revision update, ready/resubmit/opened/accept/reject/request-revision, role fetch/event/decision helpers | PO/Contract IDs, content/reason; returns Contract/snapshots/events/decisions | Admin prepares; Buyer/Manufacturer review by status. Ineligible PO, incomplete ready values, stale round, cross-participant, snapshot mutation fail. |
| Signature preparation/delivery, `src/lib/signaturePreparation.ts`, `signatureDelivery.ts` | Package create, participant updates, ready; delivery create/queue/cancel; role fetch/event/recipient helpers | Contract/package/delivery IDs, signer values/cancel reason; returns preparation records | Participants edit own signer record; Admin prepares lifecycle. Incomplete participants, duplicate package/delivery, concurrent transition, or provider-execution assumptions fail. No provider call occurs. |
| Invoices, `src/lib/invoices.ts` | Create-from-PO, draft update, issue/cancel, role fetch/item/event helpers | PO/Invoice IDs, billing/amount values, reason; returns Invoice/snapshot/items/events | Assigned Manufacturer authors; participants/Admin read. Ineligible PO, incomplete billing address, amount mismatch, stale/immutable status fail. |
| Payments, `src/lib/payments.ts` | `createPaymentRecord`, `updatePaymentRecordDraft`, `recordPayment`, `voidPaymentRecord`, `fetchInvoicePaymentSummary`, role fetch/event helpers | Invoice/payment IDs, amount/method/date/reference/reason; returns record/summary/events | Authorized Manufacturer records external payment; participants/Admin read. Future date, overpayment, immutable status, forged timestamp, and invalid void fail. No money moves. |
| Shipping Readiness, `src/lib/shippingReadiness.ts` | Create, draft update, mark ready, cancel, role fetch/event helpers | PO/shipping ID, cargo/address/planning values/reason; returns readiness/snapshot/events | Assigned Manufacturer authors; Buyer/Admin read. Ineligible PO/Contract/Invoice, incomplete ready fields, stale status, forged event fail. |
| Logistics Booking, `src/lib/logisticsBookingRequests.ts` | Create, draft update, submit, withdraw, role fetch/event helpers | Shipping/request ID, locations/mode/dates/reason; returns booking request/snapshots/events | Assigned Manufacturer authors; Buyer/Admin read. Ineligible readiness, incomplete submission, invalid dates/mode, stale status, cross-owner fail. |
| Logistics Arrangement, `src/lib/logisticsArrangement.ts` | Participant/Admin read helpers; candidate create/update/withdraw; selection select/cancel; readiness action | Booking/candidate ID, provider values, reason/replace flag; returns safe or internal candidates/selections/events | Buyer/Manufacturer safe reads; Admin full read/mutations. Invalid role/mode, unrelated request, cross-request selection, incomplete readiness, current-selection conflict fail. |

## Trusted Authenticated RPCs

The caller must have a valid authenticated session and the role/ownership/status required by the database. Parameters and return records are typed in `src/types.ts` and `src/lib/supabase.types.ts`.

| Domain | Migration source | RPCs | Inputs/result and lifecycle authority |
| --- | --- | --- | --- |
| Product media | `0008_product_media_foundation.sql` | `set_primary_product_media` | Product/media UUID; returns selected media. Owner/Admin only, valid image in same Product; atomically replaces primary. |
| Quote authoring | `0012_quote_builder.sql` | `create_rfq_quote_draft`, `submit_rfq_quote`, `create_rfq_quote_revision`, `delete_rfq_quote_draft` | RFQ/Quote UUID and draft metadata; returns versioned Quote. Assigned Manufacturer; only draft submits, revision supersedes current atomically. |
| Quote review | `0013_buyer_quote_review.sql` | `record_rfq_quote_opened`, `accept_rfq_quote`, `reject_rfq_quote`, `request_rfq_quote_revision` | Current Quote UUID and optional reason; returns decision/transition. Owning Buyer only; opened events deduplicate per version. |
| Purchase Order | `0014_purchase_order_foundation.sql`, `0015_manufacturer_po_confirmation.sql` | `create_purchase_order_from_quote`, `update_purchase_order_draft`, `submit_purchase_order`, `cancel_purchase_order_draft`, `record_purchase_order_opened`, `request_purchase_order_revision`, `update_purchase_order_revision`, `resubmit_purchase_order`, `confirm_purchase_order`, `reject_purchase_order` | Quote/PO UUID, draft/reason; returns PO. Buyer authors, assigned Manufacturer reviews; immutable submitted/terminal snapshots and DB timestamps. |
| Contract | `0016_contract_foundation.sql`, `0017_contract_participant_review.sql` | `create_contract_from_po`, `update_contract_draft`, `mark_contract_ready`, `record_contract_opened`, `accept_contract`, `reject_contract`, `request_contract_revision`, `update_contract_revision`, `resubmit_contract` | PO/Contract UUID, terms/reason; returns Contract. Admin prepares, participants review; immutable snapshots and review rounds. |
| Signature preparation | `0018_signature_preparation.sql` | `create_signature_package`, `update_buyer_signature_participant`, `update_manufacturer_signature_participant`, `mark_signature_package_ready` | Contract/package UUID and signer identity; returns package/participant. Own participant edits only; Admin readies complete package. |
| Signature delivery | `0019_signature_delivery_foundation.sql` | `create_signature_delivery_request`, `queue_signature_delivery_request`, `cancel_signature_delivery_request` | Package/delivery UUID and cancel reason; returns delivery request. Admin preparation lifecycle with row locks; exactly one event per transition; no provider call. |
| Invoice | `0020_invoice_foundation.sql` | `create_invoice_from_purchase_order`, `update_invoice_draft`, `issue_invoice`, `cancel_invoice` | PO/Invoice UUID, billing/amount/reason; returns Invoice. Assigned Manufacturer; strict complete address at issue and immutable issued/cancelled states. |
| Payment recording | `0021_payment_recording_foundation.sql` | `create_payment_record`, `update_payment_record_draft`, `record_payment`, `void_payment_record`, `get_invoice_payment_summary` | Invoice/payment UUID, amount/method/date/reference/reason; returns record or summary. External historical/today payment only; no processing. |
| Shipping Readiness | `0022_shipping_readiness_foundation.sql` | `create_shipping_readiness`, `update_shipping_readiness_draft`, `mark_shipping_readiness_ready`, `cancel_shipping_readiness` | PO/shipping UUID, cargo/address/planning/reason; returns readiness. Manufacturer lifecycle; `ready` is preparation, not shipment execution. |
| Logistics Booking | `0023_logistics_booking_request_foundation.sql` | `create_logistics_booking_request`, `update_logistics_booking_request_draft`, `submit_logistics_booking_request`, `withdraw_logistics_booking_request` | Shipping/request UUID, locations/mode/dates/reason; returns request. Manufacturer lifecycle; submission does not contact a provider. |

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

All Logistics Arrangement RPCs are defined in `supabase/migrations/0024_logistics_arrangement_workspace_foundation.sql`. Read inputs are an optional booking-request UUID and return typed sets. Mutation inputs are booking/candidate UUIDs, normalized provider fields, reason, and replacement intent; they return the affected candidate, selection, or booking request. Anonymous, unrelated participant, invalid lifecycle, unsupported provider/mode, cross-request selection, incomplete estimate, and stale-current-selection calls fail.

`provider_type` identifies the organization role; `transport_mode` independently identifies ocean, air, trucking, rail, multimodal, or other service.

## Error Handling

Service modules translate common lifecycle and validation failures into readable errors. Clients should refetch after conflicts and must not retry non-idempotent mutations blindly. Never log Auth credentials, session tokens, service keys, or full signed URLs.

## Change Rules

- Add database changes in a new migration after the latest applied version.
- Revoke `EXECUTE` from `PUBLIC`, `anon`, and `authenticated` for internal security-definer helpers.
- Grant only intended callable RPCs.
- Update handwritten types, service wrappers, SQL rollback tests, frontend tests, and this reference together.
