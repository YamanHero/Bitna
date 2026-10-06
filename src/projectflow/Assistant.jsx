import { useState } from 'react';
import { Link } from 'react-router-dom';
import { analyze, summaryText } from './assistant.js';
import { CHANGES_KEY, RISKS_KEY, useList } from './registers.js';
import { overallProgress } from './storage.js';

export default function Assistant({ store }) {
  const risks = useList(RISKS_KEY).items;
  const changes = useList(CHANGES_KEY).items;
  const active = store.projects.filter((p) => overallProgress(p) < 100);
  const [sel, setSel] = useState('');
  const [copied, setCopied] = useState(false);

  const project = active.find((p) => p.id === sel) || active[0];

  if (!project) {
    return <p className="pf-empty">אין פרויקטים פעילים. פתחו פרויקט, והעוזר יסביר מה מתעכב ומה הצעד הבא.</p>;
  }

  const a = analyze(project, { risks, changes });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText(project, a));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('העתיקו את הסיכום:', summaryText(project, a));
    }
  };

  return (
    <>
      <div className="pf-toolbar">
        <select value={project.id} onChange={(e) => setSel(e.target.value)} aria-label="בחירת פרויקט">
          {active.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" className="ghost" onClick={copy}>
          {copied ? 'הועתק' : 'העתקת סיכום'}
        </button>
      </div>

      <section className="ai-card">
        <h2>מה מתעכב</h2>
        {a.delays.length === 0 ? (
          <p className="ai-ok">אין כרגע עיכובים בולטים. המשיכו לפי הצעד הבא.</p>
        ) : (
          <ul className="ai-list">
            {a.delays.map((d) => (
              <li key={d.text} className={`lvl-${d.level}`}>
                {d.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ai-card ai-next">
        <h2>הצעד הבא</h2>
        {a.task ? (
          <>
            <p className="ai-task">{a.task.title}</p>
            <p className="muted">בשלב: {a.stage.title}</p>
            {a.upcoming.length > 0 && (
              <p className="muted">אחריו: {a.upcoming.map((t) => t.title).join(' · ')}</p>
            )}
            <Link to={`/projectflow/${project.id}`} className="ai-link">
              לפתיחת הפרויקט
            </Link>
          </>
        ) : (
          <p className="muted">כל המשימות בשלב הושלמו. עברו לשלב הבא.</p>
        )}
      </section>

      {a.how.length > 0 && (
        <section className="ai-card">
          <h2>איך עושים</h2>
          <ol className="ai-steps">
            {a.how.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
        </section>
      )}

      {a.ideas.length > 0 && (
        <section className="ai-card">
          <h2>רעיונות לביצוע</h2>
          <ul className="ai-list">
            {a.ideas.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="muted ai-note">
        העוזר פועל לפי הנתונים שבאפליקציה וכללי עבודה קבועים. שום מידע לא נשלח החוצה.
      </p>
    </>
  );
}
