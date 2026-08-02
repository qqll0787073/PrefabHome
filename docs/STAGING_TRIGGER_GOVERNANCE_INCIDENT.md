# Staging Trigger Governance Incident

## Status

A read-only staging catalog audit observed 29 of 48 user triggers in `public` disabled. The cause is unknown. No repository-controlled statement that disables this set was found, and neither manual DDL nor an external restore has been proven as the cause.

Migration `0025_restore_rfq_quote_authority.sql` is intentionally limited to the 12 RFQ/Quote triggers approved for Sprint 3A.3. It does not establish whole-database trigger health and does not alter the other 17 disabled triggers.

## Scoped Recovery

Migration 0025 explicitly enables only:

| Table | Trigger |
| --- | --- |
| `rfqs` | `protect_rfq_write` |
| `rfqs` | `record_rfq_lifecycle_event` |
| `rfqs` | `set_rfqs_updated_at` |
| `rfq_messages` | `protect_rfq_message_insert` |
| `rfq_messages` | `record_rfq_message_event` |
| `rfq_events` | `protect_rfq_event_insert` |
| `rfq_quotes` | `protect_rfq_quote_write` |
| `rfq_quotes` | `set_rfq_quote_updated_at` |
| `rfq_quote_items` | `protect_rfq_quote_item_write` |
| `rfq_quote_items` | `after_rfq_quote_item_change` |
| `rfq_quote_items` | `set_rfq_quote_item_updated_at` |
| `rfq_quote_decisions` | `protect_rfq_quote_decision_write` |

## Unresolved Triggers

These 17 observed disabled triggers are outside migration 0025 and remain untouched:

| Table | Trigger |
| --- | --- |
| `contract_events` | `protect_contract_event_write` |
| `contract_review_decisions` | `protect_contract_review_decision_write` |
| `contracts` | `protect_contract_write` |
| `invoice_events` | `protect_invoice_event_write` |
| `invoice_line_items` | `protect_invoice_line_item_write` |
| `invoices` | `protect_invoice_write` |
| `logistics_booking_request_events` | `protect_logistics_booking_request_event_write` |
| `logistics_booking_requests` | `protect_logistics_booking_request_write` |
| `purchase_order_decisions` | `protect_purchase_order_decision_write` |
| `purchase_order_events` | `protect_purchase_order_event_write` |
| `purchase_order_items` | `protect_purchase_order_item_write` |
| `purchase_orders` | `protect_purchase_order_write` |
| `shipping_readiness_events` | `protect_shipping_readiness_event_write` |
| `shipping_readiness_records` | `protect_shipping_readiness_write` |
| `signature_package_events` | `protect_signature_package_event_write` |
| `signature_packages` | `protect_signature_package_write` |
| `signature_participants` | `protect_signature_participant_write` |

## Required Follow-Up

A separate read-only audit and explicit owner authorization are required before changing these objects. That work should fingerprint each trigger and function against its committed migration, determine data impact, identify the disabling mechanism where possible, and use a separate forward migration. It must not be bundled into RFQ/Quote recovery.

Migration 0025 creation was authorized for code review only. It has not been applied to Staging or Production.
