import { useCallback, useEffect, useState } from 'react';
import { uid } from './storage.js';

export const RISKS_KEY = 'projectflow.risks.v1';
export const DECISIONS_KEY = 'projectflow.decisions.v1';

export const KINDS = [
  { value: 'risk', label: 'סיכון (עשוי לקרות)' },
  { value: 'issue', label: 'בעיה (כבר קרתה)' },
  { value: 'blocker', label: 'חסם (מונע התקדמות כעת)' },
];

export const LEVELS = [
  { value: 1, label: 'נמוכה' },
  { value: 2, label: 'בינונית' },
  { value: 3, label: 'גבוהה' },
];

export const kindLabel = (k) => (KINDS.find((x) => x.value === k) || KINDS[0]).label.split(' (')[0];

// חשיפה = הסתברות × חומרה (1–9). מ-6 ומעלה נחשבת גבוהה.
export const exposure = (r) => (Number(r.probability) || 0) * (Number(r.severity) || 0);
export const exposureLevel = (r) => {
  const e = exposure(r);
  return e >= 6 ? 'high' : e >= 3 ? 'mid' : 'low';
};

function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// רשימה פשוטה השמורה ב-localStorage (סיכונים, החלטות).
export function useList(key) {
  const [items, setItems] = useState(() => load(key));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      /* שמירה מקומית לא זמינה – ממשיכים בלי */
    }
  }, [key, items]);

  const add = useCallback(
    (item) =>
      setItems((xs) => [{ id: uid(), createdAt: new Date().toISOString(), ...item }, ...xs]),
    []
  );
  const update = useCallback(
    (id, patch) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    []
  );
  const remove = useCallback((id) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  return { items, add, update, remove };
}
