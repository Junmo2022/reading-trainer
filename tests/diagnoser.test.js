// tests/diagnoser.test.js
import { describe, it, expect } from 'vitest';
import { selectDiagnosisPassages, computeInitialProfile, isDiagnosisDue } from '../js/diagnoser.js';
import { createEmptyProfile } from '../js/skills.js';

const mockBank = {
  passages: [
    { id: 'p3_001', grade: 3, questions: [
      { skill: 'S1', difficulty: 1 }, { skill: 'S2', difficulty: 1 },
      { skill: 'S3', difficulty: 2 }, { skill: 'S4', difficulty: 2 },
      { skill: 'S5', difficulty: 1 }, { skill: 'S6', difficulty: 2 } ]},
    { id: 'p3_002', grade: 3, questions: [
      { skill: 'S1', difficulty: 1 }, { skill: 'S3', difficulty: 2 },
      { skill: 'S4', difficulty: 2 }, { skill: 'S2', difficulty: 1 },
      { skill: 'S5', difficulty: 1 }, { skill: 'S6', difficulty: 2 } ]},
    { id: 'p4_001', grade: 4, questions: [
      { skill: 'S1', difficulty: 2 }, { skill: 'S2', difficulty: 2 },
      { skill: 'S3', difficulty: 3 }, { skill: 'S4', difficulty: 3 },
      { skill: 'S5', difficulty: 2 }, { skill: 'S6', difficulty: 3 } ]},
  ],
};

describe('selectDiagnosisPassages', () => {
  it('selects 3 passages covering all 6 skills', () => {
    const sel = selectDiagnosisPassages(mockBank);
    expect(sel).toHaveLength(3);
    const skills = new Set();
    sel.forEach(p => p.questions.forEach(q => skills.add(q.skill)));
    expect(skills.size).toBe(6);
  });
  it('prefers G3 first, G4 last', () => {
    const sel = selectDiagnosisPassages(mockBank);
    expect(sel[0].grade).toBe(3);
    expect(sel[2].grade).toBe(4);
  });
});

describe('computeInitialProfile', () => {
  it('produces mastery from results', () => {
    const p = createEmptyProfile('chinese');
    const results = [
      { skill: 'S1', isCorrect: true, difficulty: 1 },
      { skill: 'S1', isCorrect: true, difficulty: 1 },
      { skill: 'S3', isCorrect: false, difficulty: 2 },
      { skill: 'S4', isCorrect: false, difficulty: 3 },
    ];
    const r = computeInitialProfile(p, results);
    expect(r.skills.S1.mastery).toBeGreaterThan(r.skills.S3.mastery);
    expect(r.weakSkills).toContain('S4');
    expect(r.lastDiagnosis).toBeTruthy();
  });
});

describe('isDiagnosisDue', () => {
  it('true when no diagnosis', () => {
    expect(isDiagnosisDue(createEmptyProfile('chinese'))).toBe(true);
  });
  it('false within 14 days', () => {
    const p = createEmptyProfile('chinese');
    p.lastDiagnosis = new Date().toISOString().slice(0, 10);
    expect(isDiagnosisDue(p)).toBe(false);
  });
  it('true after 14 days', () => {
    const p = createEmptyProfile('chinese');
    p.lastDiagnosis = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);
    expect(isDiagnosisDue(p)).toBe(true);
  });
});
