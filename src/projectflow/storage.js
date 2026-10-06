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
