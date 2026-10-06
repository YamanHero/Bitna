import { useRef, useState } from 'react';

const PREFIX = 'projectflow.';

function collect() {
  const data = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) data[key] = localStorage.getItem(key);
  }
  return data;
}

export default function Backup() {
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);

  const exportData = () => {
    try {
      const data = collect();
      const payload = { app: 'projectflow', version: 1, exportedAt: new Date().toISOString(), data };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `projectflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg({ ok: true, text: `נשמר קובץ גיבוי עם ${Object.keys(data).length} אוספי נתונים.` });
    } catch {
      setMsg({ ok: false, text: 'הגיבוי נכשל. נסו שוב או פתחו את האפליקציה בדפדפן אחר.' });
    }
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
        setMsg({ ok: false, text: 'הקובץ אינו גיבוי של ProjectFlow. בחרו קובץ שנוצר בלחיצה על "הורדת גיבוי".' });
        return;
      }
      if (!window.confirm('הנתונים הנוכחיים בדפדפן זה יוחלפו בנתוני הקובץ. להמשיך?')) return;
      valid.forEach(([k, v]) => localStorage.setItem(k, v));
      window.location.reload();
    } catch {
      setMsg({ ok: false, text: 'לא ניתן לקרוא את הקובץ. ודאו שהוא קובץ JSON תקין.' });
    }
  };

  return (
    <section className="pf-panel">
      <h2 className="pf-h2">גיבוי ושחזור</h2>
      <p className="muted">
        הנתונים נשמרים בדפדפן הזה בלבד. הורידו גיבוי כדי להעביר אותם למחשב אחר או כדי לא לאבד אותם אם
        ינקו את נתוני הדפדפן.
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
      {msg && (
        <p className={msg.ok ? 'pf-ok' : 'pf-err'} role="status">
          {msg.text}
        </p>
      )}
    </section>
  );
}
