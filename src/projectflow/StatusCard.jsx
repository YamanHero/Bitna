import { useEffect, useState } from 'react';
import { daysLeft } from './storage.js';
import {
  baseStatus, changeStatus, history, HOLD, log, resume, setSince, since, short, statusInfo,
  statusOf, STATUSES, stopwatch,
} from './status.js';

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString('he-IL');

// פס סטטוסים: כל הסטטוסים, הנוכחי מודגש, הקודמים מסומנים כהושלמו.
export function StatusRail({ project }) {
  const base = baseStatus(project);
  const idx = STATUSES.findIndex((s) => s.id === base);
  return (
    <ol className="rail status-rail" aria-label="סטטוס הפרויקט">
      {STATUSES.map((s, i) => (
        <li key={s.id} className={`rail-step ${i < idx ? 'done' : i === idx ? 'current' : 'todo'}`} title={s.label}>
          <span className="sr">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function StatusChip({ project }) {
  const s = statusOf(project);
  const info = statusInfo(s);
  const d = Math.floor((Date.now() - since(project).getTime()) / 86400000);
  return (
    <span className={`status-chip${s === 'hold' ? ' hold' : ''}`}>
      {info.label}
      <small>{d < 1 ? 'היום' : `${d} ימים`}</small>
    </span>
  );
}

export default function StatusCard({ project, patch }) {
  const now = useNow(1000);
  const [open, setOpen] = useState(false);
  const [editDate, setEditDate] = useState(false);
  const s = statusOf(project);
  const info = statusInfo(s);
  const hold = s === 'hold';
  const base = baseStatus(project);
  const idx = STATUSES.findIndex((x) => x.id === base);
  const next = !hold && idx >= 0 ? STATUSES[idx + 1] : null;
  const st = since(project);
  const ms = now - st.getTime();
  const started = new Date(log(project)[0].at).getTime();
  const typical = STATUSES[idx]?.typical;
  const over = !hold && typical && ms / 86400000 > typical;
  const left = daysLeft(project);
  const go = (id) => patch((p) => changeStatus(p, id));

  return (
    <section className={`status-card${hold ? ' hold' : ''}`} aria-label="סטטוס הפרויקט">
      <div className="status-top">
        <div>
          <div className="status-kicker">סטטוס נוכחי</div>
          <h3 className="status-name">{info.label}</h3>
          <p className="status-hint">{hold ? `הוקפא בשלב: ${statusInfo(project.prevStatus || 'prep').label}` : info.hint}</p>
        </div>
        <div className="stopwatch" aria-live="off">
          <div className="sw-time" dir="ltr">{stopwatch(ms)}</div>
          <div className="sw-label">
            בסטטוס מאז {fmtDate(st)}{' '}
            <button type="button" className="link" onClick={() => setEditDate((v) => !v)}>שינוי תאריך</button>
          </div>
          {editDate && (
            <input
              type="date"
              className="sw-date"
              defaultValue={st.toISOString().slice(0, 10)}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => e.target.value && patch((p) => setSince(p, e.target.value))}
            />
          )}
        </div>
      </div>

      <StatusRail project={project} />

      <div className="status-facts">
        <span>מתחילת הפרויקט: {Math.floor((now - started) / 86400000)} ימים</span>
        {left !== null && <span>{left < 0 ? `יעד ההפעלה עבר לפני ${-left} ימים` : `${left} ימים ליעד ההפעלה`}</span>}
        {over && <span className="badge mid">מעל הרגיל ({typical} ימים)</span>}
      </div>

      <div className="status-actions">
        {hold ? (
          <button type="button" className="primary" onClick={() => patch((p) => resume(p))}>
            המשך מהשלב: {statusInfo(project.prevStatus || 'prep').label}
          </button>
        ) : (
          next && (
            <button type="button" className="primary" onClick={() => go(next.id)}>
              קידום ל"{next.label}"
            </button>
          )
        )}
        {!hold && s !== 'closed' && (
          <button type="button" className="ghost" onClick={() => go('hold')}>השהיה</button>
        )}
      </div>

      <div className="chips status-chips" role="group" aria-label="בחירת סטטוס">
        {STATUSES.map((x) => (
          <button key={x.id} type="button" className={`chip${base === x.id && !hold ? ' on' : ''}`} onClick={() => go(x.id)}>
            {x.label}
          </button>
        ))}
        <button type="button" className={`chip${hold ? ' on' : ''}`} onClick={() => go(HOLD.id)}>{HOLD.label}</button>
      </div>

      <button type="button" className="link" onClick={() => setOpen((v) => !v)}>
        {open ? 'הסתרת היסטוריה' : 'היסטוריית סטטוסים'}
      </button>
      {open && (
        <ul className="status-history">
          {history(project, now).reverse().map((h, i) => (
            <li key={i}>
              <b>{statusInfo(h.status).label}</b>
              <span>{fmtDate(h.at)}</span>
              <span>{h.current ? 'עד עכשיו: ' : ''}{short(h.ms)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
