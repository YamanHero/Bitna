import { useRef, useState } from 'react';
import { markDirty } from '../lib/cloud.js';
import { RISKS_KEY, exposure, kindLabel } from './registers.js';
import { currentStage, overallProgress, overdueStages } from './storage.js';

const PREFIX = 'projectflow.';
const TYPES = { it: 'פרויקט IT', procurement: 'רכש' };

function collect() {
  const data = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) data[key] = localStorage.getItem(key);
  }
  return data;
}

function readList(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// CSV עם BOM כדי שאקסל יציג עברית נכון.
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function downloadCsv(filename, rows) {
  const text = `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}`;
  download(new Blob([text], { type: 'text/csv;charset=utf-8' }), filename);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export default function Backup({ store }) {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);

  const exportData = () => {
    try {
      const data = collect();
      const payload = { app: 'projectflow', version: 1, exportedAt: new Date().toISOString(), data };
      download(
        new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
        `projectflow-backup-${stamp()}.json`
      );
      setMsg({ ok: true, text: `נשמר קובץ גיבוי עם ${Object.keys(data).length} אוספי נתונים.` });
    } catch {
      setMsg({ ok: false, text: 'הגיבוי נכשל. נסו שוב או פתחו את האפליקציה בדפדפן אחר.' });
    }
  };

  const exportProjects = () => {
    const rows = [
      ['שם', 'סוג', 'אחראי', 'תקציב', 'יעד הפעלה', 'התקדמות %', 'שלב נוכחי', 'שלבים באיחור'],
      ...store.projects.map((p) => [
        p.name,
        TYPES[p.type] || p.type,
        p.owner,
        p.budget,
        p.targetDate,
        overallProgress(p),
        currentStage(p)?.title || 'הושלם',
        overdueStages(p)
          .map((s) => s.title)
          .join('; '),
      ]),
    ];
    downloadCsv(`projects-${stamp()}.csv`, rows);
    setMsg({ ok: true, text: `יוצאו ${store.projects.length} פרויקטים לקובץ שנפתח באקסל.` });
  };

  const exportRisks = () => {
    const risks = readList(RISKS_KEY);
    const name = (id) => store.projects.find((p) => p.id === id)?.name || '';
    const rows = [
      ['תיאור', 'סוג', 'פרויקט', 'הסתברות', 'חומרה', 'חשיפה', 'אחראי', 'טיפול', 'יעד', 'מצב'],
      ...risks.map((r) => [
        r.title,
        kindLabel(r.kind),
        name(r.projectId),
        r.probability,
        r.severity,
        exposure(r),
        r.owner,
        r.mitigation,
        r.due,
        r.status === 'closed' ? 'סגור' : 'פתוח',
      ]),
    ];
    downloadCsv(`risks-${stamp()}.csv`, rows);
    setMsg({ ok: true, text: `יוצאו ${risks.length} רשומות סיכון לקובץ שנפתח באקסל.` });
  };

  const importData = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const entries = Object.entries(payload?.data || {});
      const valid = entries.filter(
        ([k, v]) => k.startsWith(PREFIX) && typeof v === 'string' && v.length > 0
      );
      if (payload?.app !== 'projectflow' || valid.length === 0) {
        setMsg({ ok: false, text: 'הקובץ אינו גיבוי של מגדל בקרה. בחרו קובץ שנוצר בלחיצה על "הורדת גיבוי".' });
        return;
      }
      if (!window.confirm('הנתונים הנוכחיים בדפדפן זה יוחלפו בנתוני הקובץ. להמשיך?')) return;
      valid.forEach(([k, v]) => localStorage.setItem(k, v));
      markDirty();
      window.location.reload();
    } catch {
      setMsg({ ok: false, text: 'לא ניתן לקרוא את הקובץ. ודאו שהוא קובץ JSON תקין.' });
    }
  };

  return (
    <>
      <section className="pf-panel">
        <h2 className="pf-h2" style={{ marginTop: 0 }}>
          גיבוי ושחזור
        </h2>
        <p className="muted">
          הנתונים נשמרים בדפדפן הזה בלבד. הורידו גיבוי כדי להעביר אותם למחשב אחר או כדי לא לאבד אותם
          אם ינקו את נתוני הדפדפן.
        </p>
        <div className="row">
          <button type="button" onClick={exportData}>
            הורדת גיבוי
          </button>
          <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
            שחזור מקובץ
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={importData}
            hidden
          />
        </div>
      </section>

      <section className="pf-panel">
        <h2 className="pf-h2" style={{ marginTop: 0 }}>
          ייצוא לאקסל
        </h2>
        <p className="muted">קובצי CSV שנפתחים באקסל, לדוחות ולשיתוף עם מי שאין לו גישה לאפליקציה.</p>
        <div className="row">
          <button type="button" className="ghost" onClick={exportProjects}>
            ייצוא פרויקטים
          </button>
          <button type="button" className="ghost" onClick={exportRisks}>
            ייצוא סיכונים
          </button>
        </div>
      </section>

      {msg && (
        <p className={msg.ok ? 'pf-ok' : 'pf-err'} role="status">
          {msg.text}
        </p>
      )}
    </>
  );
}
