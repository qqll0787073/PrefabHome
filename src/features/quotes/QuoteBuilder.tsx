import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmationDialog } from "../../components/common/ConfirmationDialog";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  canManufacturerCreateRevision,
  fetchQuoteDecisionsForRFQ,
  getDecisionForQuote,
  quoteDecisionLabels,
} from "../../lib/quoteDecisions";
import {
  addQuoteItem,
  createQuoteDraft,
  createQuoteRevision,
  deleteQuoteDraft,
  deleteQuoteItem,
  emptyQuoteForm,
  emptyQuoteItemForm,
  fetchQuotesForRFQ,
  formatMoney,
  isQuoteEditableByManufacturer,
  itemToFormValues,
  quoteIncoterms,
  quoteItemTypeLabels,
  quoteItemTypes,
  quoteStatusLabels,
  quoteToFormValues,
  submitQuote,
  updateQuoteDraft,
  updateQuoteItem,
  validateQuoteDraftForm,
  validateQuoteForSubmission,
  validateQuoteItemForm,
} from "../../lib/quotes";
import type {
  RFQQuoteFormValues,
  RFQQuoteDecisionRecord,
  RFQQuoteItemFormValues,
  RFQQuoteItemRecord,
  RFQQuoteWithItems,
  RFQWithDetails,
} from "../../types";
import { QuoteSummaryList } from "./QuoteSummaryList";

interface QuoteBuilderProps {
  rfq: RFQWithDetails | null;
  onQuoteSubmitted?: () => void;
}

export function QuoteBuilder({ rfq, onQuoteSubmitted }: QuoteBuilderProps) {
  const [quotes, setQuotes] = useState<RFQQuoteWithItems[]>([]);
  const [decisions, setDecisions] = useState<RFQQuoteDecisionRecord[]>([]);
  const [activeQuote, setActiveQuote] = useState<RFQQuoteWithItems | null>(null);
  const [quoteValues, setQuoteValues] = useState<RFQQuoteFormValues>(() => emptyQuoteForm());
  const [itemValues, setItemValues] = useState<RFQQuoteItemFormValues>(() => emptyQuoteItemForm());
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{ kind: "draft" | "item"; item?: RFQQuoteItemRecord } | null>(null);
  const deleteReturnFocus = useRef<HTMLElement | null>(null);
  const submitLock = useRef(false);

  const submittedQuotes = useMemo(
    () => quotes.filter((quote) => quote.status !== "draft"),
    [quotes]
  );

  const draftQuote = useMemo(
    () => quotes.find((quote) => quote.status === "draft") ?? null,
    [quotes]
  );

  async function loadQuotes(nextActiveId?: string) {
    if (!rfq) return;
    setIsLoading(true);
    setErrors([]);
    try {
      const items = await fetchQuotesForRFQ(rfq.id);
      const decisionItems = await fetchQuoteDecisionsForRFQ(rfq.id);
      setQuotes(items);
      setDecisions(decisionItems);
      const selected =
        items.find((quote) => quote.id === nextActiveId) ??
        items.find((quote) => quote.status === "draft") ??
        items[0] ??
        null;
      setActiveQuote(selected);
      setQuoteValues(selected ? quoteToFormValues(selected) : emptyQuoteForm(rfq.requested_currency));
      setItemValues(emptyQuoteItemForm((selected?.items.length ?? 0) + 1));
      setEditingItemId(null);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load quotes."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setQuotes([]);
    setDecisions([]);
    setActiveQuote(null);
    setMessage("");
    if (rfq) void loadQuotes();
  }, [rfq?.id]);

  async function createDraft() {
    if (!rfq) return;
    setIsSaving(true);
    setErrors([]);
    setMessage("");
    try {
      const quote = await createQuoteDraft(rfq.id);
      await loadQuotes(quote.id);
      setMessage("Quote draft ready.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to create quote draft."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDraft() {
    if (!activeQuote) return;
    const validationErrors = validateQuoteDraftForm(quoteValues);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    setErrors([]);
    setMessage("");
    try {
      await updateQuoteDraft(activeQuote.id, quoteValues);
      await loadQuotes(activeQuote.id);
      setMessage("Quote draft saved.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save quote draft."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveLineItem() {
    if (!activeQuote) return;
    const validationErrors = validateQuoteItemForm(itemValues);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    setErrors([]);
    setMessage("");
    try {
      if (editingItemId) {
        await updateQuoteItem(editingItemId, itemValues);
      } else {
        await addQuoteItem(activeQuote.id, itemValues);
      }
      await loadQuotes(activeQuote.id);
      setMessage(editingItemId ? "Line item updated." : "Line item added.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save quote line item."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function removeLineItem(item: RFQQuoteItemRecord) {
    if (!activeQuote) return;
    setIsSaving(true);
    setErrors([]);
    try {
      await deleteQuoteItem(item.id);
      await loadQuotes(activeQuote.id);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to delete quote line item."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function submitDraft() {
    if (!activeQuote || submitLock.current) return;
    const candidateQuote: RFQQuoteWithItems = {
      ...activeQuote,
      currency: quoteValues.currency.trim().toUpperCase(),
      incoterm: quoteValues.incoterm.trim().toUpperCase() as RFQQuoteWithItems["incoterm"] || null,
      origin_port: quoteValues.originPort.trim() || null,
      destination_port: quoteValues.destinationPort.trim() || null,
      production_lead_days: quoteValues.productionLeadDays ? Number(quoteValues.productionLeadDays) : null,
      shipping_lead_days: quoteValues.shippingLeadDays ? Number(quoteValues.shippingLeadDays) : null,
      valid_until: quoteValues.validUntil || null,
      manufacturer_note: quoteValues.manufacturerNote.trim() || null,
    };
    const validationErrors = validateQuoteForSubmission(candidateQuote);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    submitLock.current = true;
    setIsSaving(true);
    setErrors([]);
    setMessage("");
    try {
      await updateQuoteDraft(activeQuote.id, quoteValues);
      const submitted = await submitQuote(activeQuote.id);
      await loadQuotes(submitted.id);
      setMessage("Quote submitted to the buyer.");
      onQuoteSubmitted?.();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to submit quote."]);
    } finally {
      submitLock.current = false;
      setIsSaving(false);
    }
  }

  async function deleteDraft() {
    if (!activeQuote) return;
    setIsSaving(true);
    setErrors([]);
    setMessage("");
    try {
      await deleteQuoteDraft(activeQuote.id);
      await loadQuotes();
      setMessage("Quote draft deleted.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to delete quote draft."]);
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    const pending = pendingDelete;
    if (!pending) return;
    setPendingDelete(null);
    if (pending.kind === "item" && pending.item) await removeLineItem(pending.item);
    else await deleteDraft();
  }

  function requestDelete(kind: "draft" | "item", trigger: HTMLElement, item?: RFQQuoteItemRecord) {
    deleteReturnFocus.current = trigger;
    setPendingDelete({ kind, item });
  }

  async function reviseQuote(quote: RFQQuoteWithItems) {
    setIsSaving(true);
    setErrors([]);
    setMessage("");
    try {
      const draft = await createQuoteRevision(quote.id);
      await loadQuotes(draft.id);
      setMessage("Revision draft created.");
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to create quote revision."]);
    } finally {
      setIsSaving(false);
    }
  }

  if (!rfq) {
    return (
      <section className="panel">
        <p>Select an RFQ to create a quote.</p>
      </section>
    );
  }

  const canCreateDraft = ["submitted", "manufacturer_review"].includes(rfq.status);
  const isDraftEditable = activeQuote ? isQuoteEditableByManufacturer(activeQuote) : false;
  const activeDecision = activeQuote ? getDecisionForQuote(activeQuote.id, decisions) : null;
  const canCreateRevision =
    activeQuote ? canManufacturerCreateRevision(activeQuote, rfq.status, decisions) : false;

  return (
    <section className="panel quote-builder">
      <p className="eyebrow">Quote Builder</p>
      <h3>{rfq.product_snapshot.model_name || rfq.product_snapshot.name || "RFQ quote"}</h3>
      <p>
        Requested: {rfq.requested_quantity} units - {rfq.requested_currency}
      </p>
      <ErrorList errors={errors} />
      {message && <p className="form-notice" role="status">{message}</p>}
      {isLoading && <LoadingState message="Loading quotes..." />}
      {!draftQuote && canCreateDraft && (
        <div className="actions">
          <button type="button" disabled={isSaving} onClick={() => void createDraft()}>
            {isSaving ? "Preparing..." : "Create Quote"}
          </button>
        </div>
      )}
      {activeQuote && (
        <section className="quote-panel">
          <p className="eyebrow">
            Version {activeQuote.version} - {quoteStatusLabels[activeQuote.status]}
          </p>
          {activeDecision && (
            <div className="form-notice">
              <strong>{quoteDecisionLabels[activeDecision.decision]}</strong>
              {activeDecision.reason && <p>{activeDecision.reason}</p>}
              <span>{new Date(activeDecision.created_at).toLocaleString()}</span>
            </div>
          )}
          <div className="form-grid">
            <label>
              Currency
              <input
                value={quoteValues.currency}
                disabled={!isDraftEditable}
                maxLength={3}
                onChange={(event) => setQuoteValues({ ...quoteValues, currency: event.target.value })}
              />
            </label>
            <label>
              Incoterm
              <select
                value={quoteValues.incoterm}
                disabled={!isDraftEditable}
                onChange={(event) => setQuoteValues({ ...quoteValues, incoterm: event.target.value })}
              >
                <option value="">Select</option>
                {quoteIncoterms.map((incoterm) => (
                  <option key={incoterm} value={incoterm}>
                    {incoterm}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Origin port
              <input
                value={quoteValues.originPort}
                disabled={!isDraftEditable}
                maxLength={160}
                onChange={(event) => setQuoteValues({ ...quoteValues, originPort: event.target.value })}
              />
            </label>
            <label>
              Destination port
              <input
                value={quoteValues.destinationPort}
                disabled={!isDraftEditable}
                maxLength={160}
                onChange={(event) => setQuoteValues({ ...quoteValues, destinationPort: event.target.value })}
              />
            </label>
            <label>
              Production lead days
              <input
                value={quoteValues.productionLeadDays}
                disabled={!isDraftEditable}
                inputMode="numeric"
                onChange={(event) =>
                  setQuoteValues({ ...quoteValues, productionLeadDays: event.target.value })
                }
              />
            </label>
            <label>
              Shipping lead days
              <input
                value={quoteValues.shippingLeadDays}
                disabled={!isDraftEditable}
                inputMode="numeric"
                onChange={(event) =>
                  setQuoteValues({ ...quoteValues, shippingLeadDays: event.target.value })
                }
              />
            </label>
            <label>
              Valid until
              <input
                type="date"
                value={quoteValues.validUntil}
                disabled={!isDraftEditable}
                onChange={(event) => setQuoteValues({ ...quoteValues, validUntil: event.target.value })}
              />
            </label>
          </div>
          <label>
            Manufacturer note
            <textarea
              value={quoteValues.manufacturerNote}
              disabled={!isDraftEditable}
              maxLength={4000}
              onChange={(event) =>
                setQuoteValues({ ...quoteValues, manufacturerNote: event.target.value })
              }
            />
          </label>
          <div className="quote-line-items">
            <h4>Line Items</h4>
            {activeQuote.items.length === 0 && <p>No line items yet.</p>}
            {activeQuote.items.map((item) => (
              <article className="meta-row" key={item.id}>
                <span>{item.description}</span>
                <span>
                  {item.quantity} {item.unit || "unit"} × {formatMoney(item.unit_price, activeQuote.currency)}
                </span>
                <span>{formatMoney(item.amount, activeQuote.currency)}</span>
                {isDraftEditable && (
                  <span className="actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItemId(item.id);
                        setItemValues(itemToFormValues(item));
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" onClick={(event) => requestDelete("item", event.currentTarget, item)}>
                      Delete
                    </button>
                  </span>
                )}
              </article>
            ))}
          </div>
          {isDraftEditable && (
            <section className="quote-line-editor">
              <div className="form-grid">
                <label>
                  Order
                  <input
                    value={itemValues.lineOrder}
                    inputMode="numeric"
                    onChange={(event) => setItemValues({ ...itemValues, lineOrder: event.target.value })}
                  />
                </label>
                <label>
                  Type
                  <select
                    value={itemValues.itemType}
                    onChange={(event) =>
                      setItemValues({
                        ...itemValues,
                        itemType: event.target.value as RFQQuoteItemFormValues["itemType"],
                      })
                    }
                  >
                    {quoteItemTypes.map((itemType) => (
                      <option key={itemType} value={itemType}>
                        {quoteItemTypeLabels[itemType]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input
                    value={itemValues.quantity}
                    inputMode="decimal"
                    onChange={(event) => setItemValues({ ...itemValues, quantity: event.target.value })}
                  />
                </label>
                <label>
                  Unit
                  <input
                    value={itemValues.unit}
                    onChange={(event) => setItemValues({ ...itemValues, unit: event.target.value })}
                  />
                </label>
                <label>
                  Unit price
                  <input
                    value={itemValues.unitPrice}
                    inputMode="decimal"
                    onChange={(event) => setItemValues({ ...itemValues, unitPrice: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Description
                <input
                  value={itemValues.description}
                  onChange={(event) => setItemValues({ ...itemValues, description: event.target.value })}
                />
              </label>
              <div className="actions">
                <button type="button" disabled={isSaving} onClick={() => void saveLineItem()}>
                  {editingItemId ? "Update Line" : "Add Line"}
                </button>
                {editingItemId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItemId(null);
                      setItemValues(emptyQuoteItemForm(activeQuote.items.length + 1));
                    }}
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </section>
          )}
          <div className="meta-row">
            <strong>Subtotal</strong>
            <strong>{formatMoney(activeQuote.subtotal, activeQuote.currency)}</strong>
          </div>
          <div className="actions">
            {isDraftEditable ? (
              <>
                <button type="button" disabled={isSaving} onClick={() => void saveDraft()}>
                  Save Draft
                </button>
                <button type="button" disabled={isSaving} onClick={() => void submitDraft()}>
                  Submit Quote
                </button>
                <button type="button" disabled={isSaving} onClick={(event) => requestDelete("draft", event.currentTarget)}>
                  Delete Draft
                </button>
              </>
            ) : canCreateRevision ? (
              <button type="button" disabled={isSaving} onClick={() => void reviseQuote(activeQuote)}>
                Create Revision
              </button>
            ) : (
              <p className="form-notice">Quote versions are read-only unless the buyer requests a revision.</p>
            )}
          </div>
        </section>
      )}
      <QuoteSummaryList
        quotes={submittedQuotes}
        title="Submitted Quote Versions"
        readOnlyNote="Submitted quote versions preserve the negotiation history."
        decisions={decisions}
      />
      <ConfirmationDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.kind === "item" ? "Delete quote line item?" : "Delete quote draft?"}
        description={pendingDelete?.kind === "item" ? "The line item will be removed and the database will recalculate the subtotal." : "This permanently removes the draft quote. Submitted quote history is not affected."}
        confirmLabel={pendingDelete?.kind === "item" ? "Delete Line" : "Delete Draft"}
        isBusy={isSaving}
        returnFocusTo={deleteReturnFocus.current}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </section>
  );
}
