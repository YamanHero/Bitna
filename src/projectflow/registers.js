import { useCallback, useEffect, useState } from 'react';
import { persist } from '../lib/cloud.js';
import { uid } from './storage.js';

export const RISKS_KEY = 'projectflow.risks.v1';
export const DECISIONS_KEY = 'projectflow.decisions.v1';
export const CHANGES_KEY = 'projectflow.changes.v1';
export const PAYMENTS_KEY = 'projectflow.payments.v1';
export const TEAM_KEY = 'projectflow.team.v1';
export const MEETINGS_KEY = 'projectflow.meetings.v1';
export const TOPICS_KEY = 'projectflow.topics.v1';

export const CR_STATUS = [
  { value: 'open', label: 'ממתינה להחלטה' },
  { value: 'approved', label: 'אושרה' },
  { value: 'rejected', label: 'נדחתה' },
  { value: 'deferred', label: 'נדחתה לשלב מאוחר' },
];

// תנאים לשחרור תשלום: אבן דרך נמסרה, התקבלה, ורק אז משלמים.
export const PAYMENT_CHECKS = [
  { key: 'doc', label: 'המסמך / התוצר התקבל' },
  { key: 'comments', label: 'הערות נסגרו' },
  { key: 'accepted', label: 'קבלה חתומה' },
  { key: 'invoice', label: 'חשבונית תקינה' },
];

export const paymentReady = (p) => PAYMENT_CHECKS.every((c) => p.checks?.[c.key]);

export const shekel = (n) =>
  n === '' || n == null || Number.isNaN(Number(n)) ? '—' : `₪${Number(n).toLocaleString('he-IL')}`;

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
    persist(key, items);
  }, [key, items]);

  useEffect(() => {
    const reload = () => setItems(load(key));
    window.addEventListener('pf:data', reload);
    return () => window.removeEventListener('pf:data', reload);
  }, [key]);

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
