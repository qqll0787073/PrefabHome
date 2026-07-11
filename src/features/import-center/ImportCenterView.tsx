import { importDocumentChecklist } from "../../app/constants";

export function ImportCenterView() {
  return (
    <section className="panel">
      <p className="eyebrow">Import & Customs Document Center</p>
      <h2>Document readiness</h2>
      <div className="document-list">
        {importDocumentChecklist.map((item) => (
          <label key={item}>
            <input type="checkbox" /> {item}
          </label>
        ))}
      </div>
    </section>
  );
}
