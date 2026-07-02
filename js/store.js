// js/store.js
import { dbGet, dbGetAll, dbGetByIndex, dbPut, STORES } from './db.js';

// 题库
export async function saveQuestionBank(bank) { await dbPut(STORES.questionBank, bank); }
export async function getQuestionBank(version) { return dbGet(STORES.questionBank, version); }
export async function getAllQuestionBanks() { return dbGetAll(STORES.questionBank); }
export async function getLatestQuestionBank(subject = 'chinese') {
  const banks = await dbGetAll(STORES.questionBank);
  return banks.filter(b => b.subject === subject)
    .sort((a, b) => b.version.localeCompare(a.version))[0] || null;
}

// 技能画像
export async function getProfile(subject = 'chinese') { return dbGet(STORES.profile, subject); }
export async function saveProfile(profile) { await dbPut(STORES.profile, profile); }

// 做题记录
export async function addRecord(record) { await dbPut(STORES.records, record); }
export async function getRecordsByDate(date) { return dbGetByIndex(STORES.records, 'date', date); }
export async function getRecordsBySkill(skill) { return dbGetByIndex(STORES.records, 'skill', skill); }
export async function getAllRecords() { return dbGetAll(STORES.records); }

// 训练计划
export async function getPlan(date) { return dbGet(STORES.plans, date); }
export async function savePlan(plan) { await dbPut(STORES.plans, plan); }

// 激励数据
export async function getGamification() {
  return (await dbGet(STORES.gamification, 'main')) || {
    id: 'main', totalPoints: 0, streakDays: 0, lastActiveDate: null, badges: [], dailyPoints: {},
  };
}
export async function saveGamification(data) { await dbPut(STORES.gamification, data); }

// 配置
export async function getConfig() {
  return (await dbGet(STORES.config, 'settings')) || {
    key: 'settings', dailyTarget: 2, restInterval: true, maxDifficulty: 3,
    parentPin: '1234', updateSource: '', fontSize: 'normal',
  };
}
export async function saveConfig(config) { await dbPut(STORES.config, config); }

// 标记题目
export async function flagQuestion(flag) { await dbPut(STORES.flaggedQuestions, flag); }
export async function getFlaggedQuestions() { return dbGetAll(STORES.flaggedQuestions); }
