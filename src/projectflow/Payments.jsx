import { useState } from 'react';
import { PAYMENTS_KEY, PAYMENT_CHECKS, paymentReady, shekel, useList } from './registers.js';

const EMPTY = { projectId: '', title: '', amount: '' };

export default function Payments({ store }) {
  const payments = useList(PAYMENTS_KEY);
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const project = (id) => store.projects.find((p) => p.id === id);

  const submit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.projectId) return;
    payments.add({
      ...form,
      title: form.title.trim(),
      amount: Number(form.amount) || 0,
      checks: {},
      status: 'pending',
    });
    setForm({ ...EMPTY, projectId: form.projectId });
  };

  const toggleCheck = (p, key) =>
    payments.update(p.id, { checks: { ...p.checks, [key]: !p.checks?.[key] } });

  const markPaid = (p) => {
    if (!paymentReady(p)) return window.alert('לא ניתן לשחרר תשלום לפני שכל התנאים התקיימו.');
    payments.update(p.id, { status: 'paid' });
  };

  const shown = payments.items.filter((p) => !filter || p.projectId === filter);
  const selected = project(filter);
  const planned = shown.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const paid = shown.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const contract = selected && selected.budget !== '' ? Number(selected.budget) : null;
  const overPlanned = contract != null && !Number.isNaN(contract) && planned > contract;

  return (
    <>
      <p className="muted">תשלום משתחרר רק אחרי שהתוצר התקבל, ההערות נסגרו, הקבלה נחתמה והחשבונית תקינה.</p>
      <form className="card pf-form" onSubmit={submit}>
        <label>
          פרויקט
          <select value={form.projectId} onChange={set('projectId')} required>
            <option value="">בחרו פרויקט</option>
            {store.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          אבן דרך / תוצר
          <input value={form.title} onChange={set('title')} required />
        </label>
        <label>
          סכום (₪)
          <input type="number" min="0" value={form.amount} onChange={set('amount')} />
        </label>
        <button type="submit">הוספת תשלום</button>
      </form>

      <label className="pf-filter">
        סינון לפי פרויקט
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">כל הפרויקטים</option>
          {store.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div className="stats">
        <div className="stat">
          <b>{contract != null ? shekel(contract) : '—'}</b>
          <span>{selected ? 'תקציב / ערך חוזה' : 'בחרו פרויקט להצגת תקציב'}</span>
        </div>
        <div className="stat">
          <b>{shekel(planned)}</b>
          <span>מתוכנן לתשלום</span>
        </div>
        <div className="stat">
          <b>{shekel(paid)}</b>
          <span>שולם</span>
        </div>
        <div className={`stat${overPlanned ? ' stat-bad' : ''}`}>
          <b>{contract != null ? shekel(contract - paid) : '—'}</b>
          <span>{overPlanned ? 'יתרה (התשלומים המתוכננים חורגים מהתקציב)' : 'יתרה'}</span>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="muted">אין תשלומים רשומים.</p>
      ) : (
        <div className="pf-list" style={{ marginTop: 12 }}>
          {shown.map((p) => {
            const ready = paymentReady(p);
            const isPaid = p.status === 'paid';
            return (
              <div key={p.id} className={`card pf-item${isPaid ? ' closed' : ''}`}>
                <div className="pf-item-head">
                  <strong>{p.title}</strong>
                  <span>{shekel(p.amount)}</span>
                </div>
                <div className="pf-meta">
                  {project(p.projectId) && <span>{project(p.projectId).name}</span>}
                  <span>{isPaid ? 'שולם' : ready ? 'מוכן לשחרור' : 'ממתין לתנאים'}</span>
                </div>
                {!isPaid && (
                  <div className="checks">
                    {PAYMENT_CHECKS.map((c) => (
                      <label key={c.key}>
                        <input
                          type="checkbox"
                          checked={!!p.checks?.[c.key]}
                          onChange={() => toggleCheck(p, c.key)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                )}
                <div className="row">
                  {isPaid ? (
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => payments.update(p.id, { status: 'pending' })}
                    >
                      ביטול סימון תשלום
                    </button>
                  ) : (
                    <button type="button" onClick={() => markPaid(p)} disabled={!ready}>
                      סימון כשולם
                    </button>
                  )}
                  <button
                    type="button"
                    className="danger"
                    onClick={() => window.confirm('למחוק את התשלום?') && payments.remove(p.id)}
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
