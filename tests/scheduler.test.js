// tests/scheduler.test.js
import { describe, it, expect } from 'vitest';
import { generateDailyPlan } from '../js/scheduler.js';
import { createEmptyProfile } from '../js/skills.js';

const mockBank = {
  passages: [
    { id: 'p3_001', grade: 3, genre: '记叙', questions: [{ skill: 'S1', difficulty: 1 }, { skill: 'S3', difficulty: 2 }] },
    { id: 'p3_002', grade: 3, genre: '童话', questions: [{ skill: 'S2', difficulty: 1 }, { skill: 'S4', difficulty: 2 }] },
    { id: 'p3_003', grade: 3, genre: '写景', questions: [{ skill: 'S1', difficulty: 1 }, { skill: 'S5', difficulty: 1 }] },
    { id: 'p3_004', grade: 3, genre: '记叙', questions: [{ skill: 'S3', difficulty: 2 }, { skill: 'S4', difficulty: 2 }] },
    { id: 'p4_001', grade: 4, genre: '说明', questions: [{ skill: 'S3', difficulty: 3 }, { skill: 'S4', difficulty: 3 }] },
    { id: 'p4_002', grade: 4, genre: '记叙', questions: [{ skill: 'S5', difficulty: 2 }, { skill: 'S6', difficulty: 3 }] },
  ],
};

describe('generateDailyPlan', () => {
  it('generates correct session count', () => {
    const p = createEmptyProfile('chinese');
    p.skills.S3.mastery = 25; p.skills.S3.attempts = 5;
    p.skills.S4.mastery = 20; p.skills.S4.attempts = 5;
    p.weakSkills = ['S3', 'S4'];
    const plan = generateDailyPlan(p, mockBank, 2, []);
    expect(plan.sessions).toHaveLength(2);
    expect(plan.weakTarget).toContain('S3');
    expect(plan.weakTarget).toContain('S4');
  });

  it('excludes done passages', () => {
    const p = createEmptyProfile('chinese');
    const plan = generateDailyPlan(p, mockBank, 2, ['p3_001', 'p3_002']);
    plan.sessions.forEach(s => expect(['p3_001','p3_002']).not.toContain(s.passageId));
  });

  it('plan has correct date and status', () => {
    const p = createEmptyProfile('chinese');
    const plan = generateDailyPlan(p, mockBank, 2, []);
    expect(plan.date).toBe(new Date().toISOString().slice(0, 10));
    expect(plan.status).toBe('pending');
  });
});
