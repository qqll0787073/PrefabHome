import { useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import {
  createDraftRFQ,
  emptyRFQForm,
  rfqIncoterms,
  submitRFQ,
  validateRFQForm,
} from "../../lib/rfq";
import type { AuthUser } from "../../lib/auth";
import type { MarketplaceProduct, RFQFormValues } from "../../types";

interface RFQRequestDialogProps {
  product: MarketplaceProduct;
  user: AuthUser | null;
  onClose: () => void;
}

export function RFQRequestDialog({ product, user, onClose }: RFQRequestDialogProps) {
  const [values, setValues] = useState<RFQFormValues>(() => emptyRFQForm(product.currency));
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canRequest = Boolean(user && user.role === "buyer");

  function updateField(field: keyof RFQFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function save(action: "draft" | "submit") {
    const validationErrors = validateRFQForm(values);
    setErrors(validationErrors);
    setMessage("");
    if (validationErrors.length > 0 || !user) return;

    setIsSaving(true);
    try {
      const draft = await createDraftRFQ(user.id, product, values);
      if (action === "submit") {
        await submitRFQ(draft.id, values);
        setMessage("RFQ submitted to the manufacturer.");
      } else {
        setMessage("RFQ draft saved.");
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save RFQ."]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rfq-dialog" role="dialog" aria-modal="true" aria-label="Request quote">
      <div className="rfq-dialog-panel">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Request Quote</p>
            <h3>{product.model_name || product.name}</h3>
          </div>
          <button type="button" className="close-button" onClick={onClose}>
            Close
          </button>
        </div>

        {!canRequest && (
          <p className="form-notice">
            Sign in with a Buyer account to save or submit RFQs for this product.
          </p>
        )}

        <ErrorList errors={errors} />
        {message && <p className="form-success">{message}</p>}

        <div className="form-grid">
          <label>
            Quantity
            <input
              type="number"
              min="1"
              value={values.requestedQuantity}
              onChange={(event) => updateField("requestedQuantity", event.target.value)}
              disabled={!canRequest || isSaving}
            />
          </label>
          <label>
            Currency
            <input
              value={values.requestedCurrency}
              maxLength={3}
              onChange={(event) => updateField("requestedCurrency", event.target.value)}
              disabled={!canRequest || isSaving}
            />
          </label>
          <label>
            Incoterm
            <select
              value={values.incoterm}
              onChange={(event) => updateField("incoterm", event.target.value)}
              disabled={!canRequest || isSaving}
            >
              <option value="">Decide later</option>
              {rfqIncoterms.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Destination Country
            <input
              value={values.destinationCountry}
              onChange={(event) => updateField("destinationCountry", event.target.value)}
              disabled={!canRequest || isSaving}
            />
          </label>
          <label>
            Destination Port
            <input
              value={values.destinationPort}
              onChange={(event) => updateField("destinationPort", event.target.value)}
              disabled={!canRequest || isSaving}
            />
          </label>
          <label>
            Target Delivery Date
            <input
              type="date"
              value={values.targetDeliveryDate}
              onChange={(event) => updateField("targetDeliveryDate", event.target.value)}
              disabled={!canRequest || isSaving}
            />
          </label>
        </div>

        <label>
          Message
          <textarea
            value={values.buyerMessage}
            maxLength={2000}
            onChange={(event) => updateField("buyerMessage", event.target.value)}
            disabled={!canRequest || isSaving}
          />
        </label>
        <p className="helper-text">{values.buyerMessage.length}/2000 characters</p>

        <div className="actions">
          <button type="button" disabled={!canRequest || isSaving} onClick={() => void save("draft")}>
            Save Draft
          </button>
          <button type="button" disabled={!canRequest || isSaving} onClick={() => void save("submit")}>
            {isSaving ? "Saving..." : "Submit RFQ"}
          </button>
        </div>
      </div>
    </section>
  );
}
