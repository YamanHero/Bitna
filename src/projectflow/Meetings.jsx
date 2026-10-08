import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DECISIONS_KEY, MEETINGS_KEY, TEAM_KEY, useList } from './registers.js';
import { deleteAudio, extract, getAudio, parseDue, saveAudio, summaryText } from './meetings.js';
import { currentStage, stagesOf, uid } from './storage.js';

const today = () => new Date().toISOString().slice(0, 10);
const two = (n) => String(n).padStart(2, '0');
const clock = (s) => `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function newMeeting(list, projectId = '') {
  const id = uid();
  list.add({ id, title: '', projectId, date: today(), attendees: [], notes: '', transcript: '', summary: '', decisions: [], actions: [], audioMs: 0 });
  return id;
}

// ---------- הקלטה ותמלול ----------
function Recorder({ meeting, onPatch }) {
  const [state, setState] = useState('idle'); // idle | rec | paused
  const [secs, setSecs] = useState(meeting.audioMs ? Math.round(meeting.audioMs / 1000) : 0);
  const [err, setErr] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [stt, setStt] = useState(lsGet('pfui.stt') === '1');
  const mr = useRef(null);
  const chunks = useRef([]);
  const stream = useRef(null);
  const rec = useRef(null);
  const live = useRef(false);
  const tRef = useRef('');
  const secsRef = useRef(secs);
  secsRef.current = secs;
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const canRecord = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    let url = '';
    getAudio(meeting.id).then((b) => { if (b) { url = URL.createObjectURL(b); setAudioUrl(url); } }).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [meeting.id, meeting.audioMs]);

  useEffect(() => {
    if (state !== 'rec') return undefined;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => () => { live.current = false; try { rec.current?.stop(); } catch { /* */ } stream.current?.getTracks().forEach((t) => t.stop()); }, []);

  const startStt = () => {
    if (!SR || !stt) return;
    const r = new SR();
    r.lang = 'he-IL';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        if (e.results[i].isFinal) {
          tRef.current = `${tRef.current}${tRef.current ? '\n' : ''}${e.results[i][0].transcript.trim()}`;
          onPatch({ transcript: tRef.current });
        }
      }
    };
    r.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') setErr('התמלול החי לא זמין כרגע במכשיר הזה. ההקלטה נמשכת, ואפשר להקליד סיכום או להעתיק תמלול.'); };
    r.onend = () => { if (live.current) { try { r.start(); } catch { /* */ } } };
    rec.current = r;
    try { r.start(); } catch { /* */ }
  };

  const start = async () => {
    setErr('');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErr('אין גישה למיקרופון. אשרו הרשאה בדפדפן ונסו שוב.');
      return;
    }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
    mr.current = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
    chunks.current = [];
    tRef.current = meeting.transcript || '';
    mr.current.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    mr.current.onstop = async () => {
      const blob = new Blob(chunks.current, { type: mr.current.mimeType || 'audio/webm' });
      stream.current?.getTracks().forEach((t) => t.stop());
      try { await saveAudio(meeting.id, blob); onPatch({ audioMs: Math.max(1, secsRef.current) * 1000 }); } catch { setErr('לא ניתן לשמור את ההקלטה במכשיר (חסר מקום?).'); }
    };
    mr.current.start(1000);
    live.current = true;
    startStt();
    setState('rec');
  };
  const pause = () => { mr.current?.pause(); live.current = false; try { rec.current?.stop(); } catch { /* */ } setState('paused'); };
  const resume = () => { mr.current?.resume(); live.current = true; startStt(); setState('rec'); };
  const stop = () => { live.current = false; try { rec.current?.stop(); } catch { /* */ } try { mr.current?.stop(); } catch { /* */ } setState('idle'); };
  const drop = async () => {
    if (!window.confirm('למחוק את ההקלטה מהמכשיר? הסיכום והמשימות יישארו.')) return;
    await deleteAudio(meeting.id).catch(() => {});
    setAudioUrl('');
    setSecs(0);
    onPatch({ audioMs: 0 });
  };

  return (
    <section className="status-card rec-card" aria-label="הקלטה">
      <div className="rec-row">
        <div className={`rec-time${state === 'rec' ? ' live' : ''}`} dir="ltr">{clock(secs)}</div>
        <div className="rec-btns">
          {state === 'idle' && (
            <button type="button" className="primary rec-main" onClick={start} disabled={!canRecord}>
              ● {audioUrl ? 'המשך להקליט' : 'התחלת הקלטה'}
            </button>
          )}
          {state === 'rec' && (
            <>
              <button type="button" className="ghost rec-main" onClick={pause}>השהיה</button>
              <button type="button" className="danger rec-main" onClick={stop}>■ סיום</button>
            </>
          )}
          {state === 'paused' && (
            <>
              <button type="button" className="primary rec-main" onClick={resume}>המשך</button>
              <button type="button" className="danger rec-main" onClick={stop}>■ סיום</button>
            </>
          )}
        </div>
      </div>
      {!canRecord && <p className="muted">הדפדפן הזה לא תומך בהקלטה. אפשר לכתוב סיכום ידנית.</p>}
      <label className="stt-toggle">
        <input type="checkbox" checked={stt} disabled={state !== 'idle' || !SR} onChange={(e) => { setStt(e.target.checked); lsSet('pfui.stt', e.target.checked ? '1' : '0'); }} />
        <span>תמלול חי בעברית {!SR && '(לא נתמך בדפדפן הזה)'}</span>
      </label>
      <p className="rec-note">
        יש ליידע את המשתתפים שהפגישה מוקלטת. ההקלטה נשמרת במכשיר הזה בלבד ואינה עולה לענן. התמלול החי מבוצע על ידי שירות הדפדפן
        (ב-Chrome האודיו נשלח לשרתי Google), ולכן ברירת המחדל כבויה. בפגישות רגישות השאירו כבוי וכתבו נקודות בעצמכם.
      </p>
      {err && <p className="warn" role="alert">{err}</p>}
      {audioUrl && state === 'idle' && (
        <div className="rec-audio">
          <audio controls src={audioUrl} />
          <a className="link" href={audioUrl} download={`${meeting.title || 'פגישה'}.webm`}>הורדה</a>
          <button type="button" className="link" onClick={drop}>מחיקת ההקלטה</button>
        </div>
      )}
    </section>
  );
}


// בחירת משתתפים: מקובצים לפי גוף/יחידה, עם חיפוש והוספת איש חדש לרשימה.
function Attendees({ meeting, team, onChange }) {
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ name: '', org: '', kind: 'internal' });
  const [adding, setAdding] = useState(false);
  const orgs = [...new Set(team.items.map((m) => m.org).filter(Boolean))];
  const on = (n) => meeting.attendees.includes(n);
  const toggle = (n) => onChange(on(n) ? meeting.attendees.filter((x) => x !== n) : [...meeting.attendees, n]);
  const matches = (m) => !q.trim() || `${m.name} ${m.org || ''}`.includes(q.trim());
  const groups = [...orgs, ''].map((o) => ({ org: o, people: team.items.filter((m) => (m.org || '') === o && matches(m)) })).filter((g) => g.people.length);
  const allOn = (g) => g.people.every((p) => on(p.name));
  const toggleGroup = (g) =>
    onChange(allOn(g) ? meeting.attendees.filter((n) => !g.people.some((p) => p.name === n)) : [...new Set([...meeting.attendees, ...g.people.map((p) => p.name)])]);
  const add = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    if (!team.items.some((m) => m.name === name)) team.add({ name, org: form.org.trim(), kind: form.kind, role: '', contact: '' });
    if (!on(name)) onChange([...meeting.attendees, name]);
    setForm({ name: '', org: form.org, kind: form.kind });
  };
  return (
    <div className="att">
      <div className="att-head">
        <div className="mt-lab">משתתפים {meeting.attendees.length > 0 && <span className="badge">{meeting.attendees.length} נבחרו</span>}</div>
        <button type="button" className="link" onClick={() => setAdding((v) => !v)}>{adding ? 'סגירה' : '+ הוספת איש חדש'}</button>
      </div>
      {team.items.length > 8 && <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש שם או יחידה" aria-label="חיפוש משתתף" />}
      {groups.map((g) => (
        <div key={g.org || '_'} className="att-group">
          <button type="button" className="att-org" onClick={() => toggleGroup(g)} aria-label={`בחירת כל ${g.org || 'ללא שיוך'}`}>
            {g.org || 'ללא שיוך'} <small>{allOn(g) ? 'ביטול הכל' : 'בחירת הכל'}</small>
          </button>
          <div className="chips">
            {g.people.map((p) => (
              <button key={p.id} type="button" className={`chip${on(p.name) ? ' on' : ''}`} aria-pressed={on(p.name)} onClick={() => toggle(p.name)}>{p.name}</button>
            ))}
          </div>
        </div>
      ))}
      {team.items.length === 0 && <p className="muted">אין אנשים ברשימה. הוסיפו את הראשון.</p>}
      {adding && (
        <form className="att-add" onSubmit={add}>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="שם מלא" aria-label="שם איש חדש" required />
          <input value={form.org} onChange={(e) => setForm((f) => ({ ...f, org: e.target.value }))} list="pf-orgs-m" placeholder="גוף או יחידה (למשל: שם הספק)" aria-label="גוף או יחידה" />
          <datalist id="pf-orgs-m">{orgs.map((o) => <option key={o} value={o} />)}</datalist>
          <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))} aria-label="שייכות">
            <option value="internal">פנימי</option>
            <option value="vendor">ספק</option>
            <option value="other">גורם חיצוני</option>
          </select>
          <button type="submit">הוספה ובחירה</button>
        </form>
      )}
    </div>
  );
}

// ---------- עורך פגישה ----------
function Editor({ meeting, store, list }) {
  const navigate = useNavigate();
  const teamList = useList(TEAM_KEY);
  const team = teamList.items;
  const decisions = useList(DECISIONS_KEY);
  const [msg, setMsg] = useState('');
  const patch = (p) => list.update(meeting.id, p);
  const project = store.projects.find((p) => p.id === meeting.projectId);
  const ownerName = (id) => team.find((m) => m.id === id)?.name || '';
  const labelOf = (n) => { const p = team.find((x) => x.name === n); return p?.org ? `${n} (${p.org})` : n; };
  const setAction = (id, p) => patch({ actions: meeting.actions.map((a) => (a.id === id ? { ...a, ...p } : a)) });

  const insert = (prefix) => patch({ notes: `${meeting.notes}${meeting.notes && !meeting.notes.endsWith('\n') ? '\n' : ''}${prefix}: ` });

  const generate = () => {
    const r = extract({ title: meeting.title, notes: meeting.notes, transcript: meeting.transcript, attendees: meeting.attendees.map(labelOf), team });
    const keepA = meeting.actions.filter((a) => a.taskId || a.manual);
    const keepD = meeting.decisions.filter((d) => d.logged || d.manual);
    const known = new Set([...keepA.map((a) => a.title), ...keepD.map((d) => d.text)]);
    patch({
      summary: r.summary,
      actions: [...keepA, ...r.actions.filter((a) => !known.has(a.title))],
      decisions: [...keepD, ...r.decisions.filter((d) => !known.has(d.text))],
    });
    setMsg(`נוצרו טיוטה לסיכום, ${r.actions.length} פעולות ו-${r.decisions.length} החלטות. עברו עליהן ותקנו לפי הצורך.`);
  };

  const addManualAction = () => patch({ actions: [...meeting.actions, { id: uid(), title: '', owner: '', due: '', manual: true }] });
  const addManualDecision = () => patch({ decisions: [...meeting.decisions, { id: uid(), text: '', manual: true }] });

  const pending = meeting.actions.filter((a) => !a.taskId && a.title.trim());
  const pushToProject = () => {
    if (!project) { setMsg('בחרו פרויקט כדי להוסיף אליו את המשימות.'); return; }
    const stage = currentStage(project) || stagesOf(project).slice(-1)[0];
    const stageId = stage ? stage.id : 'c_meetings';
    const made = pending.map((a) => ({ a, task: { id: uid(), stage: stageId, title: a.title.trim(), done: false, assignee: a.owner || '', due: a.due || '', fromMeeting: meeting.id } }));
    store.update(project.id, (p) => ({
      ...p,
      stages: stage ? stagesOf(p) : [...stagesOf(p), { id: 'c_meetings', title: 'פעולות מפגישות' }],
      tasks: [...p.tasks, ...made.map((x) => x.task)],
    }));
    patch({ actions: meeting.actions.map((a) => made.find((x) => x.a.id === a.id) ? { ...a, taskId: made.find((x) => x.a.id === a.id).task.id } : a) });
    setMsg(`נוספו ${made.length} משימות לפרויקט "${project.name}"${stage ? ` בשלב "${stage.title}"` : ''}.`);
  };

  const logDecision = (d) => {
    decisions.add({ title: d.text.slice(0, 80), projectId: meeting.projectId, decision: d.text, decidedBy: meeting.attendees.join(', '), date: meeting.date });
    patch({ decisions: meeting.decisions.map((x) => (x.id === d.id ? { ...x, logged: true } : x)) });
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(summaryText({ ...meeting, attendees: meeting.attendees.map(labelOf) }, ownerName)); setMsg('הסיכום הועתק. אפשר להדביק במייל.'); } catch { setMsg('ההעתקה נחסמה בדפדפן.'); }
  };

  const remove = async () => {
    if (!window.confirm('למחוק את הפגישה? משימות שכבר נוספו לפרויקט יישארו.')) return;
    await deleteAudio(meeting.id).catch(() => {});
    list.remove(meeting.id);
    navigate('/projectflow/meetings');
  };

  return (
    <>
      <Link to="/projectflow/meetings">חזרה לכל הפגישות</Link>
      <section className="status-card mt-form">
        <label>
          נושא הפגישה
          <input value={meeting.title} onChange={(e) => patch({ title: e.target.value })} placeholder="למשל: ישיבת מעקב עם הספק" />
        </label>
        <div className="mt-two">
          <label>
            פרויקט
            <select value={meeting.projectId} onChange={(e) => patch({ projectId: e.target.value })}>
              <option value="">ללא פרויקט</option>
              {store.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>
            תאריך
            <input type="date" value={meeting.date} onChange={(e) => patch({ date: e.target.value })} />
          </label>
        </div>
        <Attendees meeting={meeting} team={teamList} onChange={(attendees) => patch({ attendees })} />
      </section>

      <Recorder meeting={meeting} onPatch={patch} />

      <section className="status-card mt-form">
        <div className="mt-lab">הערות מהפגישה</div>
        <div className="chips">
          <button type="button" className="chip" onClick={() => insert('משימה')}>+ משימה</button>
          <button type="button" className="chip" onClick={() => insert('החלטה')}>+ החלטה</button>
        </div>
        <textarea rows={7} value={meeting.notes} onChange={(e) => patch({ notes: e.target.value })} aria-label="הערות" placeholder={'כתבו נקודות חופשיות. שורה שמתחילה ב"משימה:" או "החלטה:" תזוהה אוטומטית.\nלדוגמה: משימה: דנה תשלח את מסמך האפיון עד יום חמישי'} />
        <details>
          <summary>תמלול הפגישה{meeting.transcript ? ` (${meeting.transcript.split('\n').length} שורות)` : ''}</summary>
          <textarea rows={6} value={meeting.transcript} onChange={(e) => patch({ transcript: e.target.value })} aria-label="תמלול" placeholder="התמלול החי יופיע כאן. אפשר גם להדביק תמלול או להכתיב במקלדת של הטלפון." />
        </details>
        <button type="button" className="primary" onClick={generate} disabled={!meeting.notes.trim() && !meeting.transcript.trim()}>הפקת סיכום ופעולות</button>
        {msg && <p className="muted" role="status">{msg}</p>}
      </section>

      {(meeting.summary || meeting.actions.length > 0 || meeting.decisions.length > 0) && (
        <>
          <section className="status-card mt-form">
            <div className="mt-lab">סיכום</div>
            <textarea rows={7} value={meeting.summary} onChange={(e) => patch({ summary: e.target.value })} aria-label="סיכום" />
          </section>

          <section className="status-card mt-form">
            <div className="mt-lab">החלטות</div>
            <ul className="mt-list">
              {meeting.decisions.map((d) => (
                <li key={d.id}>
                  <input value={d.text} onChange={(e) => patch({ decisions: meeting.decisions.map((x) => (x.id === d.id ? { ...x, text: e.target.value } : x)) })} aria-label="החלטה" />
                  {d.logged ? <span className="badge low">ביומן</span> : <button type="button" className="ghost sm" onClick={() => logDecision(d)} disabled={!d.text.trim()}>ליומן ההחלטות</button>}
                  <button type="button" className="danger icon-btn" aria-label="הסרה" onClick={() => patch({ decisions: meeting.decisions.filter((x) => x.id !== d.id) })}>✕</button>
                </li>
              ))}
            </ul>
            <button type="button" className="link" onClick={addManualDecision}>+ החלטה</button>
          </section>

          <section className="status-card mt-form">
            <div className="mt-lab">משימות מהפגישה</div>
            <ul className="mt-list">
              {meeting.actions.map((a) => (
                <li key={a.id} className={a.taskId ? 'sent' : ''}>
                  <input value={a.title} disabled={!!a.taskId} onChange={(e) => setAction(a.id, { title: e.target.value })} aria-label="משימה" />
                  <div className="mt-meta">
                    <select value={a.owner} disabled={!!a.taskId} onChange={(e) => setAction(a.id, { owner: e.target.value })} aria-label="אחראי">
                      <option value="">ללא אחראי</option>
                      {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <input type="date" value={a.due || ''} disabled={!!a.taskId} onChange={(e) => setAction(a.id, { due: e.target.value })} aria-label="יעד" />
                    {a.suggested && !a.taskId && <span className="badge mid">מוצע, כדאי לאשר</span>}
                    {a.taskId ? <span className="badge low">נוספה לפרויקט</span> : (
                      <button type="button" className="danger icon-btn" aria-label="הסרה" onClick={() => patch({ actions: meeting.actions.filter((x) => x.id !== a.id) })}>✕</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="link" onClick={addManualAction}>+ משימה</button>
            <button type="button" className="primary" onClick={pushToProject} disabled={pending.length === 0}>
              {project ? `הוספת ${pending.length} משימות לפרויקט` : 'בחרו פרויקט כדי להוסיף משימות'}
            </button>
          </section>
        </>
      )}

      <div className="mt-foot">
        <button type="button" className="ghost" onClick={copy}>העתקת הסיכום לשליחה</button>
        <button type="button" className="danger" onClick={remove}>מחיקת הפגישה</button>
      </div>
    </>
  );
}

// ---------- רשימת פגישות ----------
export default function Meetings({ store }) {
  const { mid } = useParams();
  const list = useList(MEETINGS_KEY);
  const navigate = useNavigate();
  const [proj, setProj] = useState('all');
  const meeting = mid ? list.items.find((m) => m.id === mid) : null;
  if (mid) {
    return meeting ? <Editor key={mid} meeting={meeting} store={store} list={list} /> : <p className="pf-empty">הפגישה לא נמצאה. <Link to="/projectflow/meetings">חזרה לרשימה</Link></p>;
  }
  const items = [...list.items]
    .filter((m) => proj === 'all' || m.projectId === proj)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const name = (id) => store.projects.find((p) => p.id === id)?.name;
  const create = () => navigate(`/projectflow/meetings/${newMeeting(list, proj === 'all' ? '' : proj)}`);
  return (
    <>
      <div className="mt-bar">
        <button type="button" className="primary" onClick={create}>● פגישה חדשה</button>
        <select value={proj} onChange={(e) => setProj(e.target.value)} aria-label="סינון לפי פרויקט">
          <option value="all">כל הפרויקטים</option>
          {store.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {items.length === 0 ? (
        <p className="pf-empty">אין פגישות עדיין. הקליטו פגישה או כתבו נקודות, והמערכת תפיק סיכום ותציע משימות לפרויקט.</p>
      ) : (
        <div className="pf-list">
          {items.map((m) => {
            const openA = m.actions.filter((a) => !a.taskId).length;
            return (
              <Link key={m.id} to={`/projectflow/meetings/${m.id}`} className="card pf-item pf-link">
                <div className="pf-item-head">
                  <strong>{m.title || 'פגישה ללא נושא'}</strong>
                  <span className="muted">{m.date}</span>
                </div>
                <div className="pf-meta">
                  {name(m.projectId) && <span>{name(m.projectId)}</span>}
                  {m.attendees.length > 0 && <span>{m.attendees.length} משתתפים</span>}
                  {m.audioMs > 0 && <span>● הקלטה</span>}
                  <span>{m.actions.length} משימות{openA > 0 ? ` (${openA} טרם נוספו)` : ''}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

// כרטיס פגישות במסך הפרויקט.
export function ProjectMeetings({ project }) {
  const list = useList(MEETINGS_KEY);
  const navigate = useNavigate();
  const mine = list.items.filter((m) => m.projectId === project.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return (
    <section className="status-card ms-card" aria-label="פגישות הפרויקט">
      <div className="mt-bar">
        <h3 className="ms-title">פגישות</h3>
        <button type="button" className="ghost sm" onClick={() => navigate(`/projectflow/meetings/${newMeeting(list, project.id)}`)}>● פגישה חדשה</button>
      </div>
      {mine.length === 0 ? (
        <p className="muted">אין פגישות לפרויקט. הקלטה או הערות יהפכו לסיכום ולמשימות.</p>
      ) : (
        <ul className="ms-list">
          {mine.slice(0, 5).map((m) => (
            <li key={m.id}>
              <span className="ms-auto">•</span>
              <Link className="ms-name" to={`/projectflow/meetings/${m.id}`}>{m.title || 'פגישה ללא נושא'}</Link>
              <span className="ms-date">{m.date}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
