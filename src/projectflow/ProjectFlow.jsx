import { useState } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import Dashboard from './Dashboard.jsx';
import Decisions from './Decisions.jsx';
import Risks from './Risks.jsx';
import { STAGES } from './stages.js';
import {
  currentStage,
  makeProject,
  overallProgress,
  stageStatus,
  uid,
  useProjects,
} from './storage.js';

const TYPES = { it: 'פרויקט IT', procurement: 'רכש' };

function formatBudget(b) {
  const n = Number(b);
  return b !== '' && b != null && !Number.isNaN(n) ? `₪${n.toLocaleString('he-IL')}` : null;
}

function ProjectList({ store }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', type: 'it', owner: '', budget: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const p = makeProject({ ...form, name: form.name.trim(), owner: form.owner.trim() });
    store.add(p);
    setForm({ name: '', type: 'it', owner: '', budget: '' });
    navigate(`/projectflow/${p.id}`);
  };

  return (
    <>
      <form className="card pf-form" onSubmit={submit}>
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
        <button type="submit">פרויקט חדש</button>
      </form>

      {store.projects.length === 0 ? (
        <p className="muted">אין פרויקטים עדיין. הוסיפו את הראשון למעלה.</p>
      ) : (
        <div className="cards">
          {store.projects.map((p) => {
            const stage = currentStage(p);
            const pct = overallProgress(p);
            const budget = formatBudget(p.budget);
            return (
              <Link key={p.id} to={`/projectflow/${p.id}`} className="card pf-project-card">
                <h3>{p.name}</h3>
                <div className="pf-meta">
                  <span>{TYPES[p.type] || p.type}</span>
                  {p.owner && <span>אחראי: {p.owner}</span>}
                  {budget && <span>{budget}</span>}
                </div>
                <div className="progress" aria-label={`התקדמות ${pct}%`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="pf-meta">
                  <span>{pct}%</span>
                  <span>{stage ? `שלב נוכחי: ${stage.title}` : 'הושלם'}</span>
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

  const activeId = sel ?? currentStage(project)?.id;
  const active = STAGES.find((s) => s.id === activeId) ?? STAGES[STAGES.length - 1];
  const meta = project.stageMeta[active.id] || {};
  const tasks = project.tasks.filter((t) => t.stage === active.id);
  const pct = overallProgress(project);
  const budget = formatBudget(project.budget);

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
  const deleteProject = () => {
    if (window.confirm(`למחוק את "${project.name}"?`)) {
      store.remove(project.id);
      navigate('/projectflow');
    }
  };

  return (
    <>
      <p>
        <Link to="/projectflow">→ כל הפרויקטים</Link>
      </p>
      <h2 style={{ margin: '0 0 4px' }}>{project.name}</h2>
      <div className="pf-meta">
        <span>{TYPES[project.type] || project.type}</span>
        {project.owner && <span>אחראי: {project.owner}</span>}
        {budget && <span>{budget}</span>}
        <span>התקדמות כוללת: {pct}%</span>
      </div>
      <div className="progress">
        <span style={{ width: `${pct}%` }} />
      </div>

      <div className="pf-detail">
        <ol className="stage-list">
          {STAGES.map((s, i) => {
            const st = stageStatus(project, s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={`stage-btn${s.id === active.id ? ' active' : ''}${st.complete ? ' done' : ''}`}
                  onClick={() => setSel(s.id)}
                >
                  <span>
                    {i + 1}. {s.title}
                  </span>
                  <span className="stage-count">
                    {st.complete ? '✓' : `${st.done}/${st.total}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <section className="card">
          <h3 style={{ marginTop: 0 }}>{active.title}</h3>

          <ul className="task-list">
            {tasks.map((t) => (
              <li key={t.id} className={`task${t.done ? ' done' : ''}`}>
                <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />
                <span>{t.title}</span>
                <button
                  type="button"
                  className="ghost"
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

      <p style={{ marginTop: 24 }}>
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
      <p>
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
      <header className="pf-header">
        <Link to="/">→ בית</Link>
        <h1>ProjectFlow</h1>
        <p>ניהול מחזור חיים של פרויקט – ממכרז ועד אספקה</p>
        <nav className="pf-tabs" aria-label="ניווט ProjectFlow">
          <NavLink to="/projectflow" end>
            פרויקטים
          </NavLink>
          <NavLink to="/projectflow/dashboard">לוח בקרה</NavLink>
          <NavLink to="/projectflow/risks">סיכונים</NavLink>
          <NavLink to="/projectflow/decisions">החלטות</NavLink>
        </nav>
      </header>
      <Routes>
        <Route index element={<ProjectList store={store} />} />
        <Route path="dashboard" element={<Dashboard store={store} />} />
        <Route path="risks" element={<Risks store={store} />} />
        <Route path="decisions" element={<Decisions store={store} />} />
        <Route path=":id" element={<ProjectDetail store={store} />} />
      </Routes>
    </div>
  );
}
