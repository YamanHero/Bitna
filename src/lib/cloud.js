// סנכרון ל-Supabase בלי ספריות נוספות: התחברות (Auth) ושמירת רשומות (REST).
// העותק המקומי ב-localStorage הוא תמיד עותק העבודה, והענן הוא הגיבוי והסנכרון בין מכשירים.
// המפתח כאן הוא מפתח ציבורי (publishable) שנועד לדפדפן. ההגנה על הנתונים היא RLS בטבלה pf_records.

const env = import.meta.env || {};
const SUPABASE_URL = (env.VITE_SUPABASE_URL || 'https://ldhannsselufovtrkzwj.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = env.VITE_SUPABASE_KEY || 'sb_publishable_v-L3elAqIcRdxPmzFTx1dQ_SQijWTtE';

// מפתחות שאינם מתחילים ב-"projectflow." כדי שלא ייכנסו לקובץ הגיבוי.
const SESSION_KEY = 'pfauth.session';
const SKIP_KEY = 'pfauth.skip';
const DIRTY_KEY = 'pfsync.dirty';
const LINKED_KEY = 'pfsync.linked';

export const COLLECTIONS = [
  { key: 'projectflow.v1', kind: 'project' },
  { key: 'projectflow.risks.v1', kind: 'risk' },
  { key: 'projectflow.decisions.v1', kind: 'decision' },
  { key: 'projectflow.changes.v1', kind: 'change' },
  { key: 'projectflow.payments.v1', kind: 'payment' },
  { key: 'projectflow.team.v1', kind: 'member' },
  { key: 'projectflow.meetings.v1', kind: 'meeting' },
  { key: 'projectflow.topics.v1', kind: 'topic' },
];

export class CloudError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// ---------- מצב וניוזלטר ----------

// phase: signedout | local | saving | saved | error
let state = { phase: 'signedout', email: null, lastSaved: null, error: null };
const listeners = new Set();

export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const getState = () => state;

function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

const lsGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* שמירה מקומית לא זמינה */
  }
};
const lsDel = (k) => {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
};

function readList(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ---------- Auth ----------

let session = null;
try {
  session = JSON.parse(lsGet(SESSION_KEY));
} catch {
  session = null;
}

function writeSession(s) {
  session = s;
  if (s) lsSet(SESSION_KEY, JSON.stringify(s));
  else lsDel(SESSION_KEY);
}

function toSession(res) {
  return {
    access_token: res.access_token,
    refresh_token: res.refresh_token,
    expires_at: res.expires_at || Math.floor(Date.now() / 1000) + (res.expires_in || 3600),
    user: { id: res.user.id, email: res.user.email },
  };
}

const HE_ERRORS = [
  [/invalid login credentials/i, 'האימייל או הסיסמה שגויים.'],
  [/email not confirmed/i, 'צריך לאשר את האימייל. פתחו את המייל שנשלח אליכם ולחצו על הקישור.'],
  [/already registered|already been registered/i, 'כבר קיים חשבון עם האימייל הזה. עברו לכניסה.'],
  [/password should be at least|weak password|password is known/i, 'הסיסמה חלשה מדי. בחרו סיסמה של 8 תווים לפחות.'],
  [/valid email|invalid email|unable to validate email/i, 'כתובת האימייל אינה תקינה.'],
  [/rate limit|too many/i, 'בוצעו יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.'],
  [/signups? (are )?(not allowed|disabled)/i, 'הרשמה חדשה חסומה כרגע.'],
];

function friendly(message) {
  const hit = HE_ERRORS.find(([re]) => re.test(message || ''));
  return hit ? hit[1] : 'הפעולה נכשלה. בדקו את החיבור לאינטרנט ונסו שוב.';
}

async function authCall(path, body, token) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body || {}),
    });
  } catch {
    throw new CloudError('אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.', 'network');
  }
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  if (!res.ok) {
    const raw = json.error_description || json.msg || json.message || json.error || '';
    throw new CloudError(friendly(raw), json.error_code || json.code || res.status);
  }
  return json;
}

let refreshing = null;
async function getToken() {
  if (!session) return null;
  if (session.expires_at - Math.floor(Date.now() / 1000) > 60) return session.access_token;
  if (!refreshing) {
    refreshing = authCall('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
      .then((res) => {
        writeSession(toSession(res));
        return session.access_token;
      })
      .catch((e) => {
        if (e.code === 'network') throw e;
        writeSession(null);
        set({ phase: 'signedout', email: null });
        return null;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

// ---------- REST ----------

async function rest(path, { method = 'GET', body, headers = {} } = {}) {
  const token = await getToken();
  if (!token) throw new CloudError('לא מחובר', 'auth');
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new CloudError('אין חיבור לשרת', 'network');
  }
  const text = await res.text();
  if (!res.ok) throw new CloudError(text.slice(0, 200) || `שגיאה ${res.status}`, res.status);
  return text ? JSON.parse(text) : null;
}

// ---------- סנכרון ----------

let version = 0;
let timer = null;
let pushing = false;
let queued = false;
const remoteIds = {};
const lastPushed = {};
COLLECTIONS.forEach(({ kind }) => {
  remoteIds[kind] = new Set();
  lastPushed[kind] = new Map();
});

const isDirty = () => lsGet(DIRTY_KEY) === '1';

export function markDirty() {
  version += 1;
  lsSet(DIRTY_KEY, '1');
  schedulePush();
}

// שמירת אוסף: כותב ל-localStorage רק אם משהו השתנה, ומסמן לסנכרון.
export function persist(key, items) {
  let json;
  try {
    json = JSON.stringify(items);
  } catch {
    return;
  }
  if (lsGet(key) === json) return;
  lsSet(key, json);
  markDirty();
}

function schedulePush() {
  if (!session) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (pushing) queued = true;
    else pushAll();
  }, 800);
}

async function pushAll() {
  if (!session) return;
  pushing = true;
  const startVersion = version;
  set({ phase: 'saving', error: null });
  try {
    for (const { key, kind } of COLLECTIONS) {
      const local = new Map(readList(key).filter((i) => i && i.id).map((i) => [String(i.id), i]));
      const now = new Date().toISOString();
      const rows = [];
      for (const [id, item] of local) {
        const json = JSON.stringify(item);
        if (lastPushed[kind].get(id) !== json) {
          rows.push({ owner: session.user.id, kind, id, data: item, updated_at: now });
        }
      }
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        await rest('pf_records?on_conflict=owner,kind,id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: chunk,
        });
        chunk.forEach((r) => lastPushed[kind].set(r.id, JSON.stringify(r.data)));
      }
      const gone = [...remoteIds[kind]].filter((id) => !local.has(id));
      if (gone.length) {
        await rest(`pf_records?kind=eq.${kind}&id=in.(${gone.map(encodeURIComponent).join(',')})`, {
          method: 'DELETE',
        });
        gone.forEach((id) => lastPushed[kind].delete(id));
      }
      remoteIds[kind] = new Set(local.keys());
    }
    if (version === startVersion) lsDel(DIRTY_KEY);
    set({ phase: 'saved', lastSaved: Date.now(), error: null });
  } catch (e) {
    if (e.code === 'auth') set({ phase: 'signedout' });
    else set({ phase: 'error', error: e.message });
  } finally {
    pushing = false;
    if (queued || version !== startVersion) {
      queued = false;
      schedulePush();
    }
  }
}

function union(local, remote) {
  const ids = new Set(local.map((i) => i.id));
  return [...local, ...remote.filter((i) => !ids.has(i.id))];
}

// מושך את הנתונים מהענן ומיישב אותם מול העותק המקומי.
async function reconcile() {
  set({ phase: 'saving', error: null });
  try {
    const rows = (await rest('pf_records?select=kind,id,data')) || [];
    const byKind = Object.fromEntries(COLLECTIONS.map((c) => [c.kind, []]));
    rows.forEach((r) => byKind[r.kind]?.push(r.data));

    const anyLocal = COLLECTIONS.some((c) => readList(c.key).length > 0);
    const firstOnDevice = lsGet(LINKED_KEY) !== session.user.id;
    const keepLocal = isDirty() || firstOnDevice || (rows.length === 0 && anyLocal);

    for (const { key, kind } of COLLECTIONS) {
      const remote = byKind[kind];
      const merged = keepLocal ? union(readList(key), remote) : remote;
      const json = JSON.stringify(merged);
      if (lsGet(key) !== json) lsSet(key, json);
      remoteIds[kind] = new Set(remote.map((i) => String(i.id)));
      lastPushed[kind] = new Map(remote.map((i) => [String(i.id), JSON.stringify(i)]));
    }
    lsSet(LINKED_KEY, session.user.id);
    window.dispatchEvent(new Event('pf:data'));

    if (keepLocal) {
      version += 1;
      lsSet(DIRTY_KEY, '1');
      await pushAll();
    } else {
      set({ phase: 'saved', lastSaved: Date.now(), error: null });
    }
  } catch (e) {
    if (e.code === 'auth') set({ phase: 'signedout' });
    else set({ phase: 'error', error: e.message });
  }
}

// ---------- ממשק ציבורי ----------

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export async function init() {
  if (!isConfigured) {
    set({ phase: 'local' });
    return;
  }
  if (session) {
    set({ email: session.user.email });
    await reconcile();
  } else if (lsGet(SKIP_KEY) === '1') {
    set({ phase: 'local' });
  } else {
    set({ phase: 'signedout' });
  }
  window.addEventListener('online', () => {
    if (session && isDirty()) schedulePush();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && session && !isDirty() && !pushing) reconcile();
  });
}

export async function signIn(email, password) {
  const res = await authCall('token?grant_type=password', { email, password });
  writeSession(toSession(res));
  lsDel(SKIP_KEY);
  set({ email: session.user.email });
  await reconcile();
}

// מחזיר { needsConfirm: true } כשצריך לאשר אימייל לפני הכניסה.
export async function signUp(email, password) {
  const res = await authCall('signup', { email, password });
  if (res.access_token && res.user) {
    writeSession(toSession(res));
    lsDel(SKIP_KEY);
    set({ email: session.user.email });
    await reconcile();
    return { needsConfirm: false };
  }
  return { needsConfirm: true };
}

export function skipLogin() {
  lsSet(SKIP_KEY, '1');
  set({ phase: 'local' });
}

export function showLogin() {
  lsDel(SKIP_KEY);
  set({ phase: 'signedout' });
}

export function retrySync() {
  if (!session) return;
  if (isDirty()) pushAll();
  else reconcile();
}

export function hasUnsynced() {
  return isDirty();
}

// יציאה: מנקה את הנתונים המקומיים (הם שמורים בענן) כדי לא להשאיר אותם במחשב משותף.
export async function signOut() {
  if (session && isDirty()) {
    try {
      await pushAll();
    } catch {
      /* ממשיכים: המשתמש כבר אישר */
    }
  }
  const token = session?.access_token;
  if (token) {
    try {
      await authCall('logout', {}, token);
    } catch {
      /* ההתנתקות המקומית מספיקה */
    }
  }
  COLLECTIONS.forEach(({ key, kind }) => {
    lsDel(key);
    remoteIds[kind] = new Set();
    lastPushed[kind] = new Map();
  });
  [DIRTY_KEY, LINKED_KEY, SKIP_KEY].forEach(lsDel);
  writeSession(null);
  set({ phase: 'signedout', email: null, lastSaved: null, error: null });
  window.dispatchEvent(new Event('pf:data'));
}
