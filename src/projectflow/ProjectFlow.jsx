import { useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import Backup from './Backup.jsx';
import ChangeRequests from './ChangeRequests.jsx';
import Dashboard from './Dashboard.jsx';
import Decisions from './Decisions.jsx';
import Payments from './Payments.jsx';
import Risks from './Risks.jsx';
import { STAGES } from './stages.js';
import {
  currentStage,
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

const BLANK = { name: '', type: 'it', owner: '', budget: '' };

function ProjectList({ store }) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  const create = (form) => {
    const p = makeProject(form);
    store.add(p);
    setAdding(false);
    navigate(`/projectflow/${p.id}`);
  };

  const query = q.trim().toLowerCase();
  const shown = store.projects.filter((p) => {
    const done = overallProgress(p) === 100;
    if (filter === 'active' && done) return false;
    if (filter === 'done' && !done) return false;
    if (!query) return true;
    return `${p.name} ${p.owner}`.toLowerCase().includes(query);
  });

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
        {!adding && (
          <button type="button" onClick={() => setAdding(true)}>
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
                  </div>
                </div>
                <StageRail project={p} />
                <div className="pf-row-status">
                  <span className={`stamp${stage ? '' : ' finished'}`}>
                    {stage ? stage.title : 'הושלם'}
                  </span>
                  <span className="pf-pct">{pct}%</span>
                  {late > 0 && <span className="badge high">{late} באיחור</span>}
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
    patch((p) => ({ ...p, name: form.name, type: form.type, owner: form.owner, budget: form.budget }));
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
              <span>התקדמות כוללת: {pct}%</span>
            </div>
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

export default function ProjectFlow() {
  const store = useProjects();
  return (
    <div className="pf">
      <header className="pf-top">
        <Link to="/" className="pf-brand" aria-label="ביתנא, דף הבית">
          <img src="/favicon.svg" alt="" width="40" height="40" />
        </Link>
        <div>
          <h1>ProjectFlow</h1>
          <p>מעקב אחרי פרויקט רכש ו-IT, ממכרז ועד אספקה</p>
        </div>
      </header>
      <nav className="pf-tabs" aria-label="ניווט ProjectFlow">
        <NavLink to="/projectflow" end>
          פרויקטים
        </NavLink>
        <NavLink to="/projectflow/dashboard">לוח בקרה</NavLink>
        <NavLink to="/projectflow/risks">סיכונים</NavLink>
        <NavLink to="/projectflow/decisions">החלטות</NavLink>
        <NavLink to="/projectflow/changes">בקשות שינוי</NavLink>
        <NavLink to="/projectflow/payments">תשלומים</NavLink>
        <NavLink to="/projectflow/backup">גיבוי</NavLink>
      </nav>
      <Routes>
        <Route index element={<ProjectList store={store} />} />
        <Route path="dashboard" element={<Dashboard store={store} />} />
        <Route path="risks" element={<Risks store={store} />} />
        <Route path="decisions" element={<Decisions store={store} />} />
        <Route path="changes" element={<ChangeRequests store={store} />} />
        <Route path="payments" element={<Payments store={store} />} />
        <Route path="backup" element={<Backup />} />
        <Route path=":id" element={<ProjectDetail store={store} />} />
      </Routes>
    </div>
  );
}
