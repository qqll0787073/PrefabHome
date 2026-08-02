import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import {
  rfqIncoterms,
  rfqToFormValues,
  submitRFQ,
  updateDraftRFQ,
  validateRFQForm,
} from "../../lib/rfq";
import type { RFQFormValues, RFQWithDetails } from "../../types";

interface BuyerRFQDraftEditorProps {
  rfq: RFQWithDetails;
  onSaved: () => void;
}

export function BuyerRFQDraftEditor({ rfq, onSaved }: BuyerRFQDraftEditorProps) {
  const [values, setValues] = useState<RFQFormValues>(() => rfqToFormValues(rfq));
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setValues(rfqToFormValues(rfq));
    setErrors([]);
    setMessage("");
  }, [rfq.id, rfq.updated_at]);

  function update(field: keyof RFQFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function save(action: "save" | "submit") {
    const validationErrors = validateRFQForm(values);
    setErrors(validationErrors);
    setMessage("");
    if (validationErrors.length > 0) return;
    setIsSaving(true);
    try {
      if (action === "submit") {
        await submitRFQ(rfq.id, values);
        setMessage("RFQ submitted.");
      } else {
        await updateDraftRFQ(rfq.id, values);
        setMessage("Draft saved.");
      }
      onSaved();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save RFQ draft."]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel quote-builder" aria-labelledby="rfq-draft-editor-heading">
      <p className="eyebrow">Buyer draft</p>
      <h3 id="rfq-draft-editor-heading">Edit RFQ Draft</h3>
      <ErrorList errors={errors} />
      {message && <p className="form-success" role="status">{message}</p>}
      <div className="form-grid">
        <label>Quantity<input type="number" min="1" value={values.requestedQuantity} disabled={isSaving} onChange={(event) => update("requestedQuantity", event.target.value)} /></label>
        <label>Currency<input maxLength={3} value={values.requestedCurrency} disabled={isSaving} onChange={(event) => update("requestedCurrency", event.target.value)} /></label>
        <label>Incoterm<select value={values.incoterm} disabled={isSaving} onChange={(event) => update("incoterm", event.target.value)}><option value="">Decide later</option>{rfqIncoterms.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Destination country<input maxLength={120} value={values.destinationCountry} disabled={isSaving} onChange={(event) => update("destinationCountry", event.target.value)} /></label>
        <label>Destination port<input maxLength={160} value={values.destinationPort} disabled={isSaving} onChange={(event) => update("destinationPort", event.target.value)} /></label>
        <label>Target delivery date<input type="date" value={values.targetDeliveryDate} disabled={isSaving} onChange={(event) => update("targetDeliveryDate", event.target.value)} /></label>
      </div>
      <label>Message<textarea maxLength={2000} value={values.buyerMessage} disabled={isSaving} onChange={(event) => update("buyerMessage", event.target.value)} /></label>
      <p className="helper-text">{values.buyerMessage.length}/2000 characters</p>
      <div className="actions">
        <button type="button" disabled={isSaving} onClick={() => void save("save")}>{isSaving ? "Saving..." : "Save Draft"}</button>
        <button type="button" disabled={isSaving} onClick={() => void save("submit")}>Submit RFQ</button>
      </div>
    </section>
  );
}
