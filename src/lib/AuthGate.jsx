import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getState,
  hasUnsynced,
  init,
  isConfigured,
  retrySync,
  showLogin,
  signIn,
  signOut,
  signUp,
  skipLogin,
  subscribe,
} from './cloud.js';

export const useSync = () => useSyncExternalStore(subscribe, getState, getState);

function Login() {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'in') await signIn(email.trim(), password);
      else {
        const r = await signUp(email.trim(), password);
        if (r.needsConfirm) {
          setInfo('שלחנו הודעה לכתובת האימייל. לחצו על הקישור בהודעה ואז היכנסו.');
          setMode('in');
        }
      }
    } catch (err) {
      setError(err.message || 'משהו השתבש. נסו שוב.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <img src="/favicon.svg" alt="" width="64" height="64" />
        <h1>מגדל בקרה</h1>
        <p className="muted">
          {mode === 'in' ? 'היכנסו כדי לשמור את הנתונים בענן ולעבוד מכל מכשיר.' : 'יצירת חשבון חדש'}
        </p>
        <label>
          אימייל
          <input
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          סיסמה
          <input
            type="password"
            dir="ltr"
            minLength={6}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="pf-err" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="pf-ok" role="status">
            {info}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'רגע…' : mode === 'in' ? 'כניסה' : 'יצירת חשבון'}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(mode === 'in' ? 'up' : 'in');
            setError('');
          }}
        >
          {mode === 'in' ? 'אין חשבון? יצירת חשבון' : 'יש חשבון? כניסה'}
        </button>
        <button type="button" className="ghost" onClick={skipLogin}>
          המשך בלי התחברות
        </button>
        <p className="login-note">בלי התחברות הנתונים נשמרים בדפדפן הזה בלבד.</p>
      </form>
    </main>
  );
}

export default function AuthGate({ children }) {
  const s = useSync();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    init().finally(() => setReady(true));
  }, []);
  if (!ready) return <p className="boot">טוען…</p>;
  if (s.phase === 'signedout' && isConfigured) return <Login />;
  return children;
}

export function SyncBadge() {
  const s = useSync();
  const onLogout = () => {
    const warn = hasUnsynced()
      ? 'יש שינויים שעוד לא נשמרו בענן. ננסה לשמור אותם לפני היציאה. הנתונים יימחקו מהדפדפן הזה. להמשיך?'
      : 'הנתונים נשמרו בענן ויימחקו מהדפדפן הזה. להמשיך?';
    if (window.confirm(warn)) signOut();
  };
  if (s.phase === 'local') {
    return (
      <div className="sync local">
        <span>נשמר בדפדפן בלבד</span>
        <button type="button" className="ghost sm" onClick={showLogin}>
          כניסה לענן
        </button>
      </div>
    );
  }
  const text =
    s.phase === 'saving' ? 'שומר…' : s.phase === 'error' ? 'השמירה בענן נכשלה' : 'נשמר בענן';
  return (
    <div className={`sync ${s.phase}`} role="status">
      <span className="sync-line">
        <i className="dot" /> {text}
      </span>
      {s.email && <span className="sync-mail">{s.email}</span>}
      {s.phase === 'error' && (
        <button type="button" className="ghost sm" onClick={retrySync}>
          נסו שוב
        </button>
      )}
      <button type="button" className="ghost sm" onClick={onLogout}>
        יציאה
      </button>
    </div>
  );
}
