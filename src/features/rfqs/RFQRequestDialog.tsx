import { useEffect, useId, useRef, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import {
  emptyRFQForm,
  persistProductRFQ,
  rfqIncoterms,
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
  const [draftId, setDraftId] = useState<string | null>(null);
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const canRequest = Boolean(user && user.role === "buyer");

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    (canRequest ? firstFieldRef.current : closeButtonRef.current)?.focus();
    return () => returnFocusRef.current?.focus();
  }, []);

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
      const saved = await persistProductRFQ(product, values, action, draftId);
      if (action === "submit") {
        setMessage("RFQ submitted to the manufacturer.");
      } else {
        setDraftId(saved.id);
        setMessage("RFQ draft saved.");
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save RFQ."]);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      ref={dialogRef}
      className="rfq-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !isSaving) onClose();
        if (event.key !== "Tab") return;
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
        ) ?? []);
        if (controls.length === 0) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div className="rfq-dialog-panel">
        <div className="dialog-header">
          <div>
            <p className="eyebrow">Request Quote</p>
            <h3 id={titleId}>{product.model_name || product.name}</h3>
          </div>
          <button ref={closeButtonRef} type="button" className="close-button" onClick={onClose}>
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
              ref={firstFieldRef}
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
              maxLength={120}
              onChange={(event) => updateField("destinationCountry", event.target.value)}
              disabled={!canRequest || isSaving}
            />
          </label>
          <label>
            Destination Port
            <input
              value={values.destinationPort}
              maxLength={160}
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
