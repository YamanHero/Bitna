import { useState } from 'react';
import { CHANGES_KEY, CR_STATUS, shekel, useList } from './registers.js';

const EMPTY = {
  title: '',
  projectId: '',
  reason: '',
  requestedBy: '',
  scopeImpact: '',
  scheduleImpact: '',
  costImpact: '',
};

const statusLabel = (v) => (CR_STATUS.find((s) => s.value === v) || CR_STATUS[0]).label;

export default function ChangeRequests({ store }) {
  const changes = useList(CHANGES_KEY);
  const [form, setForm] = useState(EMPTY);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const projectName = (id) => store.projects.find((p) => p.id === id)?.name;

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const seq = changes.items.length + 1;
    changes.add({
      ...form,
      title: form.title.trim(),
      number: `CR-${String(seq).padStart(3, '0')}`,
      status: 'open',
    });
    setForm(EMPTY);
  };

  return (
    <>
      <p className="muted">רק שינוי שאושר נכנס לבסיס התוכנית (Baseline).</p>
      <form className="card pf-form" onSubmit={submit}>
        <label>
          השינוי המבוקש
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
          סיבה
          <input value={form.reason} onChange={set('reason')} />
        </label>
        <label>
          מי ביקש
          <input value={form.requestedBy} onChange={set('requestedBy')} />
        </label>
        <label>
          השפעה על היקף
          <input value={form.scopeImpact} onChange={set('scopeImpact')} />
        </label>
        <label>
          השפעה על לוח זמנים
          <input value={form.scheduleImpact} onChange={set('scheduleImpact')} />
        </label>
        <label>
          השפעה על עלות (₪)
          <input type="number" value={form.costImpact} onChange={set('costImpact')} />
        </label>
        <button type="submit">פתיחת בקשה</button>
      </form>

      {changes.items.length === 0 ? (
        <p className="muted">אין בקשות שינוי.</p>
      ) : (
        <div className="pf-list">
          {changes.items.map((c) => (
            <div key={c.id} className="card pf-item">
              <div className="pf-item-head">
                <strong>
                  {c.number} · {c.title}
                </strong>
                <span className={`badge cr-${c.status}`}>{statusLabel(c.status)}</span>
              </div>
              <div className="pf-meta">
                {projectName(c.projectId) && <span>{projectName(c.projectId)}</span>}
                {c.requestedBy && <span>ביקש: {c.requestedBy}</span>}
                {c.costImpact !== '' && c.costImpact != null && (
                  <span>עלות: {shekel(c.costImpact)}</span>
                )}
              </div>
              {c.reason && <p className="pf-note">סיבה: {c.reason}</p>}
              {c.scopeImpact && <p className="pf-note">היקף: {c.scopeImpact}</p>}
              {c.scheduleImpact && <p className="pf-note">לוח זמנים: {c.scheduleImpact}</p>}
              <div className="row">
                {CR_STATUS.filter((s) => s.value !== c.status).map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className="ghost"
                    onClick={() => changes.update(c.id, { status: s.value })}
                  >
                    {s.value === 'open' ? 'החזרה להחלטה' : s.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="danger"
                  onClick={() => window.confirm('למחוק את הבקשה?') && changes.remove(c.id)}
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
