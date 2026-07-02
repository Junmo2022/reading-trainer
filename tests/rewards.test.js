// tests/rewards.test.js
import { describe, it, expect } from 'vitest';
import { awardPoints, updateStreak, checkBadges } from '../js/rewards.js';

const mockG = () => ({
  id: 'main', totalPoints: 0, streakDays: 0, lastActiveDate: null, badges: [], dailyPoints: {},
});

describe('awardPoints', () => {
  it('10 points per correct', () => {
    expect(awardPoints(mockG(), 3, 5).totalPoints).toBe(30);
  });
  it('bonus for all correct', () => {
    expect(awardPoints(mockG(), 5, 5).totalPoints).toBe(70);
  });
  it('records daily points', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(awardPoints(mockG(), 3, 5).dailyPoints[today]).toBe(30);
  });
});

describe('updateStreak', () => {
  it('starts at 1', () => {
    expect(updateStreak(mockG()).streakDays).toBe(1);
  });
  it('increments on consecutive day', () => {
    const g = mockG(); g.streakDays = 3;
    g.lastActiveDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    expect(updateStreak(g).streakDays).toBe(4);
  });
  it('resets on gap', () => {
    const g = mockG(); g.streakDays = 5;
    g.lastActiveDate = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    expect(updateStreak(g).streakDays).toBe(1);
  });
});

describe('checkBadges', () => {
  it('awards first_complete', () => {
    expect(checkBadges(mockG(), { firstSession: true }).badges.find(b => b.id === 'first_complete')).toBeTruthy();
  });
  it('awards streak7', () => {
    const g = mockG(); g.streakDays = 7;
    expect(checkBadges(g, {}).badges.find(b => b.id === 'streak7')).toBeTruthy();
  });
  it('no duplicate badges', () => {
    const g = mockG(); g.streakDays = 7;
    g.badges = [{ id: 'streak7', name: '连续7天', icon: '🔥', date: '2026-07-01' }];
    expect(checkBadges(g, {}).badges.filter(b => b.id === 'streak7')).toHaveLength(1);
  });
});
