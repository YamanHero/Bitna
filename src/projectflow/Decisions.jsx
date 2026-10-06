import { useState } from 'react';
import { DECISIONS_KEY, useList } from './registers.js';

const today = () => new Date().toISOString().slice(0, 10);
const empty = () => ({ title: '', projectId: '', decision: '', decidedBy: '', date: today() });

export default function Decisions({ store }) {
  const decisions = useList(DECISIONS_KEY);
  const [form, setForm] = useState(empty);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const projectName = (id) => store.projects.find((p) => p.id === id)?.name;

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    decisions.add({ ...form, title: form.title.trim() });
    setForm(empty());
  };

  const sorted = [...decisions.items].sort((a, b) =>
    (b.date || '').localeCompare(a.date || '')
  );

  return (
    <>
      <form className="card pf-form" onSubmit={submit}>
        <label>
          נושא ההחלטה
          <input value={form.title} onChange={set('title')} required />
        </label>
        <label>
          פרויקט
          <select value={form.projectId} onChange={set('projectId')}>
            <option value="">—</option>
            {store.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          ההחלטה
          <input value={form.decision} onChange={set('decision')} />
        </label>
        <label>
          מי החליט
          <input value={form.decidedBy} onChange={set('decidedBy')} />
        </label>
        <label>
          תאריך
          <input type="date" value={form.date} onChange={set('date')} />
        </label>
        <button type="submit">תיעוד החלטה</button>
      </form>

      {sorted.length === 0 ? (
        <p className="muted">יומן ההחלטות ריק. כאן נשמרים אישורים, בחירת ספק, החלטות Go/No-Go.</p>
      ) : (
        <div className="pf-list">
          {sorted.map((d) => (
            <div key={d.id} className="card pf-item">
              <div className="pf-item-head">
                <strong>{d.title}</strong>
                {d.date && <span className="muted">{d.date}</span>}
              </div>
              <div className="pf-meta">
                {projectName(d.projectId) && <span>{projectName(d.projectId)}</span>}
                {d.decidedBy && <span>הוחלט ע״י: {d.decidedBy}</span>}
              </div>
              {d.decision && <p className="pf-note">{d.decision}</p>}
              <div className="row">
                <button
                  type="button"
                  className="danger"
                  onClick={() => window.confirm('למחוק את ההחלטה?') && decisions.remove(d.id)}
                >
                  מחיקה
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
