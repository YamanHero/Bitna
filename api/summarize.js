// פונקציית שרת: מסכמת פגישה ומפיקה החלטות ופעולות באמצעות Claude.
// נדרש משתנה סביבה ANTHROPIC_API_KEY. הגישה מותרת רק למשתמש מחובר (אימות מול Supabase).
const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ldhannsselufovtrkzwj.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY || 'sb_publishable_v-L3elAqIcRdxPmzFTx1dQ_SQijWTtE';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const API = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const MAX_CHARS = 60000;

const TOOL = {
  name: 'record_meeting',
  description: 'רושם את סיכום הפגישה, ההחלטות ופעולות ההמשך.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'סיכום תמציתי בעברית: 3 עד 7 נקודות, כל נקודה בשורה נפרדת שמתחילה ב"• ".' },
      decisions: { type: 'array', items: { type: 'string' }, description: 'החלטות שהתקבלו בפועל, משפט קצר לכל החלטה.' },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'המשימה, בניסוח פעולה קצר.' },
            owner: { type: 'string', description: 'שם האחראי כפי שנאמר בפגישה, או מחרוזת ריקה אם לא נקבע.' },
            due: { type: 'string', description: 'תאריך יעד בפורמט YYYY-MM-DD, או מחרוזת ריקה אם לא נאמר.' },
          },
          required: ['title', 'owner', 'due'],
        },
      },
    },
    required: ['summary', 'decisions', 'actions'],
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

export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (req.method === 'GET') return send(res, 200, { configured: Boolean(key), model: MODEL });
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!key) return send(res, 503, { code: 'no_key', error: 'שירות הבינה המלאכותית עוד לא הוגדר בשרת.' });
  if (!(await authorized(req))) return send(res, 401, { code: 'auth', error: 'צריך להתחבר כדי להשתמש בסיכום חכם.' });

  const b = await readBody(req);
  if (!b) return send(res, 400, { error: 'גוף הבקשה אינו תקין.' });
  const notes = String(b.notes || '').slice(0, MAX_CHARS);
  const transcript = String(b.transcript || '').slice(0, MAX_CHARS);
  if (!notes.trim() && !transcript.trim()) return send(res, 400, { error: 'אין טקסט לסיכום.' });
  const today = /^\d{4}-\d{2}-\d{2}$/.test(b.today || '') ? b.today : new Date().toISOString().slice(0, 10);

  const system = [
    'אתה מזכיר פגישות מקצועי בארגון ממשלתי. כתוב בעברית ברורה ומדויקת.',
    'המקור הוא הערות חופשיות ו/או תמלול אוטומטי שעלולות להכיל טעויות זיהוי דיבור. תקן טעויות ברורות, אבל אל תמציא עובדות, שמות, החלטות או תאריכים שלא נאמרו.',
    'החלטה היא רק דבר שהוסכם או הוכרע. דיון או הצעה פתוחה אינם החלטה.',
    'פעולה היא משימה מוגדרת שמישהו צריך לבצע. אם האחראי או המועד לא נאמרו, השאר ריק.',
    `התאריך היום ${today}. תרגם מועדים יחסיים ("עד יום חמישי", "בשבוע הבא") לתאריך מלא.`,
    'החזר את התוצאה רק באמצעות הכלי record_meeting.',
  ].join('\n');

  const user = [
    b.title && `נושא הפגישה: ${String(b.title).slice(0, 200)}`,
    b.project && `פרויקט: ${String(b.project).slice(0, 200)}`,
    Array.isArray(b.attendees) && b.attendees.length && `משתתפים: ${b.attendees.slice(0, 60).map(String).join('; ')}`,
    notes.trim() && `הערות:\n${notes}`,
    transcript.trim() && `תמלול:\n${transcript}`,
  ].filter(Boolean).join('\n\n');

  let r;
  try {
    r = await fetch(`${API}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: TOOL.name },
        messages: [{ role: 'user', content: user }],
      }),
    });
  } catch {
    return send(res, 502, { code: 'upstream', error: 'לא הצלחנו להגיע לשירות הבינה המלאכותית.' });
  }
  if (!r.ok) {
    const code = r.status === 401 || r.status === 403 ? 'bad_key' : r.status === 429 ? 'rate' : 'upstream';
    return send(res, 502, { code, error: code === 'bad_key' ? 'מפתח ה-API בשרת אינו תקין.' : code === 'rate' ? 'יותר מדי בקשות. נסו שוב עוד רגע.' : 'שירות הבינה המלאכותית החזיר שגיאה.' });
  }
  const data = await r.json();
  const block = (data.content || []).find((c) => c.type === 'tool_use' && c.name === TOOL.name);
  if (!block || !block.input) return send(res, 502, { code: 'format', error: 'התשובה לא הגיעה בפורמט הצפוי. נסו שוב.' });
  const out = block.input;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  return send(res, 200, {
    summary: String(out.summary || ''),
    decisions: (out.decisions || []).map(String).filter(Boolean).slice(0, 30),
    actions: (out.actions || [])
      .map((a) => ({ title: String(a.title || '').trim(), owner: String(a.owner || '').trim(), due: iso.test(a.due || '') ? a.due : '' }))
      .filter((a) => a.title)
      .slice(0, 40),
    model: data.model || MODEL,
  });
}
