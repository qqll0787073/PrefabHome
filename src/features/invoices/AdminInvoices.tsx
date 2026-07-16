import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  fetchAdminInvoices,
  fetchInvoiceEvents,
  fetchInvoiceLineItems,
} from "../../lib/invoices";
import type { InvoiceEventRecord, InvoiceLineItemRecord, InvoiceRecord } from "../../types";
import { InvoiceSummary } from "./InvoiceSummary";

interface AdminInvoicesProps {
  authMode: "supabase" | "demo";
}

export function AdminInvoices({ authMode }: AdminInvoicesProps) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [itemsByInvoice, setItemsByInvoice] = useState<Record<string, InvoiceLineItemRecord[]>>({});
  const [eventsByInvoice, setEventsByInvoice] = useState<Record<string, InvoiceEventRecord[]>>({});
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    async function loadInvoices() {
      setErrors([]);
      setIsLoading(true);
      try {
        if (authMode === "demo") {
          setInvoices([]);
          setItemsByInvoice({});
          setEventsByInvoice({});
        } else {
          const invoiceRows = await fetchAdminInvoices();
          const [itemEntries, eventEntries] = await Promise.all([
            Promise.all(invoiceRows.map(async (invoice) => [invoice.id, await fetchInvoiceLineItems(invoice.id)] as const)),
            Promise.all(invoiceRows.map(async (invoice) => [invoice.id, await fetchInvoiceEvents(invoice.id)] as const)),
          ]);
          setInvoices(invoiceRows);
          setItemsByInvoice(Object.fromEntries(itemEntries));
          setEventsByInvoice(Object.fromEntries(eventEntries));
        }
      } catch (error) {
        setErrors([error instanceof Error ? error.message : "Unable to load invoices."]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadInvoices();
  }, [authMode]);

  return (
    <section className="quote-panel">
      <h4>Admin Invoice Management</h4>
      {isLoading && <LoadingState message="Loading invoices..." />}
      <ErrorList errors={errors} />
      <p className="form-notice">Admin invoice access is read-only in PH-009A.</p>
      {invoices.length === 0 && !isLoading && <p>No invoices yet.</p>}
      <div className="review-list">
        {invoices.map((invoice) => (
          <InvoiceSummary
            key={invoice.id}
            invoice={invoice}
            lineItems={itemsByInvoice[invoice.id] ?? []}
            events={eventsByInvoice[invoice.id] ?? []}
            showSnapshots
          />
        ))}
      </div>
    </section>
  );
}
