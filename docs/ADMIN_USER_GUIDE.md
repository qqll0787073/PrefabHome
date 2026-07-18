# Admin User Guide

## Admin Access

Admin registration is not public. An authorized operator must create an Auth user and grant the matching profile the `admin` role through a trusted database process. Never place a service-role key in the browser or rely on signup metadata for Admin authority.

## Core Review Queues

- **Manufacturers:** inspect applications, add review notes, approve, reject, suspend, or return for revision.
- **Products:** review submitted Products and publish/reject according to the lifecycle matrix.
- **RFQs/Quotes:** read RFQs, messages, snapshots, events, Quote versions, and decisions. Admin transaction views are intentionally read-only where no Admin mutation RPC exists.
- **Purchase Orders/Contracts:** review all records, snapshots, items, events, and participant decisions.
- **Invoices/Payments:** inspect issued/cancelled Invoices and external payment records.
- **Shipping:** inspect Shipping Readiness and Logistics Booking Requests.

The Users workspace is a Beta placeholder; production user search, account disabling, and invitation management are not implemented.

## Signature Preparation

Create and ready signature packages and prepare/cancel delivery-request records as permitted. These are internal preparation records only. The Beta does not generate PDFs, send email, call DocuSign/Adobe Sign, issue provider envelopes, or collect electronic signatures.

## Logistics Arrangement

1. Open a submitted booking request.
2. Create provider candidates with an independent provider role and transport mode.
3. Update or withdraw candidates while allowed.
4. Select or replace the current candidate; cancel the selection when required.
5. Mark the request `Ready for external booking` only after readiness rules pass.

Admin read RPCs include internal contacts, quote references, notes, actor IDs, metadata, and versions. Treat these as confidential operational data. Participant-safe RPCs expose a fixed smaller projection.

No Admin action contacts a provider, books capacity, schedules pickup, dispatches cargo, files customs documents, or tracks delivery.

## Operational Discipline

- Confirm the current status before each mutation; trusted RPCs reject stale transitions.
- Use record numbers and timestamps for support, not secrets or signed URLs.
- Never use production for fixtures or smoke tests.
- Run staging safety checks before approved staging writes and clean fixtures by exact ID.
- Escalate suspected authorization, data exposure, duplicate lifecycle event, or snapshot-integrity issues before release.
