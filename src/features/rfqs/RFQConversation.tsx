import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import { fetchRFQMessages, postRFQMessage, rfqSnapshotTitle, rfqStatusLabels } from "../../lib/rfq";
import type { RFQMessageRecord, RFQWithDetails } from "../../types";

interface RFQConversationProps {
  rfq: RFQWithDetails | null;
  readOnly?: boolean;
  onMessagePosted?: () => void;
}

export function RFQConversation({ rfq, readOnly = false, onMessagePosted }: RFQConversationProps) {
  const [messages, setMessages] = useState<RFQMessageRecord[]>([]);
  const [reply, setReply] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function loadMessages() {
    if (!rfq) return;
    setIsLoading(true);
    setErrors([]);
    try {
      setMessages(await fetchRFQMessages(rfq.id));
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to load RFQ messages."]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setMessages([]);
    setReply("");
    void loadMessages();
  }, [rfq?.id]);

  async function submitReply() {
    if (!rfq || !reply.trim()) return;
    setIsPosting(true);
    setErrors([]);
    try {
      await postRFQMessage(rfq.id, reply);
      setReply("");
      await loadMessages();
      onMessagePosted?.();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to post RFQ message."]);
    } finally {
      setIsPosting(false);
    }
  }

  if (!rfq) {
    return (
      <section className="panel">
        <p>Select an RFQ to read the conversation.</p>
      </section>
    );
  }

  const productName = rfqSnapshotTitle(rfq.product_snapshot);

  return (
    <section className="panel rfq-conversation">
      <p className="eyebrow">{rfqStatusLabels[rfq.status]}</p>
      <h3>{productName}</h3>
      <p>
        {rfq.requested_quantity} units to {rfq.destination_country}
        {rfq.destination_port ? ` via ${rfq.destination_port}` : ""}
        {rfq.incoterm ? ` (${rfq.incoterm})` : ""}
      </p>
      <ErrorList errors={errors} />
      {isLoading && <LoadingState message="Loading RFQ conversation..." />}
      {!isLoading && messages.length === 0 && <p>No messages yet.</p>}
      <div className="conversation-thread">
        {messages.map((item) => (
          <article className={`message-bubble ${item.sender_role}`} key={item.id}>
            <p className="eyebrow">{item.sender_role}</p>
            <p>{item.message}</p>
            <span>{new Date(item.created_at).toLocaleString()}</span>
          </article>
        ))}
      </div>
      {!readOnly && (
        <>
          <label>
            Reply
            <textarea
              value={reply}
              maxLength={4000}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Write a message..."
            />
          </label>
          <div className="actions">
            <button type="button" disabled={isPosting || !reply.trim()} onClick={() => void submitReply()}>
              {isPosting ? "Posting..." : "Post Reply"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
