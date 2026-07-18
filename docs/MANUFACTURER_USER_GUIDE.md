# Manufacturer User Guide

## Onboarding

Register as `Manufacturer`, open Company, and save the application as a draft while incomplete. Submit only after all required fields are complete. Submitted and under-review applications are locked until an Admin returns them to draft/rejected. Approval is required before Product creation.

One account can own one Manufacturer application. You cannot change application status, review notes, ownership, or your profile role.

## Products And Media

1. Create and edit Product drafts after approval.
2. Upload images or private documents to the corresponding private Storage bucket.
3. Select a primary image through the atomic primary-image action.
4. Submit the Product for Admin review.

Only the primary-image RPC can set an image as primary. Documents are always private and can never be primary. Submitted/published lifecycle transitions remain database-controlled.

## RFQs And Quotes

- Open submitted RFQs in the Inbox and move them to Manufacturer review.
- Reply through the conversation; trusted triggers generate timeline events.
- Create a Quote draft, edit metadata and line items, and verify the subtotal.
- Submit the initial Quote or create and submit a revision. Previous current versions become superseded atomically.

Buyer RFQ fields and snapshots are immutable to Manufacturers. Only the assigned Manufacturer can access the workflow.

## Purchase Orders And Contracts

- Review assigned Purchase Orders and use only the offered lifecycle actions.
- Request revision, confirm, or reject according to the current status.
- Review Contract contents and respond as permitted. Contract snapshots and first-submission timestamps remain preserved across review rounds.
- Complete your signature participant details when requested. The Beta prepares records only; it does not send a signing invitation or collect a signature.

## Invoice And Payment Recording

- Create an Invoice from an eligible Purchase Order, save partial drafts, and issue only with complete billing details.
- Record an external payment only after it occurred. Future payment dates are rejected by the database.
- Do not treat payment records as bank settlement or payment-gateway confirmation.

## Shipping And Logistics

1. Create Shipping Readiness from an eligible Purchase Order.
2. Complete cargo, address, mode, Incoterm, and planning details; mark ready when valid.
3. Create a Logistics Booking Request, save a draft, submit it, or withdraw it when allowed.
4. Review participant-safe provider options and Admin planning status.

Manufacturers do not receive provider contacts, internal quote references, Admin notes, actor IDs, or event metadata. No external provider is contacted by the Beta.

## Troubleshooting

Use the latest server state after lifecycle conflicts. For upload errors, confirm approval, Product ownership, media type, file limits, and path structure. Report record numbers and sanitized errors only; never include credentials, tokens, or signed URLs.
