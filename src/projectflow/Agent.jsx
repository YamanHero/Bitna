import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { accessToken } from '../lib/cloud.js';
import { ALFON_NAME, alfonDecisions, alfonRisks, makeAlfonProject } from './alfon.js';
import {
  CHANGES_KEY,
  DECISIONS_KEY,
  MEETINGS_KEY,
  PAYMENTS_KEY,
  RISKS_KEY,
  TEAM_KEY,
  kindLabel,
  useList,
} from './registers.js';
import { overallProgress, stagesOf, uid } from './storage.js';

// מפתחות שאינם מתחילים ב-"projectflow." כדי שהשיחה לא תיכנס לגיבוי ולסנכרון.
const CHAT_KEY = 'pfagent.chat';
const DOCS_KEY = 'pfagent.docs';

const QUICK = [
  'הצג תמונת מצב, החלטות פתוחות ו-3 עד 5 הפעולות החשובות ביותר',
  'הכן מסמך ושאלון לפגישת ההתנעה',
  'מה מעכב את פרויקט האלפון הדיגיטלי?',
  'אילו החלטות אני צריך לקבל השבוע?',
  'הכן לי סדר יום לפגישת הסטטוס עם הספק',
  'הכן דוח יומי',
  'הכן סקירה שבועית להנהלה',
  'הצע טבלת RACI לפרויקט',
];

const todayStr = () => new Date().toISOString().slice(0, 10);

const lsGet = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* אין שמירה מקומית */
  }
};

// תמונת מצב תמציתית לשליחה לסוכן: רק נתוני ניהול פרויקט, בלי מידע אישי של בוחרים.
function snapshot({ projects, risks, decisions, changes, payments, meetings, team }) {
  const who = (id) => team.find((m) => m.id === id)?.name || id || '';
  return {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      owner: p.owner || '',
      budget: p.budget || '',
      targetDate: p.targetDate || '',
      status: p.status || '',
      progress: overallProgress(p),
      stages: stagesOf(p).map((s) => ({
        id: s.id,
        title: s.title,
        due: p.stageMeta?.[s.id]?.due || '',
        tasks: p.tasks
          .filter((t) => t.stage === s.id)
          .map((t) => ({ title: t.title, done: Boolean(t.done), assignee: who(t.assignee), due: t.due || '' })),
      })),
    })),
    risks: risks.map((r) => ({
      projectId: r.projectId, title: r.title, kind: kindLabel(r.kind), probability: r.probability, severity: r.severity,
      owner: r.owner || '', mitigation: r.mitigation || '', due: r.due || '', status: r.status || 'open',
    })),
    decisions: decisions.map((d) => ({
      projectId: d.projectId, title: d.title, decision: d.decision || '', decidedBy: d.decidedBy || '', date: d.date || '',
      status: d.status === 'pending' ? 'ממתינה להכרעה' : 'התקבלה',
    })),
    changeRequests: changes.map((c) => ({ projectId: c.projectId, title: c.title, status: c.status, impact: c.impact || '' })),
    payments: payments.map((p) => ({ projectId: p.projectId, title: p.title || p.milestone || '', amount: p.amount || '', status: p.status || '' })),
    meetings: meetings.slice(0, 30).map((m) => ({
      projectId: m.projectId, title: m.title, date: m.date, summary: (m.summary || '').slice(0, 1500),
      decisions: (m.decisions || []).map((d) => (typeof d === 'string' ? d : d.text)).slice(0, 20),
      actions: (m.actions || []).map((a) => ({ title: a.title, owner: a.owner || '', due: a.due || '', done: Boolean(a.done) })).slice(0, 30),
    })),
  };
}

// הצגה פשוטה של טקסט מהסוכן: כותרות, תבליטים והדגשות.
function Rich({ text }) {
  const bold = (s) => s.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
  const out = [];
  let list = null;
  text.split('\n').forEach((raw, i) => {
    const line = raw.trimEnd();
    const li = line.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (li) {
      if (!list) {
        list = [];
        out.push(<ul key={`l${i}`} className="ag-ul">{list}</ul>);
      }
      list.push(<li key={i}>{bold(li[1])}</li>);
      return;
    }
    list = null;
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) out.push(<h3 key={i} className="ag-h">{bold(h[1])}</h3>);
    else if (line.trim()) out.push(<p key={i}>{bold(line)}</p>);
  });
  return <div className="ag-rich">{out}</div>;
}

const TYPE_LABEL = { task: 'משימה', risk: 'סיכון', decision: 'החלטה לקבלה' };

export default function Agent({ store }) {
  const risks = useList(RISKS_KEY);
  const decisions = useList(DECISIONS_KEY);
  const changes = useList(CHANGES_KEY).items;
  const payments = useList(PAYMENTS_KEY).items;
  const meetings = useList(MEETINGS_KEY).items;
  const team = useList(TEAM_KEY).items;

  const [chat, setChat] = useState(() => lsGet(CHAT_KEY, []));
  const [docs, setDocs] = useState(() => lsGet(DOCS_KEY, ''));
  const [showDocs, setShowDocs] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [server, setServer] = useState(null);
  const endRef = useRef(null);

  const alfon = store.projects.find((p) => p.name === ALFON_NAME);
  const [focus, setFocus] = useState('');
  const focusId = focus || alfon?.id || '';

  useEffect(() => lsSet(CHAT_KEY, chat.slice(-60)), [chat]);
  useEffect(() => lsSet(DOCS_KEY, docs), [docs]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [chat, busy]);
  useEffect(() => {
    fetch('/api/agent')
      .then((r) => (r.ok ? r.json() : null))
      .then(setServer)
      .catch(() => setServer(null));
  }, []);

  const context = useMemo(
    () => snapshot({ projects: store.projects, risks: risks.items, decisions: decisions.items, changes, payments, meetings, team }),
    [store.projects, risks.items, decisions.items, changes, payments, meetings, team]
  );

  const setupAlfon = () => {
    const p = makeAlfonProject();
    store.add(p);
    alfonRisks(p.id).forEach((r) => risks.add(r));
    alfonDecisions(p.id).forEach((d) => decisions.add(d));
    setFocus(p.id);
    setChat((c) => [
      ...c,
      {
        id: uid(),
        role: 'assistant',
        content:
          `## הפרויקט הוקם\nנפתח הפרויקט **${ALFON_NAME}** עם 9 קבוצות עבודה ו-WBS ראשוני, 5 סיכונים פתוחים ו-4 החלטות הממתינות להכרעה.\n` +
          '- אחראים ומועדים לא נקבעו, כי אין להם עדיין בסיס מאושר. הם ייקבעו בהתנעה.\n' +
          '- כדי שאוכל לנתח דרישות, הדביקו את תוכן שלושת מסמכי המקור בלשונית "מסמכי מקור".\n' +
          '- הצעד הבא המומלץ: "הכן מסמך ושאלון לפגישת ההתנעה".',
      },
    ]);
  };

  const ask = async (q) => {
    const question = (q ?? input).trim();
    if (!question || busy) return;
    setError('');
    setInput('');
    const next = [...chat, { id: uid(), role: 'user', content: question }];
    setChat(next);
    setBusy(true);
    try {
      const token = await accessToken();
      if (!token) throw new Error('צריך להתחבר לחשבון (בלשונית "עוד") כדי להשתמש בסוכן.');
      const r = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          context,
          focusProjectId: focusId,
          documents: docs,
          today: todayStr(),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'הסוכן לא הגיב. נסו שוב.');
      setChat((c) => [
        ...c,
        { id: uid(), role: 'assistant', content: data.text || '', proposals: (data.proposals || []).map((p) => ({ ...p, pid: uid(), state: 'new' })) },
      ]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const markProposal = (msgId, pid, state) =>
    setChat((c) => c.map((m) => (m.id === msgId ? { ...m, proposals: m.proposals.map((p) => (p.pid === pid ? { ...p, state } : p)) } : m)));

  const accept = (msgId, p) => {
    const project = store.projects.find((x) => x.id === p.projectId) || store.projects.find((x) => x.id === focusId);
    if (p.type === 'task') {
      if (!project) return setError('לא נמצא פרויקט למשימה.');
      const stages = stagesOf(project);
      const stage = stages.find((s) => s.id === p.stageId) || stages[0];
      if (!stage) return setError('לפרויקט אין שלבים. הוסיפו שלב ונסו שוב.');
      store.update(project.id, (x) => ({
        ...x,
        tasks: [...x.tasks, { id: uid(), stage: stage.id, title: p.title, done: false, due: p.due, note: p.details, source: 'agent' }],
      }));
    } else if (p.type === 'risk') {
      risks.add({ title: p.title, kind: p.kind, projectId: project?.id || '', probability: p.probability, severity: p.severity, owner: '', mitigation: p.details, due: p.due, status: 'open', source: 'agent' });
    } else {
      decisions.add({ title: p.title, projectId: project?.id || '', decision: p.details, decidedBy: '', date: '', status: 'pending', source: 'agent' });
    }
    markProposal(msgId, p.pid, 'added');
  };

  const loadFile = async (e) => {
    const files = [...(e.target.files || [])];
    const parts = await Promise.all(files.map(async (f) => `=== ${f.name} ===\n${await f.text()}`));
    setDocs((d) => [d, ...parts].filter(Boolean).join('\n\n'));
    e.target.value = '';
  };

  const projectName = (id) => store.projects.find((p) => p.id === id)?.name || '';

  return (
    <div className="ag">
      <section className="ai-card ag-head">
        <div>
          <h2>Elections Project Manager 360</h2>
          <p className="muted">
            סוכן ניהול פרויקטים, ספקים ותוכנית העבודה של מינהל הבחירות. הסוכן מנתח את הנתונים שבמערכת ומציע פעולות;
            שום דבר לא נשמר בלי אישור שלכם.
          </p>
        </div>
        {server && !server.configured && (
          <p className="ag-warn">הסוכן עוד לא הופעל בשרת: יש להגדיר את המשתנה ANTHROPIC_API_KEY בפרויקט ב-Vercel.</p>
        )}
        <div className="pf-toolbar">
          <select value={focusId} onChange={(e) => setFocus(e.target.value)} aria-label="פרויקט במוקד">
            <option value="">כל הפרויקטים (Portfolio)</option>
            {store.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" className="ghost" onClick={() => setShowDocs((v) => !v)}>
            מסמכי מקור{docs.trim() ? ' ✓' : ''}
          </button>
          {chat.length > 0 && (
            <button type="button" className="ghost" onClick={() => window.confirm('לנקות את השיחה?') && setChat([])}>
              שיחה חדשה
            </button>
          )}
        </div>
        {!alfon && (
          <div className="ag-setup">
            <p>
              <strong>{ALFON_NAME}</strong> עוד לא הוקם במערכת.
            </p>
            <button type="button" onClick={setupAlfon}>
              הקמת הפרויקט (9 קבוצות עבודה, WBS, סיכונים והחלטות פתוחות)
            </button>
          </div>
        )}
        {showDocs && (
          <div className="ag-docs">
            <p className="muted">
              הדביקו כאן את תוכן מסמכי המקור (דרישות עסקיות, תיאור הפתרון, תיאור התהליך), או טענו קובצי טקסט. התוכן נשמר רק במכשיר
              הזה ונשלח לסוכן עם כל שאלה. אין להדביק מידע אישי של בוחרים.
            </p>
            <textarea rows={8} value={docs} onChange={(e) => setDocs(e.target.value)} placeholder="תוכן המסמכים…" />
            <div className="row">
              <label className="ghost ag-file">
                טעינת קובץ טקסט
                <input type="file" accept=".txt,.md,.csv" multiple onChange={loadFile} hidden />
              </label>
              {docs && (
                <button type="button" className="ghost" onClick={() => setDocs('')}>
                  ניקוי
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="ag-chat">
        {chat.length === 0 && (
          <div className="ag-quick">
            {QUICK.map((q) => (
              <button key={q} type="button" className="ghost" onClick={() => ask(q)} disabled={busy}>
                {q}
              </button>
            ))}
          </div>
        )}
        {chat.map((m) => (
          <div key={m.id} className={`ag-msg ag-${m.role}`}>
            {m.role === 'user' ? <p>{m.content}</p> : <Rich text={m.content} />}
            {m.proposals?.length > 0 && (
              <div className="ag-props">
                <p className="muted">הצעות הסוכן – לא נשמרו. בחרו מה להוסיף:</p>
                {m.proposals.map((p) => (
                  <div key={p.pid} className={`ag-prop ${p.state}`}>
                    <div>
                      <span className="ag-tag">{TYPE_LABEL[p.type]}</span> <strong>{p.title}</strong>
                      {projectName(p.projectId) && <span className="muted"> · {projectName(p.projectId)}</span>}
                      {p.details && <p className="muted">{p.details}</p>}
                      {p.reason && <p className="muted">למה: {p.reason}</p>}
                    </div>
                    {p.state === 'new' ? (
                      <div className="row">
                        <button type="button" onClick={() => accept(m.id, p)}>
                          הוספה
                        </button>
                        <button type="button" className="ghost" onClick={() => markProposal(m.id, p.pid, 'dismissed')}>
                          דחייה
                        </button>
                      </div>
                    ) : (
                      <span className="muted">{p.state === 'added' ? 'נוסף' : 'נדחה'}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="muted ag-busy">הסוכן מנתח…</p>}
        {error && <p className="ag-warn">{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        className="ag-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              ask();
            }
          }}
          placeholder="שאלו את הסוכן, למשל: מה תהיה השפעת דחייה של שבועיים בממשק?"
          aria-label="שאלה לסוכן"
        />
        <button type="submit" disabled={busy || !input.trim()}>
          שליחה
        </button>
      </form>
      <p className="muted ai-note">
        לעוזר הכללים הקבועים (בלי בינה מלאכותית): <Link to="/projectflow/assistant">עוזר</Link>.
      </p>
    </div>
  );
}
