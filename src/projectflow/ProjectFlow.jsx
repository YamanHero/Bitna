import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SyncBadge } from '../lib/AuthGate.jsx';
import { ThemePicker } from '../lib/theme.jsx';
import Assistant from './Assistant.jsx';
import Backup from './Backup.jsx';
import Board from './Board.jsx';
import ChangeRequests from './ChangeRequests.jsx';
import Dashboard from './Dashboard.jsx';
import Decisions from './Decisions.jsx';
import Meetings, { ProjectMeetings } from './Meetings.jsx';
import { seedContacts } from './meetings.js';
import Payments from './Payments.jsx';
import { TEAM_KEY, useList } from './registers.js';
import Tasks from './Tasks.jsx';
import { baseStatus, relevantStageIds, statusInfo } from './status.js';
import StatusCard, { MilestonesCard, StatusChip, StatusRail } from './StatusCard.jsx';
import Risks from './Risks.jsx';
import { STAGES } from './stages.js';
import {
  catalogStage,
  currentStage,
  daysLeft,
  makeProject,
  openBefore,
  overallProgress,
  overdueStages,
  stageStatus,
  stagesOf,
  TEMPLATES,
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
      {stagesOf(project).map((s) => {
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
      {'template' in form && (
        <label className="wide">
          סוג ההליך (קובע אילו שלבים ייכללו, ואפשר לשנות אחר כך)
          <select value={form.template} onChange={set('template')}>
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}
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

const BLANK = { name: '', type: 'it', owner: '', budget: '', targetDate: '', template: 'full' };

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
                <StatusRail project={p} />
                <div className="pf-row-status">
                  <StatusChip project={p} />
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

function TaskRow({ t, team, today, onToggle, onPatch, onRemove }) {
  const late = t.due && t.due < today && !t.done;
  return (
    <li className={`task${t.done ? ' done' : ''}`}>
      <div className="task-top">
        <input type="checkbox" id={`task-${t.id}`} checked={t.done} onChange={() => onToggle(t.id)} />
        <label htmlFor={`task-${t.id}`}>{t.title}</label>
        {late && <span className="badge high">באיחור</span>}
        <button
          type="button"
          className="ghost icon-btn"
          onClick={() => onRemove(t.id)}
          aria-label={`מחיקת משימה ${t.title}`}
        >
          ✕
        </button>
      </div>
      <div className="task-meta">
        <select
          value={t.assignee || ''}
          onChange={(e) => onPatch(t.id, { assignee: e.target.value })}
          aria-label={`אחראי למשימה ${t.title}`}
        >
          <option value="">ללא אחראי</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={t.due || ''}
          onChange={(e) => onPatch(t.id, { due: e.target.value })}
          aria-label={`יעד למשימה ${t.title}`}
        />
      </div>
    </li>
  );
}

function Detail({ project, store }) {
  const navigate = useNavigate();
  const team = useList(TEAM_KEY).items;
  const [sel, setSel] = useState(null);
  const [newTask, setNewTask] = useState('');
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [editing, setEditing] = useState(false);
  const [manage, setManage] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [customStage, setCustomStage] = useState('');

  const today = new Date().toISOString().slice(0, 10);
  const stages = stagesOf(project);
  const relIds = relevantStageIds(project);
  const relStages = stages.filter((s) => relIds.includes(s.id) || !catalogStage(s.id));
  const hasRel = relStages.length > 0 && relStages.length < stages.length;
  const visible = showAll || !hasRel ? stages : relStages;
  const relCurrent = relStages.find((s) => {
    const st = stageStatus(project, s.id);
    return !st.empty && !st.complete;
  }) || relStages[0];
  const activeId = sel ?? (hasRel ? relCurrent?.id : currentStage(project)?.id);
  const active = stages.find((s) => s.id === activeId) ?? stages[stages.length - 1] ?? null;
  const meta = (active && project.stageMeta[active.id]) || {};
  const tasks = active ? project.tasks.filter((t) => t.stage === active.id) : [];
  const pct = overallProgress(project);
  const budget = formatBudget(project.budget);
  const gate = active ? openBefore(project, active.id) : { open: 0 };
  const activeDone = active ? stageStatus(project, active.id).complete : false;

  const patch = (fn) => store.update(project.id, fn);
  // שינוי סטטוס: חוזרים לתצוגת השלבים של הסטטוס החדש.
  const stKey = baseStatus(project);
  useEffect(() => { setSel(null); setShowAll(false); }, [stKey]);

  // ---- משימות ----
  const toggle = (id) =>
    patch((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
  const patchTask = (id, change) =>
    patch((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, ...change } : t)) }));
  const removeTask = (id) => patch((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== id) }));
  const addTasks = (titles) => {
    const clean = titles.map((x) => x.trim()).filter(Boolean);
    if (!clean.length || !active) return;
    patch((p) => ({
      ...p,
      tasks: [...p.tasks, ...clean.map((title) => ({ id: uid(), stage: active.id, title, done: false }))],
    }));
  };
  const addTask = (e) => {
    e.preventDefault();
    addTasks([newTask]);
    setNewTask('');
  };
  const addBulk = () => {
    addTasks(bulkText.split('\n'));
    setBulkText('');
    setBulk(false);
  };
  const setMeta = (key) => (e) => {
    const value = e.target.value;
    patch((p) => ({
      ...p,
      stageMeta: { ...p.stageMeta, [active.id]: { ...p.stageMeta[active.id], [key]: value } },
    }));
  };

  // ---- שלבים ----
  const setStages = (fn) => patch((p) => ({ ...p, stages: fn(stagesOf(p)) }));
  const renameStage = (id, title) =>
    setStages((list) => list.map((s) => (s.id === id ? { ...s, title } : s)));
  const removeStage = (s) => {
    const n = project.tasks.filter((t) => t.stage === s.id).length;
    if (!window.confirm(`להסיר את השלב "${s.title}"${n ? ` ואת ${n} המשימות שבו` : ''}?`)) return;
    patch((p) => {
      const { [s.id]: _gone, ...rest } = p.stageMeta || {};
      return {
        ...p,
        stages: stagesOf(p).filter((x) => x.id !== s.id),
        tasks: p.tasks.filter((t) => t.stage !== s.id),
        stageMeta: rest,
      };
    });
    if (sel === s.id) setSel(null);
  };

  // החלפת תבנית: מוסיפים שלבים חסרים ומסירים שלבים סטנדרטיים שאינם בתבנית (שלבים אישיים נשארים).
  const applyTemplate = (tpl) => {
    const have = stages.map((x) => x.id);
    const drop = stages.filter((x) => catalogStage(x.id) && !tpl.ids.includes(x.id));
    const lost = project.tasks.filter((t) => drop.some((x) => x.id === t.stage));
    const doneLost = lost.filter((t) => t.done).length;
    if (
      (drop.length || doneLost) &&
      !window.confirm(
        `מעבר לתבנית "${tpl.label}": יוסרו ${drop.length} שלבים${lost.length ? ` ו-${lost.length} משימות` : ''}${doneLost ? ` (מהן ${doneLost} שסומנו כבוצעו)` : ''}. להמשיך?`
      )
    ) return;
    patch((p) => {
      const custom = stagesOf(p).filter((x) => !catalogStage(x.id));
      const kept = stagesOf(p).filter((x) => tpl.ids.includes(x.id));
      const added = tpl.ids.filter((id) => !have.includes(id)).map((id) => catalogStage(id));
      const std = tpl.ids
        .map((id) => kept.find((x) => x.id === id) || added.find((x) => x?.id === id))
        .filter(Boolean)
        .map(({ id, title }) => ({ id, title }));
      const ci = std.findIndex((x) => x.id === 'closure');
      const merged = ci === -1 ? [...std, ...custom] : [...std.slice(0, ci), ...custom, ...std.slice(ci)];
      const gone = drop.map((x) => x.id);
      return {
        ...p,
        stages: merged,
        tasks: [
          ...p.tasks.filter((t) => !gone.includes(t.stage)),
          ...added.flatMap((c) => c.tasks.map((title) => ({ id: uid(), stage: c.id, title, done: false }))),
        ],
      };
    });
  };
  const toggleStage = (c) => {
    const cur = stages.find((x) => x.id === c.id);
    if (cur) removeStage(cur);
    else addCatalogStage(c.id);
  };
  // שלב חדש נכנס לפני "סיכום וסגירה" אם הוא קיים, אחרת בסוף.
  const insertIndex = (list) => {
    const i = list.findIndex((s) => s.id === 'closure');
    return i === -1 ? list.length : i;
  };
  const addCatalogStage = (id) => {
    const cat = catalogStage(id);
    if (!cat) return;
    patch((p) => {
      const list = stagesOf(p);
      const canon = STAGES.findIndex((s) => s.id === id);
      // אחרי השלב הסטנדרטי הקרוב ביותר שקדם לו בקטלוג ונמצא כבר בפרויקט.
      let at = 0;
      list.forEach((s, i) => {
        const c = STAGES.findIndex((x) => x.id === s.id);
        if (c !== -1 && c < canon) at = i + 1;
      });
      const next = [...list];
      next.splice(at, 0, { id: cat.id, title: cat.title });
      return {
        ...p,
        stages: next,
        tasks: [...p.tasks, ...cat.tasks.map((title) => ({ id: uid(), stage: cat.id, title, done: false }))],
      };
    });
    setSel(id);
  };
  const addCustomStage = (e) => {
    e.preventDefault();
    const title = customStage.trim();
    if (!title) return;
    const id = `c_${uid()}`;
    patch((p) => {
      const list = stagesOf(p);
      const next = [...list];
      next.splice(insertIndex(list), 0, { id, title });
      return { ...p, stages: next };
    });
    setCustomStage('');
    setSel(id);
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
      navigate('/projectflow/projects');
    }
  };

  return (
    <>
      <p>
        <Link to="/projectflow/projects">חזרה לכל הפרויקטים</Link>
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

      <StatusCard project={project} patch={patch} />
      <MilestonesCard project={project} patch={patch} />
      <ProjectMeetings project={project} />

      <div className="pf-detail">
        <div className="stage-col">
          <div className="stage-head">
            <h3>{hasRel && !showAll ? `שלבי "${statusInfo(stKey).label}"` : 'כל השלבים'} ({visible.length})</h3>
            <button type="button" className="ghost sm" onClick={() => setManage((v) => !v)}>
              {manage ? 'סיום' : 'התאמת שלבים'}
            </button>
          </div>

          {!manage && (
          <ol className="stage-list">
            {stages.map((s, i) => {
              if (!visible.includes(s)) return null;
              const st = stageStatus(project, s.id);
              const due = project.stageMeta[s.id]?.due;
              const late = due && due < today && !st.complete;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`stage-btn${active && s.id === active.id ? ' active' : ''}${st.complete ? ' done' : ''}`}
                    onClick={() => setSel(s.id)}
                    aria-current={active && s.id === active.id ? 'step' : undefined}
                  >
                    <span>
                      {i + 1}. {s.title}
                    </span>
                    <span className={`stage-count${late ? ' late' : ''}`}>
                      {st.complete ? '✓' : late ? 'באיחור' : st.empty ? 'ריק' : `${st.done}/${st.total}`}
                    </span>
                  </button>
                </li>
              );
            })}
            {stages.length === 0 && <li className="muted">אין שלבים. הוסיפו שלב כדי להתחיל.</li>}
          </ol>
          )}
          {!manage && hasRel && (
            <button type="button" className="link" onClick={() => setShowAll((v) => !v)}>
              {showAll ? `הצגת שלבי "${statusInfo(stKey).label}" בלבד` : `הצגת כל השלבים (${stages.length})`}
            </button>
          )}

          {manage && (
            <div className="stage-picker">
              <p className="picker-lead">בחרו תבנית בסיס, ואז סמנו או בטלו שלבים לפי הצורך.</p>
              <div className="chips" role="group" aria-label="תבניות">
                {TEMPLATES.filter((t) => t.id !== 'empty').map((t) => (
                  <button key={t.id} type="button" className="chip" onClick={() => applyTemplate(t)}>
                    {t.label}
                  </button>
                ))}
              </div>
              <ul className="pick-list">
                {STAGES.map((c) => {
                  const on = stages.some((x) => x.id === c.id);
                  return (
                    <li key={c.id}>
                      <label className={`pick${on ? ' on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => toggleStage(c)} />
                        <span>{c.title}</span>
                        <small>{c.tasks.length} משימות</small>
                      </label>
                    </li>
                  );
                })}
                {stages.filter((x) => !catalogStage(x.id)).map((s) => (
                  <li key={s.id} className="pick custom">
                    <input value={s.title} onChange={(e) => renameStage(s.id, e.target.value)} aria-label="שם השלב" />
                    <button type="button" className="danger icon-btn" onClick={() => removeStage(s)} aria-label={`הסרת השלב ${s.title}`}>✕</button>
                  </li>
                ))}
              </ul>
              <form className="row" onSubmit={addCustomStage}>
                <input
                  type="text"
                  placeholder="שלב משלי, למשל: הטמעה"
                  aria-label="שם שלב חדש"
                  value={customStage}
                  onChange={(e) => setCustomStage(e.target.value)}
                />
                <button type="submit">הוספה</button>
              </form>
            </div>
          )}
        </div>

        {active ? (
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
                <TaskRow
                  key={t.id}
                  t={t}
                  team={team}
                  today={today}
                  onToggle={toggle}
                  onPatch={patchTask}
                  onRemove={removeTask}
                />
              ))}
              {tasks.length === 0 && <li className="muted">אין משימות בשלב זה.</li>}
            </ul>

            {team.length === 0 && (
              <p className="muted hint">
                כדי לשייך משימות לאנשים, הוסיפו חברי צוות בלשונית <Link to="/projectflow/tasks">משימות וצוות</Link>.
              </p>
            )}

            <form className="row" onSubmit={addTask}>
              <input
                type="text"
                placeholder="הוספת משימה"
                aria-label="משימה חדשה"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
              />
              <button type="submit">הוספה</button>
              <button type="button" className="ghost" onClick={() => setBulk((v) => !v)}>
                {bulk ? 'ביטול' : 'הדבקת רשימה'}
              </button>
            </form>
            {bulk && (
              <div className="bulk">
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={'משימה בכל שורה, למשל:\nהכנת מסמך דרישות\nפגישה עם הספק'}
                  aria-label="רשימת משימות להדבקה"
                />
                <button type="button" onClick={addBulk}>
                  הוספת כל השורות כמשימות
                </button>
              </div>
            )}

            <label className="section-label" htmlFor="due">
              תאריך יעד לשלב
            </label>
            <input id="due" type="date" value={meta.due || ''} onChange={setMeta('due')} />

            <label className="section-label" htmlFor="notes">
              הערות
            </label>
            <textarea id="notes" value={meta.notes || ''} onChange={setMeta('notes')} />
          </section>
        ) : (
          <section className="pf-panel">
            <p className="muted">אין שלבים בפרויקט. לחצו על "ניהול שלבים" והוסיפו שלב.</p>
          </section>
        )}
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
        הפרויקט לא נמצא. <Link to="/projectflow/projects">חזרה לרשימה</Link>
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
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  assistant: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z',
  meetings: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
};

const NAV = [
  ['', 'סקירה', 'dashboard'],
  ['projects', 'פרויקטים', 'projects'],
  ['tasks', 'משימות וצוות', 'tasks'],
  ['meetings', 'פגישות', 'meetings'],
  ['assistant', 'עוזר', 'assistant', true],
  ['risks', 'סיכונים', 'risks', true],
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
  useState(() => seedContacts());
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
          <Route index element={<Dashboard store={store} />} />
          <Route path="projects" element={<ProjectList store={store} />} />
          <Route path="tasks" element={<Tasks store={store} />} />
          <Route path="meetings" element={<Meetings store={store} />} />
          <Route path="meetings/:mid" element={<Meetings store={store} />} />
          <Route path="assistant" element={<Assistant store={store} />} />
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
