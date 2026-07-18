import React, { useEffect, useId, useRef, type RefObject } from "react";

interface LogisticsActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  reasonLabel?: string;
  reason?: string;
  reasonRequired?: boolean;
  isSaving: boolean;
  returnFocusTo: HTMLElement | null;
  onReasonChange?: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function LogisticsActionDialog({
  open,
  title,
  description,
  confirmLabel,
  reasonLabel,
  reason = "",
  reasonRequired = false,
  isSaving,
  returnFocusTo,
  onReasonChange,
  onConfirm,
  onClose,
}: LogisticsActionDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const firstControlRef = useRef<HTMLTextAreaElement | HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    firstControlRef.current?.focus();
    return () => returnFocusTo?.focus();
  }, [open, returnFocusTo]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) onClose(); }}
    >
      <section
        ref={dialogRef}
        className="action-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !isSaving) onClose();
          if (event.key !== "Tab") return;
          const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])") ?? []);
          if (controls.length === 0) return;
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}
      >
        <h3 id={titleId}>{title}</h3>
        <p id={descriptionId}>{description}</p>
        {reasonLabel && (
          <label htmlFor={reasonId}>
            {reasonLabel}{reasonRequired ? " (required)" : " (optional)"}
            <textarea
              ref={firstControlRef as RefObject<HTMLTextAreaElement>}
              id={reasonId}
              value={reason}
              required={reasonRequired}
              maxLength={2000}
              disabled={isSaving}
              onChange={(event) => onReasonChange?.(event.target.value)}
            />
          </label>
        )}
        <div className="actions">
          <button ref={!reasonLabel ? firstControlRef as RefObject<HTMLButtonElement> : undefined} type="button" disabled={isSaving || (reasonRequired && !reason.trim())} onClick={onConfirm}>
            {isSaving ? "Working..." : confirmLabel}
          </button>
          <button type="button" className="ghost" disabled={isSaving} onClick={onClose}>Cancel</button>
        </div>
      </section>
    </div>
  );
}
