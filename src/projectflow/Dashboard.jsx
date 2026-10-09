import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RISKS_KEY, exposure, useList } from './registers.js';
import { LEVELS, LEVEL_LABEL, dayDiff, forecast, health, milestones, nextMilestone, rel } from './health.js';
import Icon from './Icon.jsx';
import { StatusChip, StatusRail } from './StatusCard.jsx';
import { STATUSES, baseStatus, changeStatus, statusOf } from './status.js';
import { daysLeft } from './storage.js';

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });

function Card({ p, h, onAdvance }) {
  const idx = STATUSES.findIndex((x) => x.id === baseStatus(p));
  const next = statusOf(p) !== 'hold' ? STATUSES[idx + 1] : null;
  const nm = nextMilestone(p);
  const left = daysLeft(p);
  const f = forecast(p);
  return (
    <article className={`ov-card lv-${h.level}`}>
      <Link to={`/projectflow/${p.id}`} className="ov-main">
        <div className="ov-head">
          <h3>{p.name}</h3>
          <span className={`lv lv-${h.level}`}>{LEVEL_LABEL[h.level]}</span>
        </div>
        <StatusChip project={p} />
        <StatusRail project={p} />
        <dl className="ov-facts">
          <div>
            <dt>אבן דרך הבאה</dt>
            <dd>
              {nm ? (
                <>
                  {nm.title}
                  <small className={nm.date < todayStr() ? 'bad' : ''}> · {fmt(nm.date)} ({rel(dayDiff(nm.date))})</small>
                </>
              ) : (
                <small>לא הוגדרה</small>
              )}
            </dd>
          </div>
          <div>
            <dt>יעד הפעלה</dt>
            <dd>
              {p.targetDate ? (
                <>
                  {fmt(p.targetDate)}
                  <small> · {left < 0 ? `עבר לפני ${-left} ימים` : `${left} ימים`}</small>
                  {f && f.slip > 0 && left >= 0 && <small className="bad"> · צפי: +{f.slip} ימים</small>}
                </>
              ) : (
                <small>לא הוגדר</small>
              )}
            </dd>
          </div>
        </dl>
        {h.reasons.length > 0 && (
          <ul className="ov-reasons">
            {h.reasons.slice(0, 2).map((r) => (
              <li key={r.text} className={`r-${r.level}`}>{r.text}</li>
            ))}
          </ul>
        )}
      </Link>
      {next && next.id !== 'closed' && (
        <button type="button" className="ghost ov-adv" onClick={() => onAdvance(p, next)}>
          <Icon name="forward-step" /> קידום ל"{next.label}"
        </button>
      )}
    </article>
  );
}

export default function Dashboard({ store }) {
  const risks = useList(RISKS_KEY).items;
  const [filter, setFilter] = useState('all');
  const [undo, setUndo] = useState(null);
  const [more, setMore] = useState(false);
  const today = todayStr();

  const open = risks.filter((r) => r.status === 'open');
  const blockersOf = (id) => open.filter((r) => r.kind === 'blocker' && r.projectId === id).length;
  const rows = store.projects
    .map((p) => ({ p, h: health(p, blockersOf(p.id)) }))
    .sort((a, b) => LEVELS[b.h.level] - LEVELS[a.h.level] || (a.p.targetDate || '9').localeCompare(b.p.targetDate || '9'));
  const live = rows.filter((r) => r.h.level !== 'done');
  const count = (lv) => live.filter((r) => r.h.level === lv).length;
  const shown = live.filter((r) => filter === 'all' || r.h.level === filter);
  const attention = live.filter((r) => r.h.level !== 'green').slice(0, 3);
  const highRisks = open.filter((r) => exposure(r) >= 6).length;

  const ms = store.projects
    .filter((p) => statusOf(p) !== 'closed')
    .flatMap((p) => milestones(p).filter((m) => !m.done && dayDiff(m.date, today) <= 60).map((m) => ({ ...m, p })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const msShown = more ? ms : ms.slice(0, 6);

  const advance = (p, next) => {
    const before = p;
    store.update(p.id, (x) => changeStatus(x, next.id));
    setUndo({ before, label: `${p.name}: ${next.label}` });
    clearTimeout(advance.t);
    advance.t = setTimeout(() => setUndo(null), 7000);
  };
  const revert = () => {
    store.update(undo.before.id, () => undo.before);
    setUndo(null);
  };

  if (store.projects.length === 0) {
    return (
      <div className="pf-empty empty-rich">
        <span className="empty-ic"><Icon name="tower-observation" /></span>
        <h3>ברוכים הבאים למגדל הבקרה</h3>
        <p>אין פרויקטים עדיין. פתחו פרויקט ראשון והסקירה תתמלא מעצמה.</p>
        <Link to="/projectflow/projects" className="qk pri">פרויקט חדש</Link>
      </div>
    );
  }

  const hr = new Date().getHours();
  const greet = hr < 5 ? 'לילה טוב' : hr < 12 ? 'בוקר טוב' : hr < 18 ? 'צהריים טובים' : 'ערב טוב';
  const red = count('red');
  const amber = count('amber');
  const sub = live.length === 0 ? 'אין פרויקטים פעילים' : red + amber === 0 ? `${live.length} פרויקטים פעילים, הכול תקין` : `${live.length} פרויקטים פעילים · ${red ? `${red} חריגים` : ''}${red && amber ? ' · ' : ''}${amber ? `${amber} למעקב` : ''}`;

  return (
    <>
      <div className="ov-hello">
        <div>
          <h2>{greet} 👋</h2>
          <p>{sub}</p>
        </div>
        <div className="ov-quick">
          <Link to="/projectflow/meetings" className="qk"><Icon name="microphone" /> פגישה</Link>
          <Link to="/projectflow/projects" className="qk pri"><Icon name="plus" /> פרויקט</Link>
        </div>
      </div>
      <div className="ov-health" role="group" aria-label="סינון לפי מצב">
        {[['all', 'כל הפעילים', live.length, 'layer-group'], ['green', 'תקין', count('green'), 'circle-check'], ['amber', 'דורש מעקב', count('amber'), 'eye'], ['red', 'חריג', count('red'), 'fire']].map(([id, label, n, ic]) => (
          <button key={id} type="button" className={`ov-pill lv-${id}${filter === id ? ' on' : ''}`} onClick={() => setFilter(id)}>
            <Icon name={ic} className="pill-ic" />
            <b>{n}</b>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {attention.length > 0 && filter === 'all' && (
        <section className="ov-attn" aria-label="דורש תשומת לב">
          <h2 className="pf-h2"><Icon name="bell" /> דורש תשומת לב עכשיו</h2>
          {attention.map(({ p, h }) => (
            <Link key={p.id} to={`/projectflow/${p.id}`} className={`ov-attn-row lv-${h.level}`}>
              <strong><Icon name={h.level === 'red' ? 'fire' : 'eye'} /> {p.name}</strong>
              <span>{h.reasons[0]?.text}</span>
            </Link>
          ))}
        </section>
      )}

      <h2 className="pf-h2"><Icon name="rocket" /> הפרויקטים שלי</h2>
      <div className="ov-grid">
        {shown.map(({ p, h }) => (
          <Card key={p.id} p={p} h={h} onAdvance={advance} />
        ))}
        {shown.length === 0 && <p className="muted">אין פרויקטים במצב הזה.</p>}
      </div>

      <h2 className="pf-h2"><Icon name="flag-checkered" /> אבני דרך קרובות</h2>
      {ms.length === 0 ? (
        <p className="muted">אין אבני דרך ב-60 הימים הקרובים. הוסיפו מועדי שלבים או אבני דרך במסך הפרויקט.</p>
      ) : (
        <ol className="ov-timeline">
          {msShown.map((m) => {
            const d = dayDiff(m.date, today);
            return (
              <li key={`${m.p.id}-${m.id}`} className={d < 0 ? 'late' : d <= 7 ? 'soon' : ''}>
                <time>{fmt(m.date)}</time>
                <Link to={`/projectflow/${m.p.id}`}>
                  <strong>{m.title}</strong>
                  <small>{m.p.name}</small>
                </Link>
                <span className="rel">{rel(d)}</span>
              </li>
            );
          })}
        </ol>
      )}
      {ms.length > 6 && (
        <button type="button" className="link" onClick={() => setMore((v) => !v)}>
          {more ? 'הצגת פחות' : `הצגת כל ${ms.length} אבני הדרך`}
        </button>
      )}

      {highRisks > 0 && (
        <Link to="/projectflow/risks" className="ov-risk">
          <Icon name="triangle-exclamation" /> {highRisks} סיכונים בחשיפה גבוהה פתוחים · לצפייה במרשם הסיכונים
        </Link>
      )}

      {undo && (
        <div className="toast" role="status">
          <span>עודכן: {undo.label}</span>
          <button type="button" className="ghost sm" onClick={revert}>ביטול</button>
        </div>
      )}
    </>
  );
}
