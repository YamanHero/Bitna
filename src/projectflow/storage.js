import { useCallback, useEffect, useState } from 'react';
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

export function makeProject({ name, type, owner, budget }) {
  return {
    id: uid(),
    name,
    type,
    owner,
    budget,
    createdAt: new Date().toISOString(),
    tasks: STAGES.flatMap((s) =>
      s.tasks.map((title) => ({ id: uid(), stage: s.id, title, done: false }))
    ),
    stageMeta: {},
  };
}

export function stageStatus(project, stageId) {
  const ts = project.tasks.filter((t) => t.stage === stageId);
  const done = ts.filter((t) => t.done).length;
  return { total: ts.length, done, complete: ts.length > 0 && done === ts.length };
}

// שלבים שמועד היעד שלהם עבר והם עדיין לא הושלמו.
export function overdueStages(project, today = new Date().toISOString().slice(0, 10)) {
  return STAGES.filter((s) => {
    const due = project.stageMeta?.[s.id]?.due;
    return due && due < today && !stageStatus(project, s.id).complete;
  });
}

// כמה משימות פתוחות נשארו בשלב שלפני השלב הנתון.
export function openBefore(project, stageId) {
  const i = STAGES.findIndex((s) => s.id === stageId);
  if (i <= 0) return { stage: null, open: 0 };
  const stage = STAGES[i - 1];
  const st = stageStatus(project, stage.id);
  return { stage, open: st.total - st.done };
}

export function currentStage(project) {
  return STAGES.find((s) => !stageStatus(project, s.id).complete) || null;
}

export function overallProgress(project) {
  const total = project.tasks.length;
  if (!total) return 0;
  return Math.round((project.tasks.filter((t) => t.done).length / total) * 100);
}

export function useProjects() {
  const [projects, setProjects] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(projects));
    } catch {
      /* שמירה מקומית לא זמינה – ממשיכים בלי */
    }
  }, [projects]);

  const add = useCallback((p) => setProjects((ps) => [p, ...ps]), []);
  const update = useCallback(
    (id, fn) => setProjects((ps) => ps.map((p) => (p.id === id ? fn(p) : p))),
    []
  );
  const remove = useCallback((id) => setProjects((ps) => ps.filter((p) => p.id !== id)), []);

  return { projects, add, update, remove };
}
