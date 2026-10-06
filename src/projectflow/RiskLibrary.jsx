import { useState } from 'react';
import { CATEGORIES, LIBRARY } from './riskLibrary.js';
import { currentStage } from './storage.js';

// בחירת סיכונים מומלצים והוספתם לרשימת הסיכונים של פרויקט.
export default function RiskLibrary({ store, risks, onClose }) {
  const [projectId, setProjectId] = useState(store.projects[0]?.id || '');
  const [cat, setCat] = useState('all');
  const [picked, setPicked] = useState(() => new Set());
  const [done, setDone] = useState(null);

  const project = store.projects.find((p) => p.id === projectId);
  const stageId = project ? currentStage(project)?.id : null;
  const has = (title) => risks.items.some((r) => r.projectId === projectId && r.title === title);

  const list = LIBRARY.filter((r) => cat === 'all' || r.category === cat).sort(
    (a, b) => Number(b.stages.includes(stageId)) - Number(a.stages.includes(stageId)) || b.p * b.s - a.p * a.s
  );
  const catOf = (id) => CATEGORIES.find((c) => c.id === id);

  const toggle = (id) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const selectRelevant = () =>
    setPicked(new Set(LIBRARY.filter((r) => r.stages.includes(stageId) && !has(r.title)).map((r) => r.id)));

  const add = () => {
    const chosen = LIBRARY.filter((r) => picked.has(r.id) && !has(r.title));
    chosen.forEach((r) =>
      risks.add({
        title: r.title,
        kind: 'risk',
        projectId,
        probability: r.p,
        severity: r.s,
        owner: '',
        mitigation: r.mitigation,
        due: '',
        category: r.category,
        status: 'open',
      })
    );
    setPicked(new Set());
    setDone(chosen.length);
  };

  if (store.projects.length === 0) {
    return <p className="pf-empty">כדי להוסיף סיכונים מהספרייה, צרו קודם פרויקט.</p>;
  }

  return (
    <section className="pf-panel rl">
      <div className="rl-head">
        <h2 className="pf-h2" style={{ margin: 0 }}>
          ספריית סיכונים מומלצת
        </h2>
        <button type="button" className="ghost sm" onClick={onClose}>
          סגירה
        </button>
      </div>
      <p className="muted">
        סיכונים נפוצים בפרויקטי רכש ומערכות מידע, עם צעד מונע מוצע. סמנו את הרלוונטיים לפרויקט,
        והתאימו אחר כך את ההסתברות, החומרה והאחראי.
      </p>

      <div className="pf-toolbar">
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="פרויקט">
          {store.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" className="ghost" onClick={selectRelevant}>
          סימון הרלוונטיים לשלב הנוכחי
        </button>
      </div>

      <div className="chips" role="group" aria-label="תחום סיכון">
        <button type="button" className={cat === 'all' ? 'chip on' : 'chip'} onClick={() => setCat('all')}>
          הכול
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={cat === c.id ? 'chip on' : 'chip'}
            style={{ '--ph': c.color }}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <ul className="rl-list">
        {list.map((r) => {
          const c = catOf(r.category);
          const exists = has(r.title);
          const e = r.p * r.s;
          return (
            <li key={r.id} className={exists ? 'exists' : ''} style={{ '--ph': c.color }}>
              <input
                type="checkbox"
                id={r.id}
                checked={picked.has(r.id)}
                disabled={exists}
                onChange={() => toggle(r.id)}
              />
              <label htmlFor={r.id}>
                <strong>{r.title}</strong>
                <span className="rl-meta">
                  <span className="tag">{c.label}</span>
                  <span className={`badge ${e >= 6 ? 'high' : e >= 3 ? 'mid' : 'low'}`}>חשיפה {e}</span>
                  {r.stages.includes(stageId) && <span className="badge mid">רלוונטי עכשיו</span>}
                  {exists && <span className="muted">כבר ברשימה</span>}
                </span>
                <span className="rl-fix">צעד מונע: {r.mitigation}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="rl-bar">
        <button type="button" disabled={picked.size === 0} onClick={add}>
          הוספת {picked.size > 0 ? picked.size : ''} נבחרים לפרויקט
        </button>
        {done !== null && (
          <span className="pf-ok" role="status">
            נוספו {done} סיכונים לרשימה.
          </span>
        )}
      </div>
    </section>
  );
}
