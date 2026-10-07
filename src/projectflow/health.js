import { daysLeft, overdueStages, stagesOf, stageStatus } from './storage.js';
import { STATUSES, baseStatus, daysIn, statusOf } from './status.js';

const todayStr = () => new Date().toISOString().slice(0, 10);
export const dayDiff = (dateStr, today = todayStr()) =>
  Math.round((new Date(`${dateStr}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);

export const rel = (n) =>
  n === 0 ? 'היום' : n === 1 ? 'מחר' : n === -1 ? 'אתמול' : n > 0 ? `בעוד ${n} ימים` : `לפני ${-n} ימים`;

// אבני דרך: נגזרות אוטומטית ממועדי השלבים וממועד היעד, ובנוסף אבני דרך ידניות.
export function milestones(p) {
  const out = [];
  stagesOf(p).forEach((s) => {
    const due = p.stageMeta?.[s.id]?.due;
    if (due) out.push({ id: `s-${s.id}`, title: `סיום: ${s.title}`, date: due, kind: 'stage', done: stageStatus(p, s.id).complete });
  });
  if (p.targetDate) {
    const idx = STATUSES.findIndex((x) => x.id === baseStatus(p));
    out.push({ id: 'target', title: 'יעד הפעלה', date: p.targetDate, kind: 'target', done: idx >= STATUSES.findIndex((x) => x.id === 'golive') });
  }
  (p.milestones || []).forEach((m) => out.push({ ...m, kind: 'manual' }));
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export const nextMilestone = (p) => milestones(p).find((m) => !m.done) || null;

// צפי להגעה לעלייה לאוויר לפי משכי ברירת מחדל של הסטטוסים שנותרו (הערכה גסה, לא התחייבות).
export function forecast(p) {
  const idx = STATUSES.findIndex((x) => x.id === baseStatus(p));
  const end = STATUSES.findIndex((x) => x.id === 'test');
  if (idx < 0 || idx > end) return null;
  let days = Math.max(0, (STATUSES[idx].typical || 0) - daysIn(p));
  for (let i = idx + 1; i <= end; i += 1) days += STATUSES[i].typical || 0;
  const date = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const left = daysLeft(p);
  return { date, days, slip: left === null ? null : days - left };
}

export const LEVELS = { red: 3, amber: 2, green: 1, done: 0 };
export const LEVEL_LABEL = { red: 'חריג', amber: 'דורש מעקב', green: 'תקין', done: 'הסתיים' };

// בריאות הפרויקט (רמזור) והסיבות לה.
export function health(p, blockers = 0) {
  const s = statusOf(p);
  if (s === 'closed') return { level: 'done', reasons: [] };
  const today = todayStr();
  const reasons = [];
  const add = (level, text) => reasons.push({ level, text });
  const base = STATUSES.find((x) => x.id === baseStatus(p));
  const d = daysIn(p);
  const left = daysLeft(p);
  const idx = STATUSES.findIndex((x) => x.id === base?.id);
  const preLaunch = idx < STATUSES.findIndex((x) => x.id === 'golive');

  if (s === 'hold') add('amber', 'הפרויקט מושהה');
  if (preLaunch && left !== null && left < 0) add('red', `יעד ההפעלה עבר לפני ${-left} ימים`);
  const late = overdueStages(p, today).length;
  const lateMs = (p.milestones || []).filter((m) => !m.done && m.date < today).length;
  if (late + lateMs > 0) add('red', `${late + lateMs} מועדים שעברו`);
  if (blockers > 0) add('red', `${blockers} חסמים פתוחים`);
  if (base?.typical && s !== 'hold') {
    if (d > base.typical * 1.5) add('red', `${d} ימים ב"${base.label}" (רגיל: ${base.typical})`);
    else if (d > base.typical) add('amber', `${d} ימים ב"${base.label}" (רגיל: ${base.typical})`);
  }
  const f = forecast(p);
  if (f && f.slip !== null && left >= 0) {
    if (f.slip > 90) add('red', `לפי משכים רגילים, הצפי חורג מהיעד בכ-${f.slip} ימים`);
    else if (f.slip > 0) add('amber', `לפי משכים רגילים, הצפי חורג מהיעד בכ-${f.slip} ימים`);
  }
  const nm = nextMilestone(p);
  if (nm && nm.date >= today && dayDiff(nm.date, today) <= 7) add('amber', `${nm.title} ${rel(dayDiff(nm.date, today))}`);

  const level = reasons.reduce((m, r) => (LEVELS[r.level] > LEVELS[m] ? r.level : m), 'green');
  reasons.sort((a, b) => LEVELS[b.level] - LEVELS[a.level]);
  return { level, reasons };
}
