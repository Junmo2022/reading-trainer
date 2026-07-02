// js/scheduler.js
import { SKILL_IDS, PROFICIENT_THRESHOLD } from './skills.js';

export function generateDailyPlan(profile, bank, dailyTarget = 2, doneToday = []) {
  const weakSkills = profile.weakSkills || [];
  const maintainSkills = SKILL_IDS.filter(id =>
    !weakSkills.includes(id) &&
    profile.skills[id].attempts > 0 &&
    profile.skills[id].mastery < PROFICIENT_THRESHOLD
  );

  const weakRatio = weakSkills.length <= 2 ? 0.6 : 0.5;
  const weakCount = Math.round(dailyTarget * weakRatio);

  const available = bank.passages.filter(p => !doneToday.includes(p.id));

  const scored = available.map(p => ({
    passage: p,
    weakScore: scorePassage(p, weakSkills),
    maintainScore: scorePassage(p, maintainSkills),
  }));

  const selected = [];
  const usedIds = new Set();
  let lastGenre = null;

  const pickFrom = (sorted, count, skillList) => {
    for (const s of sorted) {
      if (selected.length >= dailyTarget) break;
      if (usedIds.has(s.passage.id)) continue;
      if (s.passage.genre === lastGenre && selected.length > 0) continue;
      selected.push({
        passageId: s.passage.id,
        skillFocus: skillList.filter(sk => s.passage.questions.some(q => q.skill === sk)),
        completed: false,
      });
      usedIds.add(s.passage.id);
      lastGenre = s.passage.genre;
    }
  };

  pickFrom([...scored].sort((a, b) => b.weakScore - a.weakScore), weakCount, weakSkills);
  pickFrom([...scored].sort((a, b) => b.maintainScore - a.maintainScore), dailyTarget, maintainSkills);

  // 放宽文体限制补足
  if (selected.length < dailyTarget) {
    for (const s of scored) {
      if (selected.length >= dailyTarget) break;
      if (usedIds.has(s.passage.id)) continue;
      selected.push({ passageId: s.passage.id, skillFocus: [], completed: false });
      usedIds.add(s.passage.id);
    }
  }

  return {
    date: new Date().toISOString().slice(0, 10),
    status: 'pending',
    sessions: selected.slice(0, dailyTarget),
    weakTarget: weakSkills,
    maintain: maintainSkills,
  };
}

function scorePassage(passage, skills) {
  if (skills.length === 0) return 0;
  return passage.questions.reduce((sum, q) =>
    skills.includes(q.skill) ? sum + q.difficulty : sum, 0);
}

export function adjustDifficulty(current, consecutiveCorrect, consecutiveWrong) {
  if (consecutiveCorrect >= 2 && current < 3) return current + 1;
  if (consecutiveWrong >= 2 && current > 1) return current - 1;
  return current;
}
