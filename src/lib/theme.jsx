import { useState } from 'react';

const KEY = 'pfui.theme';

export const THEMES = [
  { id: 'blue', label: 'כחול', color: '#2456e6' },
  { id: 'teal', label: 'טורקיז', color: '#0d8a8a' },
  { id: 'violet', label: 'סגול', color: '#6d4aff' },
  { id: 'green', label: 'ירוק', color: '#1f8a4c' },
  { id: 'amber', label: 'כתום', color: '#d9480f' },
];

function read() {
  try {
    const t = localStorage.getItem(KEY);
    return THEMES.some((x) => x.id === t) ? t : 'blue';
  } catch {
    return 'blue';
  }
}

export function applyTheme(id) {
  if (id === 'blue') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', id);
}

// מיישם את הצבע השמור מיד בטעינה, לפני שהמסך מצויר.
applyTheme(read());

export function ThemePicker() {
  const [cur, setCur] = useState(read);
  const pick = (id) => {
    setCur(id);
    applyTheme(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* אין שמירה מקומית */
    }
  };
  return (
    <div className="themes" role="radiogroup" aria-label="צבע האפליקציה">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={cur === t.id}
          aria-label={t.label}
          title={t.label}
          className={`swatch${cur === t.id ? ' on' : ''}`}
          style={{ '--sw': t.color }}
          onClick={() => pick(t.id)}
        />
      ))}
    </div>
  );
}
