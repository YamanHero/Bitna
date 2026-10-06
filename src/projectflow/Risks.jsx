import { useState } from 'react';
import {
  KINDS,
  LEVELS,
  RISKS_KEY,
  exposure,
  exposureLevel,
  kindLabel,
  useList,
} from './registers.js';

const EMPTY = {
  title: '',
  kind: 'risk',
  projectId: '',
  probability: 2,
  severity: 2,
  owner: '',
  mitigation: '',
  due: '',
};

export default function Risks({ store }) {
  const risks = useList(RISKS_KEY);
  const [form, setForm] = useState(EMPTY);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const projectName = (id) => store.projects.find((p) => p.id === id)?.name;

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    risks.add({
      ...form,
      title: form.title.trim(),
      probability: Number(form.probability),
      severity: Number(form.severity),
      status: 'open',
    });
    setForm(EMPTY);
  };

  const sorted = [...risks.items].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    return exposure(b) - exposure(a);
  });

  return (
    <>
      <form className="card pf-form" onSubmit={submit}>
        <label>
          תיאור
          <input value={form.title} onChange={set('title')} required />
        </label>
        <label>
          סוג
          <select value={form.kind} onChange={set('kind')}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
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
          הסתברות
          <select value={form.probability} onChange={set('probability')}>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          חומרה
          <select value={form.severity} onChange={set('severity')}>
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          אחראי
          <input value={form.owner} onChange={set('owner')} />
        </label>
        <label>
          צעד מונע / טיפול
          <input value={form.mitigation} onChange={set('mitigation')} />
        </label>
        <label>
          יעד לטיפול
          <input type="date" value={form.due} onChange={set('due')} />
        </label>
        <button type="submit">הוספה</button>
      </form>

      {sorted.length === 0 ? (
        <p className="muted">אין סיכונים רשומים. סיכון שעלה במכרז ממשיך איתך לביצוע.</p>
      ) : (
        <div className="pf-list">
          {sorted.map((r) => {
            const closed = r.status === 'closed';
            return (
              <div key={r.id} className={`card pf-item${closed ? ' closed' : ''}`}>
                <div className="pf-item-head">
                  <strong>{r.title}</strong>
                  <span className={`badge ${exposureLevel(r)}`}>חשיפה {exposure(r)}</span>
                </div>
                <div className="pf-meta">
                  <span className={`kind kind-${r.kind}`}>{kindLabel(r.kind)}</span>
                  {projectName(r.projectId) && <span>{projectName(r.projectId)}</span>}
                  {r.owner && <span>אחראי: {r.owner}</span>}
                  {r.due && <span>יעד: {r.due}</span>}
                </div>
                {r.mitigation && <p className="pf-note">טיפול: {r.mitigation}</p>}
                <div className="row">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => risks.update(r.id, { status: closed ? 'open' : 'closed' })}
                  >
                    {closed ? 'פתיחה מחדש' : 'סגירה'}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => window.confirm('למחוק את הרשומה?') && risks.remove(r.id)}
                  >
                    מחיקה
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
