import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreatePaymentRecord,
  canRecordPayment,
  canVoidPayment,
  emptyPaymentDraftValues,
  externalPaymentRecordNotice,
  isPaymentRecordReadOnly,
  paymentEventLabel,
  paymentMethods,
  paymentRecordConfirmationText,
  paymentRecordedAtLabel,
  paymentSummaryLabels,
  paymentVoidedAtLabel,
  validatePaymentDraftValues,
  validatePaymentVoidReason,
} from "./payments";
import type { InvoicePaymentSummary, PaymentEventRecord, PaymentRecord } from "../types";

const payment = {
  id: "payment-1",
  payment_number: "PAY-2026-000001",
  invoice_id: "invoice-1",
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
  amount: 500,
  payment_method: "bank_transfer",
  payment_date: null,
  reference_number: null,
  notes: null,
  invoice_snapshot: {},
  party_snapshot: {},
  payment_snapshot: {},
  created_by: "manufacturer-user",
  recorded_at: null,
  voided_at: null,
  void_reason: null,
  created_at: "2026-07-16T00:00:00.000Z",
  updated_at: "2026-07-16T00:00:00.000Z",
} satisfies PaymentRecord;

const summary = {
  invoice_id: "invoice-1",
  invoice_number: "INV-2026-000001",
  currency: "USD",
  invoice_total: 1000,
  recorded_amount: 250,
  remaining_balance: 750,
  recorded_payment_count: 1,
} satisfies InvoicePaymentSummary;

test("payment creation eligibility requires issued invoice with remaining balance", () => {
  assert.equal(canCreatePaymentRecord({ status: "issued" }, summary), true);
  assert.equal(canCreatePaymentRecord({ status: "draft" }, summary), false);
  assert.equal(canCreatePaymentRecord({ status: "cancelled" }, summary), false);
  assert.equal(canCreatePaymentRecord({ status: "issued" }, { remaining_balance: 0 }), false);
});

test("payment draft validation enforces amount, method, dates, and balance", () => {
  assert.deepEqual(validatePaymentDraftValues({
    amount: "500",
    paymentMethod: "wire",
    paymentDate: "2026-07-16",
    referenceNumber: "REF-1",
    notes: "External transfer reference.",
  }, 750), []);
  assert.deepEqual(validatePaymentDraftValues({
    amount: "",
    paymentMethod: "wire",
    paymentDate: "",
    referenceNumber: "",
    notes: "",
  }, 750), ["Payment amount is required."]);
  assert.deepEqual(validatePaymentDraftValues({
    amount: "0",
    paymentMethod: "wire",
    paymentDate: "",
    referenceNumber: "",
    notes: "",
  }, 750), ["Payment amount must be greater than zero."]);
  assert.deepEqual(validatePaymentDraftValues({
    amount: "800",
    paymentMethod: "wire",
    paymentDate: "",
    referenceNumber: "",
    notes: "",
  }, 750), ["Payment amount cannot exceed the invoice remaining balance."]);
  assert.deepEqual(validatePaymentDraftValues({
    amount: "100",
    paymentMethod: "card" as never,
    paymentDate: "not-a-date",
    referenceNumber: "x".repeat(121),
    notes: "x".repeat(2001),
  }), [
    "Choose a supported external payment method.",
    "Payment date must be valid.",
    "Reference number must be 120 characters or fewer.",
    "Notes must be 2000 characters or fewer.",
  ]);
});

test("payment lifecycle helpers match draft, recorded, and voided states", () => {
  assert.equal(canRecordPayment(payment), true);
  assert.equal(canVoidPayment(payment), false);
  assert.equal(isPaymentRecordReadOnly(payment), false);
  assert.equal(canRecordPayment({ ...payment, status: "recorded" }), false);
  assert.equal(canVoidPayment({ ...payment, status: "recorded" }), true);
  assert.equal(isPaymentRecordReadOnly({ ...payment, status: "recorded" }), true);
  assert.equal(canRecordPayment({ ...payment, status: "voided" }), false);
  assert.equal(canVoidPayment({ ...payment, status: "voided" }), false);
});

test("payment timestamp labels render only for the matching terminal status", () => {
  assert.equal(paymentRecordedAtLabel(payment), null);
  assert.equal(
    paymentRecordedAtLabel({ ...payment, status: "recorded", recorded_at: "2026-07-16T01:00:00.000Z" })?.startsWith("Recorded"),
    true
  );
  assert.equal(paymentVoidedAtLabel(payment), null);
  assert.equal(
    paymentVoidedAtLabel({ ...payment, status: "voided", voided_at: "2026-07-16T02:00:00.000Z" })?.startsWith("Voided"),
    true
  );
});

test("payment notice avoids processing, paid, and settlement claims", () => {
  const notice = externalPaymentRecordNotice();
  const confirmation = paymentRecordConfirmationText(payment);
  assert.equal(notice.includes("manual external records only"), true);
  assert.equal(confirmation.includes("external payment record only"), true);
  assert.equal(/Pay Now|checkout|card|ACH|payment link|funds received|bank verified|refund/i.test(notice), false);
  assert.equal(/Pay Now|checkout|card|ACH|payment link|funds received|bank verified|refund/i.test(confirmation), false);
  assert.equal(/No funds are transferred/i.test(notice), true);
  assert.equal(/does not transfer/i.test(confirmation), true);
});

test("payment labels and defaults are stable", () => {
  assert.deepEqual(paymentMethods, ["bank_transfer", "wire", "check", "cash", "other"]);
  assert.deepEqual(emptyPaymentDraftValues(), {
    amount: "",
    paymentMethod: "bank_transfer",
    paymentDate: "",
    referenceNumber: "",
    notes: "",
  });
  assert.deepEqual(emptyPaymentDraftValues({
    ...payment,
    amount: 125,
    payment_method: "check",
    payment_date: "2026-07-16",
    reference_number: "CHK-1",
    notes: "Memo",
  }), {
    amount: "125",
    paymentMethod: "check",
    paymentDate: "2026-07-16",
    referenceNumber: "CHK-1",
    notes: "Memo",
  });
});

test("payment summary and event labels are readable", () => {
  assert.deepEqual(paymentSummaryLabels(summary), {
    total: "$1,000.00",
    recorded: "$250.00",
    remaining: "$750.00",
  });
  assert.equal(
    paymentEventLabel({ event_type: "payment_recorded" } as PaymentEventRecord),
    "Payment recorded"
  );
});

test("void reason validation is explicit", () => {
  assert.deepEqual(validatePaymentVoidReason(""), ["Void reason is required."]);
  assert.deepEqual(validatePaymentVoidReason("x".repeat(2001)), ["Void reason must be 2000 characters or fewer."]);
  assert.deepEqual(validatePaymentVoidReason("Duplicate external reference."), []);
});
