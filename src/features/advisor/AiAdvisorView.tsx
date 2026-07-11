export function AiAdvisorView() {
  return (
    <section className="panel advisor">
      <p className="eyebrow">AI Home Advisor</p>
      <h2>Zoning, model fit, and import planning assistant</h2>
      <p>
        Production will call a server-side AI endpoint. API keys stay on the server; the
        browser sends only buyer questions and selected listing context.
      </p>
      <textarea placeholder="Describe your lot, budget, intended use, and state..." />
      <button>Generate Planning Checklist</button>
    </section>
  );
}
