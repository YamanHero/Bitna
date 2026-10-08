import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TEAM_KEY, useList } from './registers.js';
import { stagesOf } from './storage.js';

const ROLES = [
  { value: 'internal', label: 'פנימי' },
  { value: 'vendor', label: 'ספק' },
  { value: 'other', label: 'גורם חיצוני' },
];

const today = () => new Date().toISOString().slice(0, 10);

// כל המשימות של כל הפרויקטים, לפי אחראי, עם סימון וסינון.
function TaskBoard({ store, team }) {
  const [who, setWho] = useState('all');
  const [proj, setProj] = useState('all');
  const [status, setStatus] = useState('open');
  const t0 = today();

  const all = store.projects.flatMap((p) =>
    p.tasks.map((t) => ({
      ...t,
      project: p,
      stageTitle: stagesOf(p).find((s) => s.id === t.stage)?.title || '',
    }))
  );
  const open = all.filter((t) => !t.done);
  const stats = {
    open: open.length,
    late: open.filter((t) => t.due && t.due < t0).length,
    none: open.filter((t) => !t.assignee).length,
  };

  const shown = all
    .filter((t) => (who === 'all' ? true : who === 'none' ? !t.assignee : t.assignee === who))
    .filter((t) => proj === 'all' || t.project.id === proj)
    .filter((t) =>
      status === 'all' ? true : status === 'done' ? t.done : status === 'late' ? !t.done && t.due && t.due < t0 : !t.done
    )
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));

  const patchTask = (t, change) =>
    store.update(t.project.id, (p) => ({
      ...p,
      tasks: p.tasks.map((x) => (x.id === t.id ? { ...x, ...change } : x)),
    }));

  return (
    <>
      <div className="stats stats-3">
        <div className="stat"><b>{stats.open}</b><span>משימות פתוחות</span></div>
        <div className={`stat${stats.late ? ' stat-bad' : ''}`}><b>{stats.late}</b><span>באיחור</span></div>
        <div className="stat"><b>{stats.none}</b><span>בלי אחראי</span></div>
      </div>

      <div className="pf-toolbar tb-gap">
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="סינון לפי אחראי">
          <option value="all">כל האחראים</option>
          <option value="none">בלי אחראי</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select value={proj} onChange={(e) => setProj(e.target.value)} aria-label="סינון לפי פרויקט">
          <option value="all">כל הפרויקטים</option>
          {store.projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="סינון לפי מצב">
          <option value="open">פתוחות</option>
          <option value="late">באיחור</option>
          <option value="done">הושלמו</option>
          <option value="all">הכול</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="pf-empty">
          {all.length === 0 ? 'אין משימות עדיין. צרו פרויקט והמשימות יופיעו כאן.' : 'אין משימות שמתאימות לסינון.'}
        </p>
      ) : (
        <ul className="tk-list">
          {shown.map((t) => {
            const late = !t.done && t.due && t.due < t0;
            return (
              <li key={`${t.project.id}-${t.id}`} className={`tk${t.done ? ' done' : ''}`}>
                <div className="task-top">
                  <input
                    type="checkbox"
                    id={`tk-${t.id}`}
                    checked={t.done}
                    onChange={() => patchTask(t, { done: !t.done })}
                  />
                  <label htmlFor={`tk-${t.id}`}>{t.title}</label>
                  {late && <span className="badge high">באיחור</span>}
                </div>
                <div className="tk-where">
                  <Link to={`/projectflow/${t.project.id}`}>{t.project.name}</Link>
                  <span className="muted">· {t.stageTitle}</span>
                </div>
                <div className="task-meta">
                  <select
                    value={t.assignee || ''}
                    onChange={(e) => patchTask(t, { assignee: e.target.value })}
                    aria-label={`אחראי למשימה ${t.title}`}
                  >
                    <option value="">ללא אחראי</option>
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={t.due || ''}
                    onChange={(e) => patchTask(t, { due: e.target.value })}
                    aria-label={`יעד למשימה ${t.title}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

const EMPTY = { name: '', org: '', role: '', kind: 'internal', contact: '' };

function Team({ store, team }) {
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const t0 = today();

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const data = { ...form, name: form.name.trim(), org: form.org.trim(), role: form.role.trim(), contact: form.contact.trim() };
    if (editId) team.update(editId, data);
    else team.add(data);
    setForm(EMPTY);
    setEditId(null);
  };
  const edit = (m) => {
    setEditId(m.id);
    setForm({ name: m.name, org: m.org || '', role: m.role || '', kind: m.kind || 'internal', contact: m.contact || '' });
  };
  const remove = (m) => {
    if (!window.confirm(`להסיר את ${m.name}? המשימות ששויכו אליו יישארו בלי אחראי.`)) return;
    store.projects.forEach((p) => {
      if (p.tasks.some((t) => t.assignee === m.id)) {
        store.update(p.id, (x) => ({
          ...x,
          tasks: x.tasks.map((t) => (t.assignee === m.id ? { ...t, assignee: '' } : t)),
        }));
      }
    });
    team.remove(m.id);
  };

  const load = (m) => {
    const mine = store.projects.flatMap((p) => p.tasks).filter((t) => t.assignee === m.id && !t.done);
    return { open: mine.length, late: mine.filter((t) => t.due && t.due < t0).length };
  };

  return (
    <>
      <form className="card pf-form" onSubmit={submit}>
        <label>
          שם
          <input value={form.name} onChange={set('name')} required />
        </label>
        <label>
          גוף או יחידה
          <input value={form.org} onChange={set('org')} list="pf-orgs" placeholder="למשל: אגף טכנולוגיה, או שם הספק" />
          <datalist id="pf-orgs">
            {[...new Set(team.items.map((m) => m.org).filter(Boolean))].map((o) => <option key={o} value={o} />)}
          </datalist>
        </label>
        <label>
          תפקיד
          <input value={form.role} onChange={set('role')} placeholder="למשל: מנהל מערכות מידע" />
        </label>
        <label>
          שייכות
          <select value={form.kind} onChange={set('kind')}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </label>
        <label>
          טלפון או אימייל
          <input value={form.contact} onChange={set('contact')} />
        </label>
        <div className="row">
          <button type="submit">{editId ? 'שמירה' : 'הוספת חבר צוות'}</button>
          {editId && (
            <button type="button" className="ghost" onClick={() => { setEditId(null); setForm(EMPTY); }}>
              ביטול
            </button>
          )}
        </div>
      </form>

      {team.items.length === 0 ? (
        <p className="pf-empty">אין חברי צוות עדיין. הוסיפו את הראשון, ואז אפשר לשייך אליו משימות.</p>
      ) : (
        <div className="pf-list">
          {team.items.map((m) => {
            const l = load(m);
            return (
              <div key={m.id} className="card pf-item">
                <div className="pf-item-head">
                  <strong>{m.name}</strong>
                  <span>
                    <span className="badge">{l.open} פתוחות</span>{' '}
                    {l.late > 0 && <span className="badge high">{l.late} באיחור</span>}
                  </span>
                </div>
                <div className="pf-meta">
                  {m.org && <span>{m.org}</span>}
                  <span>{ROLES.find((r) => r.value === m.kind)?.label || 'פנימי'}</span>
                  {m.role && <span>{m.role}</span>}
                  {m.contact && <span dir="ltr">{m.contact}</span>}
                </div>
                <div className="row">
                  <button type="button" className="ghost" onClick={() => edit(m)}>עריכה</button>
                  <button type="button" className="danger" onClick={() => remove(m)}>הסרה</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function Tasks({ store }) {
  const team = useList(TEAM_KEY);
  const [tab, setTab] = useState('tasks');
  return (
    <>
      <div className="seg tabs2" role="tablist" aria-label="משימות וצוות">
        <button type="button" role="tab" aria-selected={tab === 'tasks'} className={tab === 'tasks' ? 'on' : ''} onClick={() => setTab('tasks')}>
          משימות
        </button>
        <button type="button" role="tab" aria-selected={tab === 'team'} className={tab === 'team' ? 'on' : ''} onClick={() => setTab('team')}>
          צוות ({team.items.length})
        </button>
      </div>
      {tab === 'tasks' ? <TaskBoard store={store} team={team.items} /> : <Team store={store} team={team} />}
    </>
  );
}
