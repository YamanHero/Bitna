import { uid } from './storage.js';

// ---------- אחסון הקלטות: IndexedDB במכשיר בלבד (לא מסונכרן לענן) ----------
const DB = 'pfaudio';
const open = () =>
  new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('a');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction('a', mode);
    const req = fn(t.objectStore('a'));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
};
export const saveAudio = (id, blob) => tx('readwrite', (s) => s.put(blob, id));
export const getAudio = (id) => tx('readonly', (s) => s.get(id));
export const deleteAudio = (id) => tx('readwrite', (s) => s.delete(id));

// ---------- חילוץ פעולות, החלטות וסיכום מטקסט חופשי ----------
const DAYS = { ראשון: 0, שני: 1, שלישי: 2, רביעי: 3, חמישי: 4, שישי: 5, שבת: 6 };
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const plus = (n, from = new Date()) => {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return d;
};

export function parseDue(text, from = new Date()) {
  let m = text.match(/עד\s+(?:יום\s+)?(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת)/);
  if (m) {
    const diff = ((DAYS[m[1]] - from.getDay() + 7) % 7) || 7;
    return iso(plus(diff, from));
  }
  m = text.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (m) {
    const day = +m[1];
    const mon = +m[2];
    if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12) {
      let y = m[3] ? +m[3] : from.getFullYear();
      if (y < 100) y += 2000;
      const d = new Date(y, mon - 1, day);
      if (!m[3] && d < plus(-1, from)) d.setFullYear(y + 1);
      return iso(d);
    }
  }
  if (/עד סוף (ה)?שבוע/.test(text)) return iso(plus(((4 - from.getDay() + 7) % 7) || 7, from));
  m = text.match(/בעוד\s+(\d+)\s+(ימים|יום|שבועות|שבוע)/);
  if (m) return iso(plus(+m[1] * (m[2].startsWith('שבוע') ? 7 : 1), from));
  if (/בשבוע הבא/.test(text)) return iso(plus(7, from));
  if (/מחר/.test(text)) return iso(plus(1, from));
  return '';
}

const ACTION_PREFIX = /^\s*[-•*]?\s*(?:משימה|פעולה|לביצוע|action|todo)\s*[:\-–]\s*(.+)$/i;
const DECISION_PREFIX = /^\s*[-•*]?\s*(?:החלטה|הוחלט|סוכם)\s*[:\-–]\s*(.+)$/i;
const ACTION_CUE = /(צריך ל|צריכה ל|צריכים ל|נדרש ל|יש ל[א-ת]|ניקח על עצמ|אני (?:אשלח|אכין|אבדוק|אעדכן|אטפל|אתאם)|נשלח|נכין|נבדוק|נסגור|נעדכן|נתאם|נטפל|לבצע|לשלוח|להכין|לבדוק|לסגור|לעדכן|לתאם|לקבוע|להעביר|לפרסם|לטפל)/;
const DECISION_CUE = /(הוחלט|החלטנו|סוכם|הוסכם|מאשרים|אושר|נאשר)/;

const splitSentences = (text) =>
  text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

const clean = (s) => s.replace(/^[-•*\s]+/, '').replace(/\s+/g, ' ').trim();

// חברי צוות שמוזכרים במשפט, לשיוך אחראי.
function ownerIn(sentence, team) {
  const hit = team.find((m) => m.name && sentence.includes(m.name.split(' ')[0]));
  return hit ? hit.id : '';
}

export function extract({ title = '', notes = '', transcript = '', attendees = [], team = [] }, from = new Date()) {
  const actions = [];
  const decisions = [];
  const rest = [];
  const seen = new Set();
  const push = (list, item, key) => {
    if (seen.has(key)) return;
    seen.add(key);
    list.push(item);
  };
  const lines = [...splitSentences(notes).map((s) => ({ s, explicit: true })), ...splitSentences(transcript).map((s) => ({ s, explicit: false }))];
  for (const { s } of lines) {
    let m = s.match(ACTION_PREFIX);
    if (m) {
      const t = clean(m[1]);
      push(actions, { id: uid(), title: t, owner: ownerIn(t, team), due: parseDue(t, from), suggested: false }, `a:${t}`);
      continue;
    }
    m = s.match(DECISION_PREFIX);
    if (m) {
      const t = clean(m[1]);
      push(decisions, { id: uid(), text: t }, `d:${t}`);
      continue;
    }
    if (DECISION_CUE.test(s)) {
      const t = clean(s);
      push(decisions, { id: uid(), text: t }, `d:${t}`);
    } else if (ACTION_CUE.test(s) && s.length < 220) {
      const t = clean(s);
      push(actions, { id: uid(), title: t, owner: ownerIn(t, team), due: parseDue(t, from), suggested: true }, `a:${t}`);
    } else {
      rest.push(clean(s));
    }
  }
  // נקודות עיקריות: משפטים באורך סביר, עד שבעה, לפי סדר ההופעה.
  const good = rest.filter((s) => s.length >= 25 && s.length <= 220);
  const chosen = good.length > 7 ? [...good].sort((a, b) => b.length - a.length).slice(0, 7) : good;
  const points = rest.filter((s) => chosen.includes(s));
  const head = [title && `נושא: ${title}`, attendees.length && `משתתפים: ${attendees.join(', ')}`].filter(Boolean).join('\n');
  const summary = [head, points.length ? `נקודות עיקריות:\n${points.map((p) => `• ${p}`).join('\n')}` : ''].filter(Boolean).join('\n\n');
  return { summary, decisions, actions };
}

// טקסט לשליחה למשתתפים.
export function summaryText(m, ownerName = () => '') {
  const out = [m.title, m.date && `תאריך: ${m.date}`, m.summary].filter(Boolean);
  if (m.decisions?.length) out.push(`החלטות:\n${m.decisions.map((d) => `• ${d.text}`).join('\n')}`);
  if (m.actions?.length) {
    out.push(
      `משימות להמשך:\n${m.actions
        .map((a) => `• ${a.title}${ownerName(a.owner) ? ` | אחראי: ${ownerName(a.owner)}` : ''}${a.due ? ` | יעד: ${a.due}` : ''}`)
        .join('\n')}`
    );
  }
  return out.join('\n\n');
}
