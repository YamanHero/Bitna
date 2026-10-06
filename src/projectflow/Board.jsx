import { useState } from 'react';
import { Link } from 'react-router-dom';
import { currentStage, overallProgress, overdueStages, daysLeft, stagesOf } from './storage.js';

// חמישה שלבי-על במקום שלושה-עשר שלבים: הלוח נכנס במסך ונוח לתפעול.
export const PHASES = [
  { id: 'prep', label: 'הכנה', stages: ['needs', 'budget', 'tender_docs'], color: 'var(--ph-prep)' },
  { id: 'tender', label: 'מכרז', stages: ['publication', 'clarifications', 'bids'], color: 'var(--ph-tender)' },
  { id: 'select', label: 'בחירה וחוזה', stages: ['evaluation', 'approval', 'contract'], color: 'var(--ph-select)' },
  { id: 'deliver', label: 'ביצוע וקבלה', stages: ['delivery', 'acceptance'], color: 'var(--ph-deliver)' },
  { id: 'close', label: 'סגירה', stages: ['closure', '_done'], color: 'var(--ph-close)' },
];

// שלב מותאם אישית משויך לשלב-העל של השלב הסטנדרטי שלפניו.
const phaseOf = (p) => {
  const cur = currentStage(p);
  if (!cur) return PHASES[PHASES.length - 1];
  const list = stagesOf(p);
  for (let i = list.findIndex((s) => s.id === cur.id); i >= 0; i -= 1) {
    const ph = PHASES.find((x) => x.stages.includes(list[i].id));
    if (ph) return ph;
  }
  return PHASES[0];
};

export default function Board({ projects, store }) {
  const [phase, setPhase] = useState(() => PHASES.find((ph) => projects.some((p) => phaseOf(p).id === ph.id))?.id || 'prep');
  const [undo, setUndo] = useState(null);

  const complete = (p, task) => {
    store.update(p.id, (x) => ({ ...x, tasks: x.tasks.map((t) => (t.id === task.id ? { ...t, done: true } : t)) }));
    clearTimeout(complete.t);
    setUndo({ projectId: p.id, taskId: task.id, title: task.title });
    complete.t = setTimeout(() => setUndo(null), 7000);
  };
  const revert = () => {
    store.update(undo.projectId, (x) => ({ ...x, tasks: x.tasks.map((t) => (t.id === undo.taskId ? { ...t, done: false } : t)) }));
    setUndo(null);
  };

  return (
    <>
      <div className="phase-tabs" role="tablist" aria-label="שלבי-על">
        {PHASES.map((ph) => {
          const n = projects.filter((p) => phaseOf(p).id === ph.id).length;
          return (
            <button
              key={ph.id}
              type="button"
              role="tab"
              aria-selected={phase === ph.id}
              className={`phase-tab${phase === ph.id ? ' on' : ''}`}
              style={{ '--ph': ph.color }}
              onClick={() => setPhase(ph.id)}
            >
              {ph.label} <b>{n}</b>
            </button>
          );
        })}
      </div>

      <div className="board" data-phase={phase}>
        {PHASES.map((ph) => {
          const items = projects.filter((p) => phaseOf(p).id === ph.id);
          return (
            <section
              key={ph.id}
              className={`board-col${phase === ph.id ? ' show' : ''}`}
              style={{ '--ph': ph.color }}
              aria-label={ph.label}
            >
              <h3>
                {ph.label} <span>{items.length}</span>
              </h3>
              {items.length === 0 && <p className="board-empty">אין פרויקטים בשלב זה</p>}
              {items.map((p) => {
                const stage = currentStage(p);
                const task = stage ? p.tasks.find((t) => t.stage === stage.id && !t.done) : null;
                const late = overdueStages(p).length;
                const d = daysLeft(p);
                return (
                  <article key={p.id} className="board-card">
                    <Link to={`/projectflow/${p.id}`} className="board-main">
                      <strong>{p.name}</strong>
                      <span className="muted">{p.owner || '—'}</span>
                    </Link>
                    <span className="board-stage">{stage ? stage.title : 'הושלם'}</span>
                    <span className="bar">
                      <i style={{ width: `${overallProgress(p)}%` }} />
                    </span>
                    <span className="board-foot">
                      <span>{overallProgress(p)}%</span>
                      {late > 0 && <span className="badge high">{late} באיחור</span>}
                      {late === 0 && d !== null && d <= 30 && d >= 0 && overallProgress(p) < 100 && (
                        <span className="badge mid">{d} ימים ליעד</span>
                      )}
                    </span>
                    {task && (
                      <button type="button" className="board-next" onClick={() => complete(p, task)} title="סימון כבוצע">
                        <span className="tick" aria-hidden="true" />
                        <span className="board-next-text">
                          <small>הצעד הבא, לחיצה לסימון כבוצע</small>
                          {task.title}
                        </span>
                      </button>
                    )}
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>

      {undo && (
        <div className="toast" role="status">
          <span>סומן כבוצע: {undo.title}</span>
          <button type="button" className="ghost sm" onClick={revert}>
            ביטול
          </button>
        </div>
      )}
    </>
  );
}
