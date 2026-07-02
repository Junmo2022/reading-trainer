// js/skills.js
export const WEAK_THRESHOLD = 40;
export const PROFICIENT_THRESHOLD = 75;
const ROLLING_WINDOW = 20;
const MASTERY_MAX = 100;

export const SKILLS = [
  { id: 'S1', name: '提取信息', desc: '从文中找细节、定位关键句' },
  { id: 'S2', name: '词句理解', desc: '理解词语和句子的含义' },
  { id: 'S3', name: '概括主旨', desc: '概括文章主要内容、段落大意' },
  { id: 'S4', name: '推断推理', desc: '言外之意、人物心理、合理预测' },
  { id: 'S5', name: '结构分析', desc: '文章顺序、段落关系、照应' },
  { id: 'S6', name: '赏析评价', desc: '好词好句的表达效果、谈感受' },
];

export const SKILL_IDS = SKILLS.map(s => s.id);

export function createEmptyProfile(subject = 'chinese') {
  const skills = {};
  for (const s of SKILLS) {
    skills[s.id] = { mastery: 0, attempts: 0, correct: 0, recentResults: [], lastUpdate: null };
  }
  return { subject, skills, overallLevel: 'unknown', weakSkills: [], lastDiagnosis: null };
}

export function updateMastery(profile, skillId, isCorrect, difficulty) {
  const p = structuredClone(profile);
  const skill = p.skills[skillId];
  if (!skill) return profile;

  skill.attempts += 1;
  if (isCorrect) skill.correct += 1;
  skill.recentResults = skill.recentResults || [];
  skill.recentResults.push(isCorrect);
  if (skill.recentResults.length > ROLLING_WINDOW)
    skill.recentResults = skill.recentResults.slice(-ROLLING_WINDOW);

  const recentCorrect = skill.recentResults.filter(r => r).length;
  const recentTotal = skill.recentResults.length;
  const recentRate = recentTotal > 0 ? recentCorrect / recentTotal : 0;
  const diffMult = difficulty === 3 ? 1.2 : difficulty === 1 ? 0.8 : 1.0;
  const totalRate = skill.attempts > 0 ? skill.correct / skill.attempts : 0;
  const blended = recentRate * 0.7 + totalRate * 0.3;

  let newMastery = blended * 100 * diffMult;
  if (skill.attempts === 1) {
    newMastery = isCorrect ? (difficulty >= 2 ? 45 : 35) : 20;
  }

  skill.mastery = Math.max(0, Math.min(MASTERY_MAX, Math.round(newMastery)));
  skill.lastUpdate = new Date().toISOString().slice(0, 10);

  p.weakSkills = SKILL_IDS.filter(id => {
    const sk = p.skills[id];
    return sk.attempts > 0 && sk.mastery < WEAK_THRESHOLD;
  });

  const avg = SKILL_IDS.reduce((s, id) => s + p.skills[id].mastery, 0) / SKILL_IDS.length;
  p.overallLevel = avg >= PROFICIENT_THRESHOLD ? 'proficient' : avg >= 55 ? 'developing' : avg > 0 ? 'basic' : 'unknown';

  return p;
}

export function applyDecay(profile) {
  const p = structuredClone(profile);
  const today = new Date().toISOString().slice(0, 10);
  for (const skillId of SKILL_IDS) {
    const skill = p.skills[skillId];
    if (skill.lastUpdate && skill.lastUpdate !== today) {
      const days = Math.floor((new Date(today) - new Date(skill.lastUpdate)) / 86400000);
      if (days > 3) skill.mastery = Math.round(skill.mastery * Math.pow(0.98, days - 3));
    }
  }
  p.weakSkills = SKILL_IDS.filter(id => p.skills[id].attempts > 0 && p.skills[id].mastery < WEAK_THRESHOLD);
  return p;
}
