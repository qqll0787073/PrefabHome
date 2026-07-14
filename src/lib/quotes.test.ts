import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateQuoteItemAmount,
  calculateQuoteSubtotal,
  emptyQuoteForm,
  emptyQuoteItemForm,
  formatMoney,
  isQuoteEditableByManufacturer,
  isQuoteVisibleToBuyer,
  quoteStatusLabels,
  sortQuotesByVersion,
  validateQuoteDraftForm,
  validateQuoteForSubmission,
  validateQuoteItemForm,
} from "./quotes";
import type { RFQQuoteWithItems } from "../types";

const quote = {
  id: "quote-1",
  rfq_id: "rfq-1",
  manufacturer_id: "manufacturer-1",
  version: 1,
  status: "draft",
  currency: "USD",
  unit_price: null,
  quantity: null,
  subtotal: 0,
  incoterm: null,
  origin_port: null,
  destination_port: null,
  production_lead_days: null,
  shipping_lead_days: null,
  valid_until: null,
  manufacturer_note: null,
  created_by: "manufacturer-owner-1",
  submitted_at: null,
  created_at: "2026-07-14T10:00:00Z",
  updated_at: "2026-07-14T10:00:00Z",
  items: [],
} satisfies RFQQuoteWithItems;

describe("quote helpers", () => {
  it("validates draft quote fields without requiring line items", () => {
    const values = {
      ...emptyQuoteForm("usd"),
      incoterm: "bad",
      productionLeadDays: "-1",
      shippingLeadDays: "soon",
      manufacturerNote: "x".repeat(4001),
    };

    assert.deepEqual(validateQuoteDraftForm(values), [
      "Incoterm is not supported.",
      "Production lead days must be zero or more.",
      "Shipping lead days must be zero or more.",
      "Manufacturer note must be 4000 characters or fewer.",
    ]);
  });

  it("validates quote item form requirements", () => {
    const errors = validateQuoteItemForm({
      ...emptyQuoteItemForm(),
      lineOrder: "0",
      description: "",
      quantity: "0",
      unitPrice: "-1",
      unit: "x".repeat(41),
    });

    assert.deepEqual(errors, [
      "Line order must be a positive whole number.",
      "Line item description is required.",
      "Line item quantity must be greater than zero.",
      "Line item unit price must be zero or more.",
      "Line item unit must be 40 characters or fewer.",
    ]);
  });

  it("calculates display amounts and subtotals from line items", () => {
    assert.equal(calculateQuoteItemAmount({ quantity: "2.5", unitPrice: "100" }), 250);
    assert.equal(
      calculateQuoteSubtotal([
        {
          id: "item-1",
          quote_id: "quote-1",
          line_order: 1,
          item_type: "product",
          description: "Base unit",
          quantity: 2,
          unit: "unit",
          unit_price: 100,
          amount: 200,
          created_at: "2026-07-14T10:00:00Z",
          updated_at: "2026-07-14T10:00:00Z",
        },
        {
          id: "item-2",
          quote_id: "quote-1",
          line_order: 2,
          item_type: "freight",
          description: "Freight",
          quantity: 1,
          unit: "lot",
          unit_price: 50.5,
          amount: 50.5,
          created_at: "2026-07-14T10:00:00Z",
          updated_at: "2026-07-14T10:00:00Z",
        },
      ]),
      250.5
    );
    assert.equal(formatMoney(250.5, "USD"), "$250.50");
  });

  it("keeps quote version ordering newest first", () => {
    assert.deepEqual(
      sortQuotesByVersion([
        { ...quote, id: "quote-1", version: 1 },
        { ...quote, id: "quote-3", version: 3 },
        { ...quote, id: "quote-2", version: 2 },
      ]).map((item) => item.version),
      [3, 2, 1]
    );
  });

  it("keeps role visibility and edit mapping conservative", () => {
    assert.equal(isQuoteEditableByManufacturer({ status: "draft" }), true);
    assert.equal(isQuoteEditableByManufacturer({ status: "submitted" }), false);
    assert.equal(isQuoteVisibleToBuyer({ status: "draft" }), false);
    assert.equal(isQuoteVisibleToBuyer({ status: "submitted" }), true);
    assert.equal(isQuoteVisibleToBuyer({ status: "revision_requested" }), true);
    assert.equal(quoteStatusLabels.superseded, "Superseded");
    assert.equal(quoteStatusLabels.accepted, "Accepted");
    assert.equal(quoteStatusLabels.revision_requested, "Revision requested");
  });

  it("requires line items only at submission time", () => {
    assert.deepEqual(validateQuoteForSubmission(quote), [
      "Quote must include at least one line item.",
    ]);

    assert.deepEqual(
      validateQuoteForSubmission({
        ...quote,
        items: [
          {
            id: "item-1",
            quote_id: "quote-1",
            line_order: 1,
            item_type: "product",
            description: "Base model",
            quantity: 1,
            unit: "unit",
            unit_price: 100,
            amount: 100,
            created_at: "2026-07-14T10:00:00Z",
            updated_at: "2026-07-14T10:00:00Z",
          },
        ],
      }),
      []
    );
  });
});
