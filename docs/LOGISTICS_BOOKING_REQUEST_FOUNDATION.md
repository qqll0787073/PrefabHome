# PH-010B Logistics Booking Request Foundation

PH-010B adds an internal Logistics Booking Request workflow for Shipping Readiness records that are already `ready_for_logistics`.

`submitted_for_arrangement` means the Manufacturer submitted internal planning information for logistics arrangement only.

It does not mean:

- `submitted_for_arrangement != carrier selected`
- `submitted_for_arrangement != freight forwarder selected`
- `submitted_for_arrangement != cargo space reserved`
- `submitted_for_arrangement != equipment reserved`
- `submitted_for_arrangement != pickup scheduled`
- `submitted_for_arrangement != booking confirmed`
- `submitted_for_arrangement != dispatched`
- `submitted_for_arrangement != in transit`
- `submitted_for_arrangement != customs cleared`
- `submitted_for_arrangement != delivered`

No carrier, freight-forwarder, vessel, airline, trucking, rail, warehouse, customs, insurance, tariff, tracking, mapping, payment, tax, email, document-signing, or accounting API is integrated in PH-010B.

## Database

Migration: `supabase/migrations/0023_logistics_booking_request_foundation.sql`

Tables:

- `public.logistics_booking_requests`
- `public.logistics_booking_request_events`

Booking request numbers are database generated as `BKR-YYYY-NNNNNN`.

Statuses:

- `booking_draft`
- `submitted_for_arrangement`
- `withdrawn`

Transport modes:

- `ocean`
- `air`
- `truck`
- `rail`
- `multimodal`
- `other`

Container preferences:

- `20ft_standard`
- `40ft_standard`
- `40ft_high_cube`
- `flat_rack`
- `open_top`
- `reefer`
- `less_than_container_load`
- `air_cargo`
- `truckload`
- `less_than_truckload`
- `not_specified`
- `other`

## Eligibility

Creation requires:

- Shipping Readiness status is `ready_for_logistics`.
- Purchase Order remains `confirmed`.
- Contract remains `accepted`.
- Invoice remains `issued`.
- Authenticated assigned Manufacturer.
- No existing Booking Request for the Shipping Readiness record.

No payment, invoice-paid state, carrier selection, freight-forwarder selection, cargo-space confirmation, pickup scheduling, or customs completion is required.

## Source Data

The database derives and freezes:

- Shipping Readiness reference and snapshot.
- PO, Contract, and Invoice references.
- Buyer and Manufacturer.
- Cargo description, package count, gross weight, and volume.
- Party, source, cargo, and booking request snapshots.

Clients cannot modify source cargo fields in the Booking Request.

## Trusted RPCs

- `create_logistics_booking_request(shipping_readiness_uuid)`
- `update_logistics_booking_request_draft(...)`
- `submit_logistics_booking_request(booking_request_uuid)`
- `withdraw_logistics_booking_request(booking_request_uuid, reason_text)`

All lifecycle RPCs lock the target row and use state-conditional updates with `RETURNING`. Events are trusted and immutable.

## Access Rules

- Manufacturer: read assigned requests/events and mutate only through trusted RPCs.
- Buyer: read own requests/events only.
- Admin: read all only.
- Anonymous: no access.
- Direct table writes are denied.

## UI

- Manufacturer Portal: prepare from eligible Shipping Readiness record, edit draft request fields, save draft, submit for arrangement, and withdraw.
- Buyer Portal: read-only details and timeline.
- Admin Portal: read-only details, snapshots, and timeline.

The UI must not show booking confirmation, carrier assignment, freight-forwarder assignment, pickup scheduling, tracking number, bill of lading, air waybill, vessel, flight, departure confirmation, ETA, in transit, customs cleared, or delivered controls.
