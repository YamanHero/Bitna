import { Link } from 'react-router-dom';
import { STAGES } from './stages.js';
import { currentStage, overallProgress, overdueStages, stageStatus } from './storage.js';
import { RISKS_KEY, exposure, kindLabel, useList } from './registers.js';

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// שלבי המכרז: מהכנת מסמכים ועד החלטה ואישור.
const TENDER_IDS = ['tender_docs', 'publication', 'clarifications', 'bids', 'evaluation', 'approval'];

function nextTask(project) {
  const stage = currentStage(project);
  if (!stage) return null;
  const task = project.tasks.find((t) => t.stage === stage.id && !t.done);
  return { stage, task };
}

function Stat({ n, label, tone }) {
  return (
    <div className={`stat${tone ? ` stat-${tone}` : ''}`}>
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}

export default function Dashboard({ store }) {
  const risks = useList(RISKS_KEY).items;
  const today = todayStr();

  const active = store.projects.filter((p) => overallProgress(p) < 100);
  const inTender = active.filter((p) => TENDER_IDS.includes(currentStage(p)?.id));
  const notStarted = active.filter((p) => overallProgress(p) === 0);
  const openRisks = risks.filter((r) => r.status === 'open');
  const highRisks = openRisks.filter((r) => exposure(r) >= 6);
  const blockers = openRisks.filter((r) => r.kind === 'blocker');
  const late = active.flatMap((p) => overdueStages(p, today).map((s) => ({ p, s })));
  const weekEnd = addDays(7);
  const soon = active
    .flatMap((p) =>
      STAGES.filter((s) => {
        const due = p.stageMeta?.[s.id]?.due;
        return due && due >= today && due <= weekEnd && !stageStatus(p, s.id).complete;
      }).map((s) => ({ p, s, due: p.stageMeta[s.id].due }))
    )
    .sort((a, b) => a.due.localeCompare(b.due));
  const projectName = (id) => store.projects.find((p) => p.id === id)?.name;

  return (
    <>
      <div className="stats">
        <Stat n={active.length} label="פרויקטים פעילים" />
        <Stat n={notStarted.length} label="עוד לא התחילו" />
        <Stat n={inTender.length} label="בשלבי מכרז" />
        <Stat n={late.length} label="שלבים באיחור" tone={late.length ? 'bad' : ''} />
        <Stat n={highRisks.length} label="סיכונים בחשיפה גבוהה" tone={highRisks.length ? 'bad' : ''} />
        <Stat n={blockers.length} label="חסמים פתוחים" tone={blockers.length ? 'bad' : ''} />
      </div>

      {(late.length > 0 || soon.length > 0) && (
        <>
          <h2 className="pf-h2">מועדים</h2>
          <div className="pf-list">
            {late.map(({ p, s }) => (
              <Link key={`${p.id}-${s.id}`} to={`/projectflow/${p.id}`} className="pf-line late">
                <strong>{p.name}</strong>
                <span>{s.title}</span>
                <span className="badge high">באיחור, יעד {p.stageMeta[s.id].due}</span>
              </Link>
            ))}
            {soon.map(({ p, s, due }) => (
              <Link key={`${p.id}-${s.id}-soon`} to={`/projectflow/${p.id}`} className="pf-line">
                <strong>{p.name}</strong>
                <span>{s.title}</span>
                <span className="badge mid">השבוע, יעד {due}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="pf-h2">הפעולה הבאה בכל פרויקט</h2>
      {active.length === 0 ? (
        <p className="pf-empty">אין פרויקטים פעילים. פתחו פרויקט בלשונית פרויקטים.</p>
      ) : (
        <div className="pf-list">
          {active.map((p) => {
            const next = nextTask(p);
            const lateCount = overdueStages(p, today).length;
            const projectBlockers = blockers.filter((r) => r.projectId === p.id);
            return (
              <Link key={p.id} to={`/projectflow/${p.id}`} className="card pf-item pf-link">
                <div className="pf-item-head">
                  <strong>{p.name}</strong>
                  <span className="muted">{overallProgress(p)}%</span>
                </div>
                {next && (
                  <div>
                    <span className="muted">שלב: {next.stage.title}</span>
                    {next.task && (
                      <div>
                        <span className="muted">הבא: </span>
                        {next.task.title}
                      </div>
                    )}
                  </div>
                )}
                {(lateCount > 0 || projectBlockers.length > 0) && (
                  <div className="pf-meta">
                    {lateCount > 0 && <span className="warn">{lateCount} שלבים באיחור</span>}
                    {projectBlockers.length > 0 && (
                      <span className="warn">{projectBlockers.length} חסמים פתוחים</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <h2 className="pf-h2">חסמים וסיכונים בחשיפה גבוהה</h2>
      {[...blockers, ...highRisks.filter((r) => r.kind !== 'blocker')].length === 0 ? (
        <p className="muted">אין כרגע חסמים או סיכונים גבוהים פתוחים.</p>
      ) : (
        <div className="pf-list">
          {[...blockers, ...highRisks.filter((r) => r.kind !== 'blocker')].map((r) => (
            <div key={r.id} className="card pf-item">
              <div className="pf-item-head">
                <strong>{r.title}</strong>
                <span className="kind">{kindLabel(r.kind)}</span>
              </div>
              <div className="pf-meta">
                {projectName(r.projectId) && <span>{projectName(r.projectId)}</span>}
                {r.owner && <span>אחראי: {r.owner}</span>}
                {r.due && <span>יעד: {r.due}</span>}
              </div>
              {r.mitigation && <p className="pf-note">טיפול: {r.mitigation}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
