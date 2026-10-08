import { currentStage } from './storage.js';

// סטטוס הפרויקט: איפה הוא נמצא עכשיו במסלול, בניסוח שכולם מבינים.
// תקופות "בדרך כלל" משמשות לאזהרה כשפרויקט שוהה בסטטוס זמן ארוך מהרגיל.
export const STATUSES = [
  { id: 'prep', label: 'הכנה ותקצוב', hint: 'הגדרת צורך, תקציב ואישורים', typical: 45 },
  { id: 'tender', label: 'במכרז', hint: 'כתיבת מסמכים, פרסום, הבהרות וקבלת הצעות', typical: 75 },
  { id: 'selection', label: 'בחירת ספק', hint: 'הערכת הצעות והחלטה', typical: 30 },
  { id: 'contract', label: 'התקשרות', hint: 'חתימה על חוזה והזמנה', typical: 30 },
  { id: 'spec', label: 'אפיון', hint: 'אפיון מפורט עם הספק', typical: 45 },
  { id: 'dev', label: 'פיתוח וביצוע', hint: 'הספק בונה ומספק', typical: 120 },
  { id: 'test', label: 'בדיקות וקבלה', hint: 'בדיקות קבלה, תיקונים ותשלום', typical: 30 },
  { id: 'golive', label: 'עלייה לאוויר', hint: 'הפעלה והטמעה', typical: 14 },
  { id: 'warranty', label: 'אחריות ותמיכה', hint: 'תקופת אחריות ותחזוקה', typical: 365 },
  { id: 'closed', label: 'סגור', hint: 'הפרויקט הסתיים', typical: null },
];
export const HOLD = { id: 'hold', label: 'מושהה', hint: 'הפרויקט הוקפא זמנית' };

// שלבי-על של הלוח (לצבעים ולקיבוץ).
export const STATUS_PHASE = {
  prep: 'prep',
  tender: 'tender',
  selection: 'tender',
  contract: 'tender',
  spec: 'build',
  dev: 'build',
  test: 'launch',
  golive: 'launch',
  warranty: 'end',
  closed: 'end',
};

export const statusInfo = (id) => (id === 'hold' ? HOLD : STATUSES.find((s) => s.id === id) || STATUSES[0]);

// פרויקטים ישנים בלי סטטוס שמור: מחשבים מהשלב הנוכחי ברשימת המשימות.
const FROM_STAGE = {
  needs: 'prep', budget: 'prep', tender_docs: 'prep',
  publication: 'tender', clarifications: 'tender', bids: 'tender',
  evaluation: 'selection', approval: 'selection',
  contract: 'contract', delivery: 'dev', acceptance: 'test', closure: 'closed',
};

export function statusOf(project) {
  if (project.status) return project.status;
  const stage = currentStage(project);
  if (!stage) return project.tasks.length ? 'closed' : 'prep';
  return FROM_STAGE[stage.id] || 'prep';
}

// הסטטוס "האמיתי" גם כשהפרויקט מושהה (לצבע ולמיקום בלוח).
export const baseStatus = (project) => {
  const s = statusOf(project);
  return s === 'hold' ? project.prevStatus || 'prep' : s;
};

export const log = (project) =>
  project.statusLog && project.statusLog.length
    ? project.statusLog
    : [{ status: statusOf(project), at: project.createdAt || new Date().toISOString() }];

export const since = (project) => new Date(log(project)[log(project).length - 1].at);

export function changeStatus(project, next, at = new Date().toISOString()) {
  const cur = statusOf(project);
  if (cur === next) return project;
  return {
    ...project,
    status: next,
    prevStatus: next === 'hold' ? (cur === 'hold' ? project.prevStatus : cur) : project.prevStatus,
    statusLog: [...log(project), { status: next, at }],
  };
}

// הקפאה והמשך: חוזרים לסטטוס שהיה לפני ההקפאה.
export const resume = (project) => changeStatus(project, project.prevStatus || 'prep');

// שינוי תאריך ההתחלה של הסטטוס הנוכחי (למי שעדכן באיחור).
export function setSince(project, dateStr) {
  const l = [...log(project)];
  l[l.length - 1] = { ...l[l.length - 1], at: new Date(`${dateStr}T08:00:00`).toISOString() };
  return { ...project, statusLog: l, status: project.status || statusOf(project) };
}

export const MS = { min: 60000, hour: 3600000, day: 86400000 };

export function parts(ms) {
  const t = Math.max(0, ms);
  const d = Math.floor(t / MS.day);
  const h = Math.floor((t % MS.day) / MS.hour);
  const m = Math.floor((t % MS.hour) / MS.min);
  const s = Math.floor((t % MS.min) / 1000);
  return { d, h, m, s };
}

const two = (n) => String(n).padStart(2, '0');

// תצוגת סטופר: "12 ימים 04:33:21".
export function stopwatch(ms) {
  const { d, h, m, s } = parts(ms);
  const days = d === 1 ? 'יום' : `${d} ימים`;
  return `${d > 0 ? `${days} ` : ''}${two(h)}:${two(m)}:${two(s)}`;
}

// תצוגה קצרה לרשימות: "12 ימים" או "5 שעות".
export function short(ms) {
  const { d, h, m } = parts(ms);
  if (d >= 1) return d === 1 ? 'יום אחד' : `${d} ימים`;
  if (h >= 1) return h === 1 ? 'שעה' : `${h} שעות`;
  return m <= 1 ? 'דקה' : `${m} דקות`;
}

// משך שהייה בכל סטטוס לפי היומן, כולל הנוכחי עד עכשיו.
export function history(project, now = Date.now()) {
  const l = log(project);
  return l.map((e, i) => {
    const start = new Date(e.at).getTime();
    const end = i + 1 < l.length ? new Date(l[i + 1].at).getTime() : now;
    return { status: e.status, at: e.at, ms: Math.max(0, end - start), current: i === l.length - 1 };
  });
}

export const daysIn = (project, now = Date.now()) => Math.floor((now - since(project).getTime()) / MS.day);

// השלבים (מהקטלוג הסטנדרטי) שרלוונטיים לכל סטטוס. שלבים אישיים מוצגים תמיד.
export const STATUS_STAGES = {
  prep: ['needs', 'budget', 'tender_docs'],
  tender: ['publication', 'clarifications', 'bids'],
  selection: ['evaluation', 'approval'],
  contract: ['contract'],
  spec: ['delivery'],
  dev: ['delivery'],
  test: ['acceptance'],
  golive: ['acceptance', 'closure'],
  warranty: ['closure'],
  closed: ['closure'],
};

export const relevantStageIds = (project) => STATUS_STAGES[baseStatus(project)] || [];
