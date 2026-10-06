import { STAGES } from './stages.js';
import { currentStage, daysLeft, overallProgress, overdueStages, stageStatus } from './storage.js';
import { exposure, kindLabel } from './registers.js';
import { daysIn, statusInfo, statusOf } from './status.js';

// ידע מובנה לכל שלב: איך מבצעים אותו, ורעיונות לקידום. כללים קבועים, לא מודל שפה.
export const GUIDE = {
  needs: {
    how: [
      'כתבו בעמוד אחד מהי הבעיה, מי סובל ממנה ומה יקרה אם לא נטפל בה.',
      'רכזו את הדרישות עם הגורם הדורש, והפרידו בין "חובה" ל"רצוי".',
      'בקשו מהגורם הדורש חתימה על האפיון, כדי שלא ישתנה בשקט בהמשך.',
    ],
    ideas: ['קבעו פגישת אפיון אחת קצרה במקום סבב מיילים.', 'שאלו ספק אחד על שוק ועלויות, לפני שמקבעים תקציב.'],
  },
  budget: {
    how: [
      'פנו לגורם התקציבי עם הערכת עלות וטווח, לא עם מספר יחיד.',
      'בדקו מה ההליך המתאים: מכרז פומבי, מסגרת קיימת או פטור, ומה נדרש לכל אחד.',
      'השיגו אישור כתוב לפתיחת הליך לפני שמתחילים לכתוב מסמכים.',
    ],
    ideas: ['בדקו אם יש הסכם מסגרת קיים שחוסך מכרז.', 'הכינו שורה אחת על הצדקה כלכלית לשיחה עם התקציבאי.'],
  },
  tender_docs: {
    how: [
      'התחילו מתבנית של מכרז קודם דומה, ועדכנו רק מה שייחודי לפרויקט.',
      'כתבו תנאי סף שאפשר לבדוק במסמך (ולא "ניסיון רלוונטי" כללי).',
      'שלחו ליועץ המשפטי טיוטה כמעט סופית, עם רשימת נקודות שאתם חוששים מהן.',
    ],
    ideas: ['קבעו מועד סופי להערות, כדי שהסבבים לא יימשכו.', 'הכינו מראש טבלת ציון להערכה, כדי שהקריטריונים יהיו ברורים כבר במסמכים.'],
  },
  publication: {
    how: [
      'ודאו שכל האישורים נמצאים אצלכם לפני הפרסום.',
      'פרסמו, וקבעו מועדים: שאלות הבהרה, הגשה ופתיחת תיבה.',
      'שלחו הודעה לספקים הרלוונטיים כדי להגדיל את מספר ההצעות.',
    ],
    ideas: ['תנו זמן סביר להכנת הצעה, כדי למנוע בקשות הארכה.'],
  },
  clarifications: {
    how: [
      'אספו את כל השאלות במקום אחד ועברו עליהן עם המקצוע והמשפטי.',
      'פרסמו תשובות לכולם, לא רק למי ששאל.',
      'אם התשובה משנה את המכרז, פרסמו תיקון ובדקו אם צריך להאריך מועד.',
    ],
    ideas: ['הכינו מראש תשובות לשאלות החוזרות ממכרזים קודמים.'],
  },
  bids: {
    how: ['רשמו כל הצעה שהתקבלה, עם שעה.', 'פתחו את ההצעות בנוכחות הוועדה ורשמו פרוטוקול.', 'בדקו עמידה בתנאי הסף לפני שמעריכים איכות.'],
    ideas: ['אם התקבלה הצעה אחת בלבד, בדקו מוקדם איך מתקדמים לפני שהזמן נגמר.'],
  },
  evaluation: {
    how: [
      'חלקו את ההצעות בין חברי הוועדה, וציינו ציון לכל קריטריון לפי הטבלה שנקבעה.',
      'אספו את הציונים בפגישה אחת, ורשמו נימוק קצר לכל פער גדול.',
      'סכמו מסקנה והמלצה בכתב, כולל מה נבדק ומה לא.',
    ],
    ideas: ['בקשו הבהרות מספקים קרובים בציון, לפני ההכרעה.'],
  },
  approval: {
    how: ['הכינו מסמך החלטה קצר: ההמלצה, הציונים והעלות.', 'העבירו לאישור הגורמים הנדרשים בסדר הנכון.', 'הודיעו לזוכה ולמשתתפים, ושמרו את מועד ההודעה.'],
    ideas: ['שלחו מסמך החלטה מוכן במקום תיאור בעל פה, כדי לקצר את האישור.'],
  },
  contract: {
    how: ['העבירו לספק את החוזה לחתימה עם הנספחים כפי שפורסמו.', 'בדקו ערבויות וביטוחים לפני החתימה.', 'קבעו בחוזה אבני דרך ותשלומים לפי קבלה.'],
    ideas: ['קבעו פגישת פתיחה עם הספק מיד אחרי החתימה.'],
  },
  delivery: {
    how: ['קבעו מפגש סטטוס קבוע (שבועי) עם הספק.', 'עקבו אחרי אבני הדרך מול הלוח, וסמנו חריגות מיד.', 'תעדו כל שינוי בבקשת שינוי, ולא בשיחה.'],
    ideas: ['בקשו מהספק דוח קצר לפני כל פגישה.', 'פתחו רשימת סיכונים משותפת עם הספק.'],
  },
  acceptance: {
    how: ['בדקו כל תוצר מול הדרישות שנחתמו באפיון.', 'רשמו הערות ובקשו תיקון בכתב עם מועד.', 'שחררו תשלום רק אחרי קבלה חתומה.'],
    ideas: ['הכינו תסריטי בדיקה מראש יחד עם המשתמשים.'],
  },
  closure: {
    how: ['עברו על כל המשימות והתשלומים וודאו שאין פתוחים.', 'כתבו סיכום קצר: מה עבד ומה לא.', 'העבירו את התיעוד לגורם שמתחזק את המערכת.'],
    ideas: ['שמרו את הלקחים כדי להשתמש בהם בפרויקט הבא.'],
  },
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const diffDays = (a, b) => Math.round((new Date(`${a}T00:00:00`) - new Date(`${b}T00:00:00`)) / 86400000);

// ניתוח פרויקט אחד: מה מתעכב, מה הצעד הבא, איך עושים ורעיונות.
export function analyze(project, { risks = [], changes = [], payments = [] } = {}, today = todayStr()) {
  const stage = currentStage(project);
  const delays = [];

  for (const s of overdueStages(project, today)) {
    const due = project.stageMeta[s.id].due;
    const st = stageStatus(project, s.id);
    delays.push({
      level: 'high',
      text: `השלב "${s.title}" באיחור של ${diffDays(today, due)} ימים (נותרו ${st.total - st.done} משימות).`,
    });
  }

  const d = daysLeft(project, new Date(`${today}T12:00:00`));
  if (d !== null && overallProgress(project) < 100) {
    if (d < 0) delays.push({ level: 'high', text: `יעד ההפעלה עבר לפני ${-d} ימים.` });
    else if (d <= 30) delays.push({ level: 'mid', text: `נותרו ${d} ימים ליעד ההפעלה, והתקדמות כוללת של ${overallProgress(project)}%.` });
  }

  for (const r of risks.filter((x) => x.projectId === project.id && x.status === 'open')) {
    if (r.kind === 'blocker' || exposure(r) >= 6) {
      delays.push({ level: r.kind === 'blocker' ? 'high' : 'mid', text: `${kindLabel(r.kind)} פתוח: ${r.title}${r.owner ? ` (אחראי: ${r.owner})` : ''}.` });
    }
  }

  const st = statusOf(project);
  const info = statusInfo(st);
  const inDays = daysIn(project);
  if (st === 'hold') {
    delays.push({ level: 'mid', text: `הפרויקט מושהה כבר ${inDays} ימים.` });
  } else if (info.typical && inDays > info.typical) {
    delays.push({
      level: 'mid',
      text: `הפרויקט בסטטוס "${info.label}" כבר ${inDays} ימים, יותר מהרגיל (בדרך כלל עד ${info.typical}).`,
    });
  }

  const openCr = changes.filter((c) => c.projectId === project.id && c.status === 'open').length;
  if (openCr > 0) delays.push({ level: 'mid', text: `${openCr} בקשות שינוי ממתינות להחלטה.` });

  const missingDue = stage && !project.stageMeta?.[stage.id]?.due;
  if (missingDue) delays.push({ level: 'low', text: `לשלב הנוכחי "${stage.title}" לא הוגדר תאריך יעד.` });

  const order = { high: 0, mid: 1, low: 2 };
  delays.sort((a, b) => order[a.level] - order[b.level]);

  const task = stage ? project.tasks.find((t) => t.stage === stage.id && !t.done) : null;
  const upcoming = stage ? project.tasks.filter((t) => t.stage === stage.id && !t.done).slice(1, 4) : [];
  const guide = stage ? GUIDE[stage.id] : null;

  return { stage, delays, task, upcoming, how: guide?.how || [], ideas: guide?.ideas || [], pct: overallProgress(project) };
}

// סיכום לטקסט שאפשר להעתיק להודעה או למייל.
export function summaryText(project, a) {
  const lines = [`מצב פרויקט: ${project.name}`, `התקדמות: ${a.pct}%`];
  lines.push(a.stage ? `שלב נוכחי: ${a.stage.title}` : 'הפרויקט הושלם');
  if (a.delays.length) {
    lines.push('מתעכב:');
    a.delays.forEach((x) => lines.push(`- ${x.text}`));
  } else lines.push('אין עיכובים בולטים.');
  if (a.task) lines.push(`הצעד הבא: ${a.task.title}`);
  return lines.join('\n');
}

export { STAGES };
