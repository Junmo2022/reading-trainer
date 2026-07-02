// tests/skills.test.js
import { describe, it, expect } from 'vitest';
import { SKILLS, createEmptyProfile, updateMastery, WEAK_THRESHOLD } from '../js/skills.js';

describe('SKILLS', () => {
  it('has 6 skills S1-S6', () => {
    expect(SKILLS).toHaveLength(6);
    expect(SKILLS.map(s => s.id)).toEqual(['S1','S2','S3','S4','S5','S6']);
  });
});

describe('createEmptyProfile', () => {
  it('creates profile with 6 skills at 0 mastery', () => {
    const p = createEmptyProfile('chinese');
    expect(p.subject).toBe('chinese');
    expect(p.overallLevel).toBe('unknown');
    for (const s of SKILLS) {
      expect(p.skills[s.id].mastery).toBe(0);
      expect(p.skills[s.id].attempts).toBe(0);
    }
  });
});

describe('updateMastery', () => {
  it('increases mastery on correct', () => {
    const p = createEmptyProfile('chinese');
    const r = updateMastery(p, 'S3', true, 2);
    expect(r.skills.S3.mastery).toBeGreaterThan(0);
    expect(r.skills.S3.attempts).toBe(1);
    expect(r.skills.S3.correct).toBe(1);
  });

  it('higher difficulty gives more mastery', () => {
    const p1 = createEmptyProfile('chinese');
    const p2 = createEmptyProfile('chinese');
    const r1 = updateMastery(p1, 'S3', true, 1);
    const r2 = updateMastery(p2, 'S3', true, 3);
    expect(r2.skills.S3.mastery).toBeGreaterThan(r1.skills.S3.mastery);
  });

  it('updates weakSkills when mastery low', () => {
    let p = createEmptyProfile('chinese');
    p = updateMastery(p, 'S3', false, 2);
    p = updateMastery(p, 'S3', false, 2);
    expect(p.weakSkills).toContain('S3');
  });

  it('removes from weakSkills when mastery rises', () => {
    let p = createEmptyProfile('chinese');
    for (let i = 0; i < 15; i++) p = updateMastery(p, 'S3', true, 3);
    expect(p.weakSkills).not.toContain('S3');
  });
});
