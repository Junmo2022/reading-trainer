// js/app.js
// 应用入口：初始化数据库、加载题库、注册 Service Worker、注册路由并启动。

import { openDB } from './db.js';
import {
  getLatestQuestionBank,
  saveQuestionBank,
  getProfile,
  getGamification,
  getConfig,
  saveProfile,
} from './store.js';
import { applyDecay, createEmptyProfile } from './skills.js';
import { isDiagnosisDue } from './diagnoser.js';
import { register, startRouter } from './router.js';
import {
  renderDiagnosisIntro,
  renderDiagnosis,
  renderChildHome,
  renderReader,
} from './child-ui.js';
import { renderParentDashboard } from './parent-ui.js';

/**
 * 确保题库已加载到 IndexedDB。
 * 首次运行或版本过旧时从静态文件 fetch chinese-g34-v2.json 并写入。
 */
async function ensureQuestionBankLoaded() {
  let bank = await getLatestQuestionBank('chinese');
  // 无题库 或 版本低于 2026.07.002 → 加载最新
  if (!bank || !bank.version || bank.version < '2026.07.002') {
    const res = await fetch('./data/question-bank/chinese-g34-v2.json');
    if (!res.ok) throw new Error('题库加载失败: HTTP ' + res.status);
    const data = await res.json();
    await saveQuestionBank(data);
    return data;
  }
  return bank;
}

/**
 * 首页路由：判断是否需要诊断。
 * - 需要诊断：渲染诊断引导页。
 * - 不需要：应用技能衰减，渲染孩子主界面。
 */
async function renderHome(el) {
  try {
    let profile = await getProfile('chinese');
    if (!profile) profile = createEmptyProfile('chinese');

    if (isDiagnosisDue(profile)) {
      renderDiagnosisIntro(el);
      return;
    }

    const decayed = applyDecay(profile);
    // 衰减后有变化才回写，避免无谓写库
    if (JSON.stringify(decayed) !== JSON.stringify(profile)) {
      await saveProfile(decayed);
    }

    const gamification = await getGamification();
    const config = await getConfig();
    await renderChildHome(el, decayed, gamification, config);
  } catch (err) {
    console.error('首页渲染失败:', err);
    el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;color:#666;padding:20px;text-align:center;">' +
      '<p style="margin-bottom:16px;">加载失败，可能是网络问题</p>' +
      '<button onclick="location.reload()" style="padding:10px 24px;font-size:16px;border:none;border-radius:8px;background:#4A90D9;color:#fff;cursor:pointer;">重试</button>' +
      '</div>';
  }
}

/**
 * 注册 Service Worker（离线缓存）。
 * 注册失败不影响主流程。
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service Worker 注册失败:', err);
    });
  });
}

/**
 * 显示错误信息（而非白屏）。
 */
function showError(msg) {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;color:#666;padding:20px;text-align:center;">' +
      '<p style="margin-bottom:16px;">' + msg + '</p>' +
      '<button onclick="location.reload()" style="padding:10px 24px;font-size:16px;border:none;border-radius:8px;background:#4A90D9;color:#fff;cursor:pointer;">重试</button>' +
      '</div>';
  }
}

/**
 * 应用初始化入口。
 */
async function init() {
  try {
    await openDB();
  } catch (err) {
    console.error('数据库初始化失败:', err);
    showError('数据库初始化失败，请重试');
    return;
  }

  // 题库加载不阻塞路由启动
  try {
    await ensureQuestionBankLoaded();
  } catch (err) {
    console.error('题库加载失败:', err);
    // 不立即报错，让路由启动后由 renderHome 处理
  }

  registerServiceWorker();

  register('/', renderHome);
  register('/diagnosis', renderDiagnosis);
  register('/train', renderReader);
  register('/parent', renderParentDashboard);

  startRouter();
}

// 全局错误捕获，防止白屏
window.addEventListener('error', (e) => {
  console.error('全局错误:', e.error || e.message);
});

init().catch(err => {
  console.error('初始化失败:', err);
  showError('应用初始化失败，请重试');
});
