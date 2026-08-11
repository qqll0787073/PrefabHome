import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RFQMessageRecord } from "../../types";
import {
  buyerConversationHref,
  buyerConversationManufacturer,
  buyerConversationProductHref,
  fetchBuyerConversations,
  selectBuyerConversations,
  sendBuyerMessage,
  type BuyerConversation,
} from "../../lib/buyerMessages";
import { isTerminalRFQStatus } from "../../lib/rfqQuoteWorkflow";
import { rfqConversationMessageMaxLength, rfqSnapshotTitle, rfqStatusLabels } from "../../lib/rfq";

interface BuyerMessagesWorkspaceProps {
  selectedConversationId?: string | null;
  onSelectedConversationChange?: (id: string | null) => void;
}

export function BuyerMessagesLoadingState() {
  return <div className="logistics-workspace-state panel" role="status" aria-live="polite" aria-busy="true">Loading your conversations...</div>;
}

export function BuyerMessagesEmptyState() {
  return <div className="logistics-workspace-state panel"><h3>No conversations yet</h3><p>Your RFQ conversations will appear here.</p><a href="/marketplace?view=browse">Browse Marketplace</a></div>;
}

export function BuyerMessagesErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="logistics-workspace-state workspace-error" role="alert"><h3>Messages could not load</h3><p>Your conversations are temporarily unavailable. Please try again.</p><button type="button" onClick={onRetry}>Retry</button></div>;
}

export function shouldHandleBuyerMessageNavigation(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey
    && event.currentTarget.target !== "_blank" && !event.currentTarget.hasAttribute("download");
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function BuyerConversationThread({ conversation, sending, onSend }: { conversation: BuyerConversation; sending: boolean; onSend: (message: string) => Promise<void> }) {
  const [reply, setReply] = useState("");
  const [sendError, setSendError] = useState(false);
  const closed = isTerminalRFQStatus(conversation.rfq.status);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const message = reply.trim();
    if (sending || !message || message.length > rfqConversationMessageMaxLength) return;
    setSendError(false);
    try { await onSend(message); setReply(""); } catch { setSendError(true); }
  }
  return <section className="request-detail rfq-conversation panel" aria-labelledby="conversation-heading">
    <header className="request-detail-header">
      <div><p className="eyebrow">{rfqStatusLabels[conversation.rfq.status]}</p><h3 id="conversation-heading">{rfqSnapshotTitle(conversation.rfq.product_snapshot)}</h3><p>{buyerConversationManufacturer(conversation)}</p></div>
      <div className="actions"><a href={buyerConversationProductHref(conversation)}>View Product</a><a href={`/marketplace?view=dashboard&workspace=rfqs&record=${conversation.rfq.id}`}>View RFQ</a></div>
    </header>
    <div className="conversation-thread" aria-live="polite">
      {conversation.messages.length === 0 && <p>No messages in this conversation yet.</p>}
      {conversation.messages.map((message) => <article className={`message-bubble ${message.sender_role}`} key={message.id}><strong>{message.sender_role === "buyer" ? "You" : message.sender_role === "manufacturer" ? "Manufacturer" : "PrefabHome team"}</strong><p>{message.message}</p><time dateTime={message.created_at}>{formatDate(message.created_at)}</time></article>)}
    </div>
    {sendError && <p className="form-error" role="alert">Message could not be sent. Please try again.</p>}
    {closed ? <p className="form-notice">This RFQ is closed, so its conversation is read-only.</p> : <form className="messages-composer" onSubmit={(event) => void submit(event)}>
      <label htmlFor="buyer-message-reply">Reply</label>
      <textarea id="buyer-message-reply" value={reply} maxLength={rfqConversationMessageMaxLength} onChange={(event) => setReply(event.target.value)} disabled={sending} />
      <div className="actions"><span>{reply.length}/{rfqConversationMessageMaxLength}</span><button type="submit" disabled={sending || !reply.trim()}>{sending ? "Sending..." : "Send Message"}</button></div>
    </form>}
  </section>;
}

export function BuyerMessagesWorkspace({ selectedConversationId = null, onSelectedConversationChange }: BuyerMessagesWorkspaceProps) {
  const [conversations, setConversations] = useState<BuyerConversation[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending] = useState(false);
  const loadSequence = useRef(0);
  const active = useRef(true);
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setIsLoading(true); setLoadError(false);
    try { const next = await fetchBuyerConversations(); if (sequence === loadSequence.current) setConversations(next); }
    catch { if (sequence === loadSequence.current) setLoadError(true); }
    finally { if (sequence === loadSequence.current) setIsLoading(false); }
  }, []);
  useEffect(() => { active.current = true; void load(); return () => { active.current = false; loadSequence.current += 1; }; }, [load]);
  const visible = useMemo(() => selectBuyerConversations(conversations, search), [conversations, search]);
  const selected = conversations.find(({ rfq }) => rfq.id === selectedConversationId) ?? null;

  async function handleSend(message: string) {
    if (!selected) return;
    setSending(true);
    try {
      const sent = await sendBuyerMessage(selected.rfq.id, message);
      if (active.current) setConversations((current) => current.map((item) => item.rfq.id === selected.rfq.id
        ? { ...item, messages: [...item.messages, sent], latestMessage: sent } : item));
    } finally { if (active.current) setSending(false); }
  }

  return <section className="buyer-messages" aria-labelledby="buyer-messages-heading">
    <div className="workspace-toolbar"><div><p className="eyebrow">Buyer workspace</p><h3 id="buyer-messages-heading">Messages</h3><p>Continue conversations connected to your RFQs.</p></div><a href="/marketplace?view=browse">Marketplace</a></div>
    {isLoading && <BuyerMessagesLoadingState />}
    {!isLoading && loadError && <BuyerMessagesErrorState onRetry={() => void load()} />}
    {!isLoading && !loadError && conversations.length === 0 && <BuyerMessagesEmptyState />}
    {!isLoading && !loadError && conversations.length > 0 && <div className="logistics-split-view">
      <aside className="request-list" aria-label="Conversations">
        <label htmlFor="buyer-message-search">Search conversations</label><input id="buyer-message-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Product, manufacturer, or message" />
        {visible.length === 0 && <div className="logistics-workspace-state" role="status"><p>No conversations match your search.</p><button type="button" onClick={() => setSearch("")}>Clear search</button></div>}
        {visible.map((conversation) => <a className={selected?.rfq.id === conversation.rfq.id ? "request-list-item active" : "request-list-item"} aria-current={selected?.rfq.id === conversation.rfq.id ? "page" : undefined} key={conversation.rfq.id} href={buyerConversationHref(conversation.rfq.id)} onClick={(event) => { if (!shouldHandleBuyerMessageNavigation(event)) return; event.preventDefault(); onSelectedConversationChange?.(conversation.rfq.id); }}><strong>{rfqSnapshotTitle(conversation.rfq.product_snapshot)}</strong><span>{buyerConversationManufacturer(conversation)}</span><small>{conversation.latestMessage?.message ?? "No messages yet"}</small></a>)}
      </aside>
      {selected ? <BuyerConversationThread key={selected.rfq.id} conversation={selected} sending={sending} onSend={handleSend} /> : <div className="logistics-workspace-state panel"><h3>Select a conversation</h3><p>Choose an RFQ conversation to read its messages.</p></div>}
    </div>}
  </section>;
}
