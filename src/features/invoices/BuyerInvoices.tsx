import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  fetchBuyerInvoices,
  fetchInvoiceEvents,
  fetchInvoiceLineItems,
} from "../../lib/invoices";
import type { InvoiceEventRecord, InvoiceLineItemRecord, InvoiceRecord } from "../../types";
import { InvoiceSummary } from "./InvoiceSummary";
import { buyerInvoiceNextAction } from "../../lib/buyerNextActions";
import { BuyerNextActionNotice } from "../dashboard/BuyerNextActionNotice";

interface BuyerInvoicesProps {
  authMode: "supabase" | "demo";
  selectedInvoiceId?: string | null;
}

export function BuyerInvoices({ authMode, selectedInvoiceId = null }: BuyerInvoicesProps) {
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
          const invoiceRows = await fetchBuyerInvoices();
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
      <h4>Invoices</h4>
      {isLoading && <LoadingState message="Loading invoices..." />}
      <ErrorList errors={errors} />
      <p className="form-notice">Invoices are read-only for Buyers. No payment has been recorded.</p>
      {invoices.length === 0 && !isLoading && <p>No invoices yet.</p>}
      <div className="review-list">
        {invoices.filter((invoice) => !selectedInvoiceId || invoice.id === selectedInvoiceId).map((invoice) => (
          <div key={invoice.id}><InvoiceSummary
            key={invoice.id}
            invoice={invoice}
            lineItems={itemsByInvoice[invoice.id] ?? []}
            events={eventsByInvoice[invoice.id] ?? []}
          /><BuyerNextActionNotice action={buyerInvoiceNextAction(invoice.status, invoice.id)} /><nav className="actions" aria-label="Invoice context"><a href={`/marketplace?view=dashboard&workspace=orders&record=${invoice.purchase_order_id}`}>View Purchase Order {invoice.purchase_order_number}</a><a href={`/marketplace?view=dashboard&workspace=contracts&record=${invoice.contract_id}`}>View Contract {invoice.contract_number}</a></nav></div>
        ))}
      </div>
      {selectedInvoiceId && !isLoading && !invoices.some((invoice) => invoice.id === selectedInvoiceId) && <p role="status">This invoice is unavailable to your Buyer account.</p>}
    </section>
  );
}
