// js/diagnoser.js
import { SKILL_IDS, updateMastery } from './skills.js';

export function selectDiagnosisPassages(bank) {
  const g3 = bank.passages.filter(p => p.grade === 3);
  const g4 = bank.passages.filter(p => p.grade === 4);
  const selected = [];
  const covered = new Set();

  const pickBest = (pool) => {
    let best = null, bestNew = -1;
    for (const p of pool) {
      if (selected.includes(p)) continue;
      const newSkills = p.questions.filter(q => !covered.has(q.skill)).length;
      if (newSkills > bestNew) { best = p; bestNew = newSkills; }
    }
    return best;
  };

  // 2篇三年级
  for (let i = 0; i < 2; i++) {
    const p = pickBest(g3);
    if (p) { selected.push(p); p.questions.forEach(q => covered.add(q.skill)); }
  }
  // 1篇四年级
  const p4 = pickBest(g4);
  if (p4) selected.push(p4);
  else if (g4.length > 0) selected.push(g4[0]);

  // 补足3篇
  const remaining = bank.passages.filter(p => !selected.includes(p));
  while (selected.length < 3 && remaining.length > 0) selected.push(remaining.shift());

  return selected.slice(0, 3);
}

export function computeInitialProfile(profile, results) {
  let p = structuredClone(profile);
  for (const r of results) p = updateMastery(p, r.skill, r.isCorrect, r.difficulty);
  p.lastDiagnosis = new Date().toISOString().slice(0, 10);
  return p;
}

export function isDiagnosisDue(profile) {
  if (!profile.lastDiagnosis) return true;
  const days = Math.floor((Date.now() - new Date(profile.lastDiagnosis)) / 86400000);
  return days >= 14;
}
