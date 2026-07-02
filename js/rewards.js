// js/rewards.js
const POINTS_PER_CORRECT = 10;
const ALL_CORRECT_BONUS = 20;
const today = () => new Date().toISOString().slice(0, 10);

export const BADGE_DEFS = {
  first_complete: { name: '首次完成', icon: '🌟' },
  streak3: { name: '连续3天', icon: '⭐' },
  streak7: { name: '连续7天', icon: '🔥' },
  streak14: { name: '连续14天', icon: '🏆' },
  streak30: { name: '连续30天', icon: '👑' },
  perfect_session: { name: '全对达人', icon: '💯' },
  points100: { name: '百分达人', icon: '💯' },
  points500: { name: '积分高手', icon: '🎯' },
  points1000: { name: '阅读大师', icon: '🎓' },
};

export function awardPoints(g, correctCount, totalCount) {
  const r = structuredClone(g);
  let pts = correctCount * POINTS_PER_CORRECT;
  if (correctCount === totalCount && totalCount > 0) pts += ALL_CORRECT_BONUS;
  r.totalPoints += pts;
  r.dailyPoints[today()] = (r.dailyPoints[today()] || 0) + pts;
  return r;
}

export function updateStreak(g) {
  const r = structuredClone(g);
  const t = today();
  if (r.lastActiveDate === t) return r;
  if (r.lastActiveDate) {
    const diff = Math.round((new Date(t) - new Date(r.lastActiveDate)) / 86400000);
    r.streakDays = diff === 1 ? r.streakDays + 1 : 1;
  } else {
    r.streakDays = 1;
  }
  r.lastActiveDate = t;
  return r;
}

export function checkBadges(g, info) {
  const r = structuredClone(g);
  const have = new Set(r.badges.map(b => b.id));
  const award = (id) => {
    if (!have.has(id) && BADGE_DEFS[id]) {
      r.badges.push({ id, name: BADGE_DEFS[id].name, icon: BADGE_DEFS[id].icon, date: today() });
      have.add(id);
    }
  };
  if (info.firstSession) award('first_complete');
  if (r.streakDays >= 3) award('streak3');
  if (r.streakDays >= 7) award('streak7');
  if (r.streakDays >= 14) award('streak14');
  if (r.streakDays >= 30) award('streak30');
  if (info.allCorrect && info.totalQuestions >= 3) award('perfect_session');
  if (r.totalPoints >= 100) award('points100');
  if (r.totalPoints >= 500) award('points500');
  if (r.totalPoints >= 1000) award('points1000');
  return r;
}
