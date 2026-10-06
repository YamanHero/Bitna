import { useCallback, useEffect, useState } from 'react';
import { persist } from '../lib/cloud.js';
import { STAGES } from './stages.js';

const KEY = 'projectflow.v1';

export const uid = () => Math.random().toString(36).slice(2, 10);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// תבניות פרויקט: אילו שלבים נכללים כברירת מחדל. אפשר להוסיף ולהסיר שלבים גם אחר כך.
export const TEMPLATES = [
  { id: 'full', label: 'מכרז מלא', ids: STAGES.map((s) => s.id) },
  {
    id: 'framework',
    label: 'הזמנה מהסכם מסגרת',
    ids: ['needs', 'budget', 'bids', 'evaluation', 'approval', 'contract', 'delivery', 'acceptance', 'closure'],
  },
  {
    id: 'exempt',
    label: 'פטור ממכרז או רכש ישיר',
    ids: ['needs', 'budget', 'approval', 'contract', 'delivery', 'acceptance', 'closure'],
  },
  { id: 'empty', label: 'התחלה ריקה (שלבים ומשימות משלי)', ids: [] },
];

// השלבים של פרויקט: הרשימה השמורה בו, ובפרויקטים ישנים כל שלבי הברירת מחדל.
export const stagesOf = (project) =>
  project.stages || STAGES.map(({ id, title }) => ({ id, title }));

export const catalogStage = (id) => STAGES.find((s) => s.id === id);

export function makeProject({ name, type, owner, budget, targetDate = '', template = 'full' }) {
  const ids = (TEMPLATES.find((t) => t.id === template) || TEMPLATES[0]).ids;
  const now = new Date().toISOString();
  const chosen = STAGES.filter((s) => ids.includes(s.id));
  // סדר השלבים לפי התבנית (במסגרת, ההצעות באות לפני ההערכה וכדומה).
  const ordered = ids.map((id) => chosen.find((s) => s.id === id)).filter(Boolean);
  return {
    id: uid(),
    name,
    type,
    owner,
    budget,
    targetDate,
    createdAt: now,
    status: 'prep',
    statusLog: [{ status: 'prep', at: now }],
    stages: ordered.map(({ id, title }) => ({ id, title })),
    tasks: ordered.flatMap((s) =>
      s.tasks.map((title) => ({ id: uid(), stage: s.id, title, done: false }))
    ),
    stageMeta: {},
  };
}

export function stageStatus(project, stageId) {
  const ts = project.tasks.filter((t) => t.stage === stageId);
  const done = ts.filter((t) => t.done).length;
  return { total: ts.length, done, complete: ts.length > 0 && done === ts.length, empty: ts.length === 0 };
}

// כמה ימים נשארו עד יעד ההפעלה של הפרויקט (שלילי = עבר). null אם לא הוגדר יעד.
export function daysLeft(project, now = new Date()) {
  if (!project.targetDate) return null;
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00`);
  const target = new Date(`${project.targetDate}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

// שלבים שמועד היעד שלהם עבר והם עדיין לא הושלמו.
export function overdueStages(project, today = new Date().toISOString().slice(0, 10)) {
  return stagesOf(project).filter((s) => {
    const due = project.stageMeta?.[s.id]?.due;
    return due && due < today && !stageStatus(project, s.id).complete;
  });
}

// כמה משימות פתוחות נשארו בשלב שלפני השלב הנתון.
export function openBefore(project, stageId) {
  const list = stagesOf(project);
  const i = list.findIndex((s) => s.id === stageId);
  if (i <= 0) return { stage: null, open: 0 };
  const stage = list[i - 1];
  const st = stageStatus(project, stage.id);
  return { stage, open: st.total - st.done };
}

export function currentStage(project) {
  const list = stagesOf(project);
  if (project.tasks.length === 0) return list[0] || null;
  // שלב בלי משימות לא נחשב שלב נוכחי.
  return (
    list.find((s) => {
      const st = stageStatus(project, s.id);
      return !st.empty && !st.complete;
    }) || null
  );
}

export function overallProgress(project) {
  const total = project.tasks.length;
  if (!total) return 0;
  return Math.round((project.tasks.filter((t) => t.done).length / total) * 100);
}

export function useProjects() {
  const [projects, setProjects] = useState(load);

  useEffect(() => {
    persist(KEY, projects);
  }, [projects]);

  useEffect(() => {
    const reload = () => setProjects(load());
    window.addEventListener('pf:data', reload);
    return () => window.removeEventListener('pf:data', reload);
  }, []);

  const add = useCallback((p) => setProjects((ps) => [p, ...ps]), []);
  const update = useCallback(
    (id, fn) => setProjects((ps) => ps.map((p) => (p.id === id ? fn(p) : p))),
    []
  );
  const remove = useCallback((id) => setProjects((ps) => ps.filter((p) => p.id !== id)), []);

  return { projects, add, update, remove };
}
