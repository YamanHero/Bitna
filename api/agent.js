// פונקציית שרת: הסוכן Elections Project Manager 360.
// מקבל שאלה ותמונת מצב של הנתונים מהאפליקציה, ומחזיר תשובה והצעות (משימות, סיכונים, החלטות) לאישור המשתמש.
// הסוכן לא כותב לנתונים בעצמו: כל הצעה נכנסת לאפליקציה רק אחרי לחיצה של המשתמש.
// נדרש משתנה סביבה ANTHROPIC_API_KEY. הגישה מותרת רק למשתמש מחובר (אימות מול Supabase).
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ldhannsselufovtrkzwj.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_v-L3elAqIcRdxPmzFTx1dQ_SQijWTtE';
const MODEL = process.env.ANTHROPIC_AGENT_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const API = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const MAX_CONTEXT = 120000;
const MAX_TURNS = 20;

const PROFILE = `אתה Elections Project Manager 360, סוכן AI לניהול פרויקטים טכנולוגיים במגזר הציבורי, בדגש על מערכות מידע לניהול בחירות ברשויות המקומיות. אתה משולב בתוך מערכת "מגדל בקרה" (ProjectFlow) של מינהל הבחירות.

תפקידך: מנהל פרויקטים בכיר, PMO אסטרטגי, מנתח מערכות עסקי ויועץ לניהול ספקים (PMBOK, Agile, ניהול סיכונים, ניהול דרישות, ממשל נתונים וניהול התקשרויות). אתה סוכן ניהולי יוזם: מזהה פערים, מציף סיכונים, מתאם תלויות, מציע פעולות ומסייע למנהל לקבל החלטות מבוססות מידע.

עקרונות מחייבים:
1. מקור אמת אחד: הנתונים שבהודעה (תמונת המצב מהמערכת) הם מקור האמת. אל תניח עובדות שאינן בהם.
2. הפרדה בין עובדה להצעה: סמן כל קביעה כ"מאושר" (מופיע בנתונים כמאושר/בוצע), "מתועד אך לא מאושר", "הצעה" או "הנחה הדורשת אימות".
3. אחריות ברורה: לכל משימה תוצר, אחראי, מועד, קריטריון השלמה וסטטוס. פרט חסר מסמנים כ"חסר" ולא ממציאים.
4. ניהול לפי חריגים: התמקד בחסמים, איחורים, תלויות קריטיות והחלטות ממתינות.
5. שקיפות ועקיבות: ציין על אילו רשומות התבססת.
6. יוזמה ללא חריגה מסמכות: אתה מציע בלבד. אינך מאשר החלטות, משנה התחייבויות חוזיות או שולח הודעות. לעולם אל תציג המלצה כהחלטה שהתקבלה ואל תציג פעולה מוצעת כאילו בוצעה.
7. ניהול ציבורי: התחשב בדין, אבטחת מידע, פרטיות, תקציב, רכש, התקשרויות ואחריותיות ציבורית.
8. אין לבקש, לעבד או לשמור מידע אישי של בוחרים. מערכת ניהול הפרויקטים נפרדת ממערכות הבחירות.

מודולים שאתה תומך בהם: ייזום ופגישת התנעה (Project Charter, סדר יום, שאלות להכרעה, תוכנית 14 יום); תכנון וביצוע (WBS, אבני דרך, תלויות, נתיב קריטי, השפעת עיכובים); ניהול דרישות (Epics, User Stories, קריטריוני קבלה, UAT, אינטגרציה, עומסים, אבטחה); ניהול ספקים (התחייבויות, תוצרים, חריגות, דף הכנה לפגישת סטטוס); החלטות וסיכונים (Decision Log, Risk Register); דיווח (דוח יומי וסקירה שבועית).

פרויקט מרכזי: "Elections Command 360 | האלפון הדיגיטלי" – שלושה מסלולים: (1) אלפון תפעולי דיגיטלי: זיהוי בוחרים, בדיקת זכאות בקלפי, תיעוד הגעה, סימון הצבעה, מניעת הצבעה כפולה, חריגים, עבודה ללא תקשורת וסנכרון מבוקר; (2) מסירת פנקסים: גזירת נתוני פנקס, הרשאות, ממשקי העברה, תיעוד ובקרת מסירה לגורמים זכאים; (3) תוצרי דפוס: אלפונים, זהותונים, הודעות לבוחר ותוצרי גיבוי תפעולי. מסמכי המקור: "אלפון דיגיטלי – דרישות עסקיות" (מקור מרכזי), "קלפי דיגיטלית – תיאור הפתרון, 21.08.2022" ו"קלפי דיגיטלית – תיאור תהליך" (ייחוס). אם יש סתירה בין המסמכים, הצג אותה לבירור ואל תכריע. אם המשתמש לא צירף את תוכן המסמכים, אמור שאינך רואה אותם ואל תצטט מהם.

סדר עבודה בפרויקט חדש: קליטת מסמכים ← ניתוח דרישות ← זיהוי פערים ← הכנת התנעה ← אישור תכולה ← WBS ← אחריות ← לוח זמנים ← ביצוע ומעקב ← בקרת איכות ← מסירה והפקת לקחים.

סגנון תשובה: עברית מקצועית, ברורה ותמציתית, בלי ז'רגון מיותר. כשנשאלת על מצב, פתח בתמונת מצב קצרה, החלטות פתוחות ו-3 עד 5 הפעולות החשובות ביותר. השתמש בכותרות קצרות ובתבליטים. אל תקבע מועדים או אחראים ללא בסיס בנתונים; אם צריך, הצע אותם במפורש כהצעה.

כשמתאים להוסיף למערכת משימות, סיכונים או החלטות הממתינות להכרעה – השתמש בכלי propose_items. הפריטים יוצגו למשתמש כהצעות, והוא יחליט אם להוסיף. אל תציע פריטים שכבר קיימים בנתונים. השאר שדות ריקים כשאין להם בסיס.`;

const TOOL = {
  name: 'propose_items',
  description: 'מציע פריטים להוספה למערכת. המשתמש יאשר כל פריט בנפרד; שום דבר לא נשמר בלי אישורו.',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['task', 'risk', 'decision'], description: 'task = משימה בפרויקט; risk = סיכון/בעיה/חסם; decision = החלטה הממתינה להכרעה.' },
            projectId: { type: 'string', description: 'מזהה הפרויקט מתוך הנתונים.' },
            stageId: { type: 'string', description: 'למשימה: מזהה השלב/קבוצת העבודה מתוך הנתונים.' },
            title: { type: 'string', description: 'כותרת קצרה בניסוח פעולה.' },
            details: { type: 'string', description: 'תיאור, תוצר נדרש או קריטריון קבלה; לסיכון – פעולת מניעה; להחלטה – החלופות וההשפעה.' },
            kind: { type: 'string', enum: ['risk', 'issue', 'blocker'], description: 'לסיכון בלבד.' },
            probability: { type: 'integer', minimum: 1, maximum: 3, description: 'לסיכון: 1 נמוכה, 2 בינונית, 3 גבוהה.' },
            severity: { type: 'integer', minimum: 1, maximum: 3, description: 'לסיכון: 1 נמוכה, 2 בינונית, 3 גבוהה.' },
            due: { type: 'string', description: 'YYYY-MM-DD רק אם יש לכך בסיס בנתונים או בבקשה; אחרת ריק.' },
            reason: { type: 'string', description: 'למה מוצע, במשפט אחד.' },
          },
          required: ['type', 'projectId', 'title'],
        },
      },
    },
    required: ['items'],
  },
};

const send = (res, code, body) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return null;
  }
}

async function authorized(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
    return r.ok;
  } catch {
    return false;
  }
}

const str = (v, n) => String(v ?? '').slice(0, n);

export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (req.method === 'GET') return send(res, 200, { configured: Boolean(key), model: MODEL });
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!key) return send(res, 503, { code: 'no_key', error: 'הסוכן עוד לא הוגדר בשרת (חסר מפתח ANTHROPIC_API_KEY ב-Vercel).' });
  if (!(await authorized(req))) return send(res, 401, { code: 'auth', error: 'צריך להתחבר כדי להשתמש בסוכן.' });

  const b = await readBody(req);
  if (!b) return send(res, 400, { error: 'גוף הבקשה אינו תקין.' });
  const turns = (Array.isArray(b.messages) ? b.messages : [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: str(m.content, 20000) }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') return send(res, 400, { error: 'אין שאלה.' });

  const today = /^\d{4}-\d{2}-\d{2}$/.test(b.today || '') ? b.today : new Date().toISOString().slice(0, 10);
  const context = str(JSON.stringify(b.context || {}), MAX_CONTEXT);
  const docs = str(b.documents, 60000);

  const system = [
    { type: 'text', text: PROFILE },
    {
      type: 'text',
      text: [
        `התאריך היום ${today}.`,
        b.focusProjectId && `הפרויקט שבמוקד השיחה: ${str(b.focusProjectId, 40)}.`,
        'תמונת המצב העדכנית מהמערכת (JSON). זה המידע היחיד שידוע לך על הפרויקטים:',
        context,
        docs && `\nמסמכים שהמשתמש צירף לשיחה:\n${docs}`,
      ].filter(Boolean).join('\n'),
    },
  ];

  let r;
  try {
    r = await fetch(`${API}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 6000, system, tools: [TOOL], messages: turns }),
    });
  } catch {
    return send(res, 502, { code: 'upstream', error: 'לא הצלחנו להגיע לשירות הבינה המלאכותית.' });
  }
  if (!r.ok) {
    const code = r.status === 401 || r.status === 403 ? 'bad_key' : r.status === 429 ? 'rate' : 'upstream';
    return send(res, 502, { code, error: code === 'bad_key' ? 'מפתח ה-API בשרת אינו תקין.' : code === 'rate' ? 'יותר מדי בקשות. נסו שוב עוד רגע.' : 'שירות הבינה המלאכותית החזיר שגיאה.' });
  }
  const data = await r.json();
  const blocks = data.content || [];
  const text = blocks.filter((c) => c.type === 'text').map((c) => c.text).join('\n\n').trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const proposals = blocks
    .filter((c) => c.type === 'tool_use' && c.name === TOOL.name)
    .flatMap((c) => c.input?.items || [])
    .filter((x) => ['task', 'risk', 'decision'].includes(x.type) && String(x.title || '').trim())
    .slice(0, 40)
    .map((x) => ({
      type: x.type,
      projectId: str(x.projectId, 40),
      stageId: str(x.stageId, 40),
      title: str(x.title, 300).trim(),
      details: str(x.details, 2000),
      kind: ['risk', 'issue', 'blocker'].includes(x.kind) ? x.kind : 'risk',
      probability: [1, 2, 3].includes(x.probability) ? x.probability : 2,
      severity: [1, 2, 3].includes(x.severity) ? x.severity : 2,
      due: iso.test(x.due || '') ? x.due : '',
      reason: str(x.reason, 400),
    }));
  return send(res, 200, {
    text: text || (proposals.length ? 'הכנתי הצעות לפריטים חדשים. עברו עליהן ואשרו את מה שמתאים.' : ''),
    proposals,
    model: data.model || MODEL,
  });
}
