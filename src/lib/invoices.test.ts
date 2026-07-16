import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateInvoiceTotalPreview,
  canCancelInvoice,
  canCreateInvoiceForPurchaseOrder,
  canIssueInvoice,
  emptyInvoiceDraftValues,
  invoiceCancelledAtLabel,
  invoiceEventLabel,
  invoiceIssueConfirmationText,
  invoiceIssuedAtLabel,
  invoiceNoPaymentNotice,
  invoiceStatusLabels,
  invoiceTaxDisclaimer,
  isInvoiceReadOnly,
  validateInvoiceCancellationReason,
  validateInvoiceDraftValues,
} from "./invoices";
import type {
  InvoiceEventRecord,
  InvoiceRecord,
  PurchaseOrderWithItems,
  SignaturePackageRecord,
} from "../types";

const draftInvoice = {
  id: "invoice-1",
  invoice_number: "INV-2026-000001",
  contract_id: "contract-1",
  contract_number: "CON-2026-000001",
  purchase_order_id: "po-1",
  purchase_order_number: "PO-2026-000001",
  buyer_id: "buyer-1",
  manufacturer_id: "manufacturer-1",
  status: "draft",
  version: 1,
  currency: "USD",
  subtotal: 1000,
  tax_amount: 0,
  shipping_amount: 0,
  discount_amount: 0,
  total_amount: 1000,
  issue_date: null,
  due_date: null,
  billing_name: null,
  billing_email: null,
  billing_address: null,
  contract_snapshot: {},
  purchase_order_snapshot: {},
  buyer_snapshot: {},
  manufacturer_snapshot: {},
  line_items_snapshot: [{ line_number: 1 }],
  amount_snapshot: {},
  created_by: "manufacturer-owner-1",
  issued_at: null,
  cancelled_at: null,
  cancellation_reason: null,
  created_at: "2026-07-16T00:00:00.000Z",
  updated_at: "2026-07-16T00:00:00.000Z",
} satisfies InvoiceRecord;

const confirmedPurchaseOrder = {
  id: "po-1",
  status: "confirmed",
} as PurchaseOrderWithItems;

const readyPackage = {
  id: "package-1",
  contract_id: "contract-1",
  status: "ready_to_send",
} as SignaturePackageRecord;

describe("invoice helpers", () => {
  it("maps conservative invoice lifecycle labels and permissions", () => {
    assert.equal(invoiceStatusLabels.draft, "Draft");
    assert.equal(invoiceStatusLabels.issued, "Issued");
    assert.equal(invoiceStatusLabels.cancelled, "Cancelled");
    assert.equal(isInvoiceReadOnly(draftInvoice), false);
    assert.equal(isInvoiceReadOnly({ ...draftInvoice, status: "issued" }), true);
    assert.equal(isInvoiceReadOnly({ ...draftInvoice, status: "cancelled" }), true);
    assert.equal(canIssueInvoice(draftInvoice), true);
    assert.equal(canIssueInvoice({ ...draftInvoice, status: "issued" }), false);
    assert.equal(canCancelInvoice(draftInvoice), true);
    assert.equal(canCancelInvoice({ ...draftInvoice, status: "issued" }), true);
    assert.equal(canCancelInvoice({ ...draftInvoice, status: "cancelled" }), false);
  });

  it("requires confirmed PO, ready signature package, and no existing invoice for creation", () => {
    assert.equal(canCreateInvoiceForPurchaseOrder(confirmedPurchaseOrder, [], [readyPackage], "contract-1"), true);
    assert.equal(canCreateInvoiceForPurchaseOrder({ ...confirmedPurchaseOrder, status: "submitted" }, [], [readyPackage], "contract-1"), false);
    assert.equal(canCreateInvoiceForPurchaseOrder(confirmedPurchaseOrder, [{ purchase_order_id: "po-1" }], [readyPackage], "contract-1"), false);
    assert.equal(
      canCreateInvoiceForPurchaseOrder(confirmedPurchaseOrder, [], [{ ...readyPackage, status: "draft" }], "contract-1"),
      false
    );
  });

  it("validates draft billing and amount values", () => {
    assert.deepEqual(
      validateInvoiceDraftValues(
        {
          issueDate: "2026-07-16",
          dueDate: "2026-07-15",
          billingName: "Buyer",
          billingEmail: "bad",
          billingAddress: "[]",
          taxAmount: "-1",
          shippingAmount: "x",
          discountAmount: "2000",
        },
        1000,
        true
      ),
      [
        "Billing email must be valid.",
        "Billing address must be a JSON object.",
        "Due date must be on or after the issue date.",
        "Amounts must be valid numbers.",
        "Amounts must be zero or greater.",
      ]
    );
    assert.deepEqual(
      validateInvoiceDraftValues(
        {
          issueDate: "",
          dueDate: "",
          billingName: "",
          billingEmail: "",
          billingAddress: "",
          taxAmount: "0",
          shippingAmount: "0",
          discountAmount: "0",
        },
        1000,
        true
      ),
      [
        "Billing name is required.",
        "Billing email is required.",
        "Billing address is required.",
        "Issue date is required.",
        "Due date is required.",
      ]
    );
  });

  it("previews totals without claiming database authority", () => {
    const total = calculateInvoiceTotalPreview(1000, {
      taxAmount: "80",
      shippingAmount: "120",
      discountAmount: "50",
    });
    assert.equal(total, 1150);
    assert.equal(Number.isNaN(calculateInvoiceTotalPreview(1000, {
      taxAmount: "bad",
      shippingAmount: "0",
      discountAmount: "0",
    })), true);
  });

  it("renders timestamps only for matching statuses", () => {
    assert.equal(invoiceIssuedAtLabel(draftInvoice), null);
    assert.equal(
      invoiceIssuedAtLabel({ ...draftInvoice, status: "issued", issued_at: "2026-07-16T01:00:00.000Z" })?.startsWith("Issued"),
      true
    );
    assert.equal(invoiceCancelledAtLabel(draftInvoice), null);
    assert.equal(
      invoiceCancelledAtLabel({ ...draftInvoice, status: "cancelled", cancelled_at: "2026-07-16T02:00:00.000Z", cancellation_reason: "Paused" })?.startsWith("Cancelled"),
      true
    );
  });

  it("validates cancellation reasons", () => {
    assert.deepEqual(validateInvoiceCancellationReason(""), ["Cancellation reason is required."]);
    assert.deepEqual(validateInvoiceCancellationReason("x".repeat(2001)), [
      "Cancellation reason must be 2000 characters or fewer.",
    ]);
    assert.deepEqual(validateInvoiceCancellationReason("Commercial terms paused."), []);
  });

  it("keeps PH-009A semantics away from payment and delivery claims", () => {
    assert.equal(invoiceNoPaymentNotice(), "No payment has been recorded.");
    assert.equal(invoiceTaxDisclaimer().includes("No automatic tax"), true);
    assert.equal(invoiceIssueConfirmationText(draftInvoice).includes("not sent"), true);
    assert.equal(invoiceIssueConfirmationText(draftInvoice).includes("no payment is recorded"), true);
  });

  it("normalizes draft values and labels trusted events", () => {
    const values = emptyInvoiceDraftValues({
      ...draftInvoice,
      issue_date: "2026-07-16",
      due_date: "2026-08-16",
      billing_name: "Buyer",
      billing_email: "buyer@example.com",
      billing_address: { line1: "1 Main St" },
      tax_amount: 80,
    });
    assert.equal(values.billingName, "Buyer");
    assert.equal(values.billingAddress.includes("line1"), true);
    assert.equal(invoiceEventLabel({ event_type: "invoice_issued" } as InvoiceEventRecord), "Invoice issued");
  });
});
