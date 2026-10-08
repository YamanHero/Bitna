import { useState } from 'react';

const KEY = 'pfui.theme';

export const THEMES = [
  { id: 'blue', label: 'אלמוג', color: '#e8453c', grad: 'linear-gradient(135deg,#e8453c,#f4623a 50%,#f59e0b)' },
  { id: 'aurora', label: 'אורורה', color: '#5b5bf0', grad: 'linear-gradient(135deg,#5b5bf0,#8b5cf6 50%,#06b6d4)' },
  { id: 'sunset', label: 'שקיעה', color: '#e11d74', grad: 'linear-gradient(135deg,#e11d74,#f97316)' },
  { id: 'teal', label: 'אוקיינוס', color: '#0d9488', grad: 'linear-gradient(135deg,#0ea5e9,#0d9488 55%,#22c55e)' },
  { id: 'violet', label: 'סגול', color: '#7c3aed', grad: 'linear-gradient(135deg,#7c3aed,#d946ef)' },
  { id: 'green', label: 'יער', color: '#16a34a', grad: 'linear-gradient(135deg,#16a34a,#84cc16)' },
  { id: 'amber', label: 'להבה', color: '#ea580c', grad: 'linear-gradient(135deg,#ea580c,#facc15)' },
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
          style={{ '--sw': t.color, '--sw-grad': t.grad }}
          onClick={() => pick(t.id)}
        />
      ))}
    </div>
  );
}
