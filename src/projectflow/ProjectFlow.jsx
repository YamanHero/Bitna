import { useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SyncBadge } from '../lib/AuthGate.jsx';
import { ThemePicker } from '../lib/theme.jsx';
import Assistant from './Assistant.jsx';
import Backup from './Backup.jsx';
import Board from './Board.jsx';
import ChangeRequests from './ChangeRequests.jsx';
import Dashboard from './Dashboard.jsx';
import Decisions from './Decisions.jsx';
import Payments from './Payments.jsx';
import Risks from './Risks.jsx';
import { STAGES } from './stages.js';
import {
  currentStage,
  daysLeft,
  makeProject,
  openBefore,
  overallProgress,
  overdueStages,
  stageStatus,
  uid,
  useProjects,
} from './storage.js';

const TYPES = { it: 'פרויקט IT', procurement: 'רכש' };

function formatBudget(b) {
  const n = Number(b);
  return b !== '' && b != null && !Number.isNaN(n) ? `₪${n.toLocaleString('he-IL')}` : null;
}

// פס השלבים: שלב שהושלם, השלב הנוכחי, ושלבים שעוד לא התחילו.
function StageRail({ project }) {
  const cur = currentStage(project);
  return (
    <ol className="rail" aria-label="התקדמות בשלבי הפרויקט">
      {STAGES.map((s) => {
        const st = stageStatus(project, s.id);
        const state = st.complete ? 'done' : cur?.id === s.id ? 'current' : 'todo';
        return (
          <li key={s.id} className={`rail-step ${state}`} title={s.title}>
            <span className="sr">
              {s.title}
              {st.complete ? ', הושלם' : cur?.id === s.id ? ', השלב הנוכחי' : ''}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// תג שמראה אם יעד ההפעלה קרוב או שעבר.
function TargetBadge({ project }) {
  const d = daysLeft(project);
  if (d === null || overallProgress(project) === 100) return null;
  if (d < 0) return <span className="badge high">יעד ההפעלה עבר לפני {-d} ימים</span>;
  if (d <= 30) {
    return <span className="badge mid">{d === 0 ? 'יעד ההפעלה היום' : `${d} ימים ליעד ההפעלה`}</span>;
  }
  return null;
}

function ProjectForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      className="pf-form pf-panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSubmit({ ...form, name: form.name.trim(), owner: form.owner.trim() });
      }}
    >
      <label>
        שם הפרויקט
        <input value={form.name} onChange={set('name')} required />
      </label>
      <label>
        סוג
        <select value={form.type} onChange={set('type')}>
          {Object.entries(TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label>
        אחראי
        <input value={form.owner} onChange={set('owner')} />
      </label>
      <label>
        תקציב (₪)
        <input type="number" min="0" value={form.budget} onChange={set('budget')} />
      </label>
      <label>
        יעד הפעלה
        <input type="date" value={form.targetDate} onChange={set('targetDate')} />
      </label>
      <div className="row">
        <button type="submit">{submitLabel}</button>
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            ביטול
          </button>
        )}
      </div>
    </form>
  );
}

const BLANK = { name: '', type: 'it', owner: '', budget: '', targetDate: '' };

function ProjectList({ store }) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem('pfui.view') || 'list';
    } catch {
      return 'list';
    }
  });
  const pickView = (v) => {
    setView(v);
    try {
      localStorage.setItem('pfui.view', v);
    } catch {
      /* אין שמירה מקומית */
    }
  };

  const create = (form) => {
    const p = makeProject(form);
    store.add(p);
    setAdding(false);
    navigate(`/projectflow/${p.id}`);
  };

  const query = q.trim().toLowerCase();
  const order = {
    recent: () => 0,
    name: (a, b) => a.name.localeCompare(b.name, 'he'),
    progress: (a, b) => overallProgress(b) - overallProgress(a),
    target: (a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999'),
  };
  const shown = store.projects
    .filter((p) => {
    const done = overallProgress(p) === 100;
    if (filter === 'active' && done) return false;
    if (filter === 'done' && !done) return false;
    if (!query) return true;
    return `${p.name} ${p.owner}`.toLowerCase().includes(query);
  })
    .sort(order[sort]);

  return (
    <>
      <div className="pf-toolbar">
        <input
          type="search"
          placeholder="חיפוש לפי שם או אחראי"
          aria-label="חיפוש פרויקט"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="סינון">
          <option value="all">כל הפרויקטים</option>
          <option value="active">בביצוע</option>
          <option value="done">הושלמו</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="מיון">
          <option value="recent">החדשים קודם</option>
          <option value="name">לפי שם</option>
          <option value="progress">לפי התקדמות</option>
          <option value="target">לפי יעד הפעלה</option>
        </select>
        <div className="seg" role="group" aria-label="תצוגה">
          <button type="button" className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => pickView('list')}>
            רשימה
          </button>
          <button type="button" className={view === 'board' ? 'on' : ''} aria-pressed={view === 'board'} onClick={() => pickView('board')}>
            לוח
          </button>
        </div>
        {!adding && (
          <button type="button" className="fab" onClick={() => setAdding(true)}>
            פרויקט חדש
          </button>
        )}
      </div>

      {adding && (
        <ProjectForm
          initial={BLANK}
          submitLabel="יצירת פרויקט"
          onSubmit={create}
          onCancel={() => setAdding(false)}
        />
      )}

      {store.projects.length === 0 ? (
        <p className="pf-empty">אין פרויקטים עדיין. לחצו על "פרויקט חדש" כדי להתחיל מהשלב הראשון.</p>
      ) : shown.length === 0 ? (
        <p className="pf-empty">לא נמצאו פרויקטים שמתאימים לחיפוש או לסינון.</p>
      ) : view === 'board' ? (
        <Board projects={shown} store={store} />
      ) : (
        <div className="pf-rows">
          {shown.map((p) => {
            const stage = currentStage(p);
            const pct = overallProgress(p);
            const budget = formatBudget(p.budget);
            const late = overdueStages(p).length;
            return (
              <Link key={p.id} to={`/projectflow/${p.id}`} className="pf-row">
                <div className="pf-row-main">
                  <h3>{p.name}</h3>
                  <div className="pf-meta">
                    <span>{TYPES[p.type] || p.type}</span>
                    {p.owner && <span>אחראי: {p.owner}</span>}
                    {budget && <span>{budget}</span>}
                    {p.targetDate && <span>יעד הפעלה: {p.targetDate}</span>}
                  </div>
                </div>
                <StageRail project={p} />
                <div className="pf-row-status">
                  <span className={`stamp${stage ? '' : ' finished'}`}>
                    {stage ? stage.title : 'הושלם'}
                  </span>
                  <span className="pf-pct">{pct}%</span>
                  {late > 0 && <span className="badge high">{late} באיחור</span>}
                  <TargetBadge project={p} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function Detail({ project, store }) {
  const navigate = useNavigate();
  const [sel, setSel] = useState(null);
  const [newTask, setNewTask] = useState('');
  const [editing, setEditing] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const activeId = sel ?? currentStage(project)?.id;
  const active = STAGES.find((s) => s.id === activeId) ?? STAGES[STAGES.length - 1];
  const meta = project.stageMeta[active.id] || {};
  const tasks = project.tasks.filter((t) => t.stage === active.id);
  const pct = overallProgress(project);
  const budget = formatBudget(project.budget);
  const gate = openBefore(project, active.id);
  const activeDone = stageStatus(project, active.id).complete;

  const patch = (fn) => store.update(project.id, fn);

  const toggle = (id) =>
    patch((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
  const removeTask = (id) => patch((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== id) }));
  const addTask = (e) => {
    e.preventDefault();
    const title = newTask.trim();
    if (!title) return;
    patch((p) => ({
      ...p,
      tasks: [...p.tasks, { id: uid(), stage: active.id, title, done: false }],
    }));
    setNewTask('');
  };
  const setMeta = (key) => (e) => {
    const value = e.target.value;
    patch((p) => ({
      ...p,
      stageMeta: { ...p.stageMeta, [active.id]: { ...p.stageMeta[active.id], [key]: value } },
    }));
  };
  const saveDetails = (form) => {
    patch((p) => ({
      ...p,
      name: form.name,
      type: form.type,
      owner: form.owner,
      budget: form.budget,
      targetDate: form.targetDate,
    }));
    setEditing(false);
  };
  const deleteProject = () => {
    if (window.confirm(`למחוק את "${project.name}"?`)) {
      store.remove(project.id);
      navigate('/projectflow');
    }
  };

  return (
    <>
      <p>
        <Link to="/projectflow">חזרה לכל הפרויקטים</Link>
      </p>

      {editing ? (
        <ProjectForm
          initial={{
            name: project.name,
            type: project.type,
            owner: project.owner || '',
            budget: project.budget ?? '',
            targetDate: project.targetDate || '',
          }}
          submitLabel="שמירת שינויים"
          onSubmit={saveDetails}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="pf-detail-head">
          <div>
            <h2 className="pf-title">{project.name}</h2>
            <div className="pf-meta">
              <span>{TYPES[project.type] || project.type}</span>
              {project.owner && <span>אחראי: {project.owner}</span>}
              {budget && <span>{budget}</span>}
              {project.targetDate && <span>יעד הפעלה: {project.targetDate}</span>}
              <span>התקדמות כוללת: {pct}%</span>
            </div>
            <TargetBadge project={project} />
          </div>
          <button type="button" className="ghost" onClick={() => setEditing(true)}>
            עריכת פרטים
          </button>
        </div>
      )}

      <StageRail project={project} />

      <div className="pf-detail">
        <ol className="stage-list">
          {STAGES.map((s, i) => {
            const st = stageStatus(project, s.id);
            const due = project.stageMeta[s.id]?.due;
            const late = due && due < today && !st.complete;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={`stage-btn${s.id === active.id ? ' active' : ''}${st.complete ? ' done' : ''}`}
                  onClick={() => setSel(s.id)}
                  aria-current={s.id === active.id ? 'step' : undefined}
                >
                  <span>
                    {i + 1}. {s.title}
                  </span>
                  <span className={`stage-count${late ? ' late' : ''}`}>
                    {st.complete ? '✓' : late ? 'באיחור' : `${st.done}/${st.total}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <section className="pf-panel">
          <h3 className="pf-stage-title">{active.title}</h3>

          {gate.open > 0 && !activeDone && (
            <p className="pf-gate" role="status">
              השלב הקודם, "{gate.stage.title}", עוד לא הושלם: נותרו {gate.open} משימות פתוחות. כדאי
              לסגור אותן לפני שממשיכים כאן.
            </p>
          )}

          <ul className="task-list">
            {tasks.map((t) => (
              <li key={t.id} className={`task${t.done ? ' done' : ''}`}>
                <input
                  type="checkbox"
                  id={`task-${t.id}`}
                  checked={t.done}
                  onChange={() => toggle(t.id)}
                />
                <label htmlFor={`task-${t.id}`}>{t.title}</label>
                <button
                  type="button"
                  className="ghost icon-btn"
                  onClick={() => removeTask(t.id)}
                  aria-label={`מחיקת משימה ${t.title}`}
                >
                  ✕
                </button>
              </li>
            ))}
            {tasks.length === 0 && <li className="muted">אין משימות בשלב זה.</li>}
          </ul>

          <form className="row" onSubmit={addTask}>
            <input
              type="text"
              placeholder="הוספת משימה"
              aria-label="משימה חדשה"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
            />
            <button type="submit">הוספה</button>
          </form>

          <label className="section-label" htmlFor="due">
            תאריך יעד לשלב
          </label>
          <input id="due" type="date" value={meta.due || ''} onChange={setMeta('due')} />

          <label className="section-label" htmlFor="notes">
            הערות
          </label>
          <textarea id="notes" value={meta.notes || ''} onChange={setMeta('notes')} />
        </section>
      </div>

      <p className="pf-danger-zone">
        <button type="button" className="danger" onClick={deleteProject}>
          מחיקת הפרויקט
        </button>
      </p>
    </>
  );
}

function ProjectDetail({ store }) {
  const { id } = useParams();
  const project = store.projects.find((p) => p.id === id);
  if (!project) {
    return (
      <p className="pf-empty">
        הפרויקט לא נמצא. <Link to="/projectflow">חזרה לרשימה</Link>
      </p>
    );
  }
  return <Detail key={project.id} project={project} store={store} />;
}

const ICONS = {
  projects: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  dashboard: 'M4 13h6V4H4zm0 7h6v-5H4zm10 0h6v-9h-6zm0-16v5h6V4z',
  risks: 'M12 3 2 20h20zM12 10v4m0 3v.5',
  decisions: 'M5 12l4 4L19 6',
  changes: 'M4 7h12m0 0-3-3m3 3-3 3M20 17H8m0 0 3-3m-3 3 3 3',
  payments: 'M3 7h18v10H3zM3 11h18M7 15h3',
  backup: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  assistant: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
};

const NAV = [
  ['', 'פרויקטים', 'projects'],
  ['assistant', 'עוזר', 'assistant'],
  ['dashboard', 'לוח בקרה', 'dashboard'],
  ['risks', 'סיכונים', 'risks'],
  ['decisions', 'החלטות', 'decisions', true],
  ['changes', 'בקשות שינוי', 'changes', true],
  ['payments', 'תשלומים', 'payments', true],
  ['backup', 'גיבוי', 'backup', true],
];

// במסך הטלפון שלוש הלשוניות האחרונות עוברות ללשונית "עוד".
function More() {
  return (
    <>
      <div className="more-list">
        {NAV.filter((n) => n[3]).map(([to, label, icon]) => (
          <Link key={icon} to={`/projectflow/${to}`} className="more-row">
            <NavIcon name={icon} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
      <h2 className="pf-h2">צבע האפליקציה</h2>
      <ThemePicker />
      <h2 className="pf-h2">חשבון</h2>
      <SyncBadge />
    </>
  );
}

function NavIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default function ProjectFlow() {
  const store = useProjects();
  const { pathname } = useLocation();
  const section = pathname.replace(/^\/projectflow\/?/, '').split('/')[0];
  const heading = section === 'more' ? 'עוד' : NAV.find(([to]) => to === section)?.[1];
  return (
    <div className="pf">
      <aside className="pf-side">
        <Link to="/" className="pf-brand" aria-label="ביתנא, דף הבית">
          <img src="/favicon.svg" alt="" width="36" height="36" />
          <span>
            <strong>מגדל בקרה</strong>
            <small>ממכרז ועד אספקה</small>
          </span>
        </Link>
        <nav className="pf-nav" aria-label="ניווט מגדל בקרה">
          {NAV.map(([to, label, icon, secondary]) => (
            <NavLink
              key={icon}
              to={to ? `/projectflow/${to}` : '/projectflow'}
              end={!to}
              className={secondary ? 'desk-only' : undefined}
            >
              <NavIcon name={icon} />
              <span>{label}</span>
            </NavLink>
          ))}
          <NavLink to="/projectflow/more" className="mobile-only">
            <NavIcon name="more" />
            <span>עוד</span>
          </NavLink>
        </nav>
        <div className="side-account">
          <ThemePicker />
          <SyncBadge />
        </div>
      </aside>
      <main className="pf-main">
        {heading && <h1 className="pf-page">{heading}</h1>}
        <Routes>
          <Route index element={<ProjectList store={store} />} />
          <Route path="assistant" element={<Assistant store={store} />} />
          <Route path="dashboard" element={<Dashboard store={store} />} />
          <Route path="risks" element={<Risks store={store} />} />
          <Route path="decisions" element={<Decisions store={store} />} />
          <Route path="changes" element={<ChangeRequests store={store} />} />
          <Route path="payments" element={<Payments store={store} />} />
          <Route path="backup" element={<Backup store={store} />} />
          <Route path="more" element={<More />} />
          <Route path=":id" element={<ProjectDetail store={store} />} />
        </Routes>
      </main>
    </div>
  );
}
