// js/parent-ui.js — 完整家长端看板
import { navigate } from './router.js';
import {
  getProfile,
  saveProfile,
  getAllRecords,
  getGamification,
  getConfig,
  saveConfig,
  getLatestQuestionBank,
  saveGamification,
  addRecord,
} from './store.js';
import { SKILLS, SKILL_IDS, WEAK_THRESHOLD, PROFICIENT_THRESHOLD } from './skills.js';
import { isDiagnosisDue } from './diagnoser.js';
import { renderRadarSVG, renderTrendSVG } from './charts.js';
import { checkForUpdates, downloadUpdate } from './updater.js';

// 模块级状态：跨多次 render 调用保持
const state = {
  authenticated: false, // 是否已通过口令验证
  activeTab: 'radar', // radar | records | trend | settings
  showCompare: false, // 雷达是否显示初始诊断对比
  expandedDate: null, // 记录列表中展开的日期
};

const TABS = [
  { id: 'radar', name: '技能雷达' },
  { id: 'records', name: '做题记录' },
  { id: 'trend', name: '趋势' },
  { id: 'settings', name: '设置' },
];

/**
 * 家长看板入口：渲染到 el
 */
export async function renderParentDashboard(el) {
  await render(el);
}

async function render(el) {
  if (!state.authenticated) {
    renderPinPage(el);
    return;
  }
  await renderDashboard(el);
}

/* ============ 工具函数 ============ */
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(s, n) {
  s = String(s == null ? '' : s);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function flashSaved(statusEl, msg) {
  if (!statusEl) return;
  statusEl.textContent = msg;
  clearTimeout(statusEl._t);
  statusEl._t = setTimeout(() => {
    if (statusEl) statusEl.textContent = '';
  }, 2200);
}

function applyFontSize(size) {
  const root = document.documentElement;
  if (size === 'large') {
    root.style.setProperty('--font-size-base', '20px');
    root.style.setProperty('--font-size-large', '24px');
    root.style.setProperty('--font-size-xlarge', '30px');
  } else if (size === 'xlarge') {
    root.style.setProperty('--font-size-base', '22px');
    root.style.setProperty('--font-size-large', '26px');
    root.style.setProperty('--font-size-xlarge', '32px');
  } else {
    root.style.setProperty('--font-size-base', '18px');
    root.style.setProperty('--font-size-large', '22px');
    root.style.setProperty('--font-size-xlarge', '28px');
  }
}

/* ============ 口令验证页 ============ */
function renderPinPage(el) {
  el.innerHTML = `
    <div class="parent-view pin-view">
      <div class="pin-card">
        <div class="pin-title">家长验证</div>
        <div class="pin-desc">请输入家长口令</div>
        <input id="pinInput" class="pin-input" type="password" inputmode="numeric"
               maxlength="4" placeholder="••••" autocomplete="off"/>
        <div id="pinError" class="pin-error"></div>
        <button id="pinSubmit" class="btn btn-primary pin-submit">进入看板</button>
        <button id="pinBack" class="btn btn-secondary pin-back">返回</button>
      </div>
    </div>
  `;
  const input = el.querySelector('#pinInput');
  const errorEl = el.querySelector('#pinError');
  input.focus();

  const trySubmit = async () => {
    const config = await getConfig();
    const pin = config.parentPin || '1234';
    if (input.value === pin) {
      state.authenticated = true;
      applyFontSize(config.fontSize);
      await render(el);
    } else {
      errorEl.textContent = '口令错误，请重试';
      input.value = '';
      input.focus();
    }
  };

  el.querySelector('#pinSubmit').addEventListener('click', trySubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') trySubmit();
  });
  // 只允许输入数字
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 4);
    errorEl.textContent = '';
  });
  el.querySelector('#pinBack').addEventListener('click', () => navigate('/'));
}

/* ============ 看板外壳 ============ */
async function renderDashboard(el) {
  const config = await getConfig();
  applyFontSize(config.fontSize);

  const tabsHtml = TABS.map(
    (t) =>
      `<button class="parent-tab ${state.activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.name}</button>`
  ).join('');

  el.innerHTML = `
    <div class="parent-view">
      <div class="parent-header">
        <button class="back-btn" id="parentBack">‹ 返回</button>
        <h1 class="parent-title">家长看板</h1>
      </div>
      <div class="parent-tabs">${tabsHtml}</div>
      <div class="parent-section" id="parentContent">加载中…</div>
    </div>
  `;

  el.querySelector('#parentBack').addEventListener('click', () => navigate('/'));

  el.querySelectorAll('.parent-tab').forEach((tab) => {
    tab.addEventListener('click', async () => {
      state.activeTab = tab.dataset.tab;
      el.querySelectorAll('.parent-tab').forEach((x) =>
        x.classList.toggle('active', x.dataset.tab === state.activeTab)
      );
      const content = el.querySelector('#parentContent');
      content.innerHTML = '加载中…';
      await renderTabContent(content, config);
    });
  });

  const content = el.querySelector('#parentContent');
  await renderTabContent(content, config);
}

async function renderTabContent(container, config) {
  try {
    switch (state.activeTab) {
      case 'radar':
        await renderRadarTab(container);
        break;
      case 'records':
        await renderRecordsTab(container);
        break;
      case 'trend':
        await renderTrendTab(container);
        break;
      case 'settings':
        await renderSettingsTab(container, config);
        break;
      default:
        await renderRadarTab(container);
    }
  } catch (e) {
    container.innerHTML = `<div class="empty-state">加载失败：${escapeHtml(e.message || e)}</div>`;
  }
}

/* ============ 技能雷达 Tab ============ */
async function renderRadarTab(container) {
  const profile = await getProfile();
  if (!profile || !profile.skills) {
    container.innerHTML = `<div class="empty-state">尚未建立技能画像<br/>请先完成一次诊断。</div>`;
    return;
  }

  // 初始诊断对比快照：取 profile.initialDiagnosis（若存在）
  const hasSnapshot = !!profile.initialDiagnosis;
  const compareProfile = state.showCompare && hasSnapshot ? profile.initialDiagnosis : null;
  const radarSVG = renderRadarSVG(profile, compareProfile);
  const dueDiagnosis = isDiagnosisDue(profile);

  // 六类技能掌握度
  let skillList = '';
  for (const s of SKILLS) {
    const sk = profile.skills[s.id] || {};
    const mastery = typeof sk.mastery === 'number' ? sk.mastery : 0;
    let label = '未测';
    let labelClass = 'tag-unknown';
    if (sk.attempts > 0) {
      if (mastery < WEAK_THRESHOLD) {
        label = '薄弱';
        labelClass = 'tag-weak';
      } else if (mastery >= PROFICIENT_THRESHOLD) {
        label = '熟练';
        labelClass = 'tag-proficient';
      } else {
        label = '发展中';
        labelClass = 'tag-developing';
      }
    }
    skillList += `
      <div class="skill-row">
        <span class="skill-name">${escapeHtml(s.name)}</span>
        <div class="skill-bar"><div style="width:${mastery}%"></div></div>
        <span class="skill-value">${mastery}</span>
        <span class="skill-tag ${labelClass}">${label}</span>
      </div>`;
  }

  const compareNote =
    state.showCompare && !hasSnapshot
      ? `<div class="hint-note">暂无初始诊断快照，无法对比（快照会在完成诊断后生成）。</div>`
      : '';

  container.innerHTML = `
    <div class="radar-container card">${radarSVG}</div>
    ${dueDiagnosis ? `<div class="diag-tip">距离上次诊断已超过 14 天，建议复测以校准技能画像。</div>` : ''}
    <div class="compare-row">
      <label>
        <input type="checkbox" id="compareCheck" ${state.showCompare ? 'checked' : ''}/>
        显示初始诊断对比
      </label>
    </div>
    ${compareNote}
    <div class="skill-list card">
      <div class="card-title">六类技能掌握度</div>
      ${skillList}
    </div>
  `;

  const check = container.querySelector('#compareCheck');
  if (check) {
    check.addEventListener('change', (e) => {
      state.showCompare = e.target.checked;
      renderRadarTab(container);
    });
  }
}

/* ============ 做题记录 Tab ============ */
function groupRecordsByDate(records, titleMap) {
  const map = new Map(); // date -> { passages: Map<pid, passage> }
  for (const r of records) {
    const date = r.date || '未知日期';
    if (!map.has(date)) map.set(date, { passages: new Map() });
    const day = map.get(date);
    const pid = r.passageId || 'unknown';
    if (!day.passages.has(pid)) {
      day.passages.set(pid, {
        passageId: pid,
        passageTitle: r.passageTitle || (titleMap ? titleMap.get(pid) : '') || `文章 ${pid}`,
        questions: [],
      });
    }
    day.passages.get(pid).questions.push(r);
  }

  const result = [];
  for (const [date, day] of map) {
    const passages = Array.from(day.passages.values());
    for (const p of passages) {
      p.questions.sort((a, b) =>
        String(a.questionId || '').localeCompare(String(b.questionId || ''))
      );
    }
    const allQs = passages.reduce((acc, p) => acc.concat(p.questions), []);
    const graded = allQs.filter((q) => q.isCorrect === true || q.isCorrect === false);
    const correct = graded.filter((q) => q.isCorrect).length;
    const wrong = graded.length - correct;
    const accuracy =
      graded.length > 0 ? Math.round((correct / graded.length) * 100) : null;
    result.push({
      date,
      passageCount: passages.length,
      passages,
      totalQuestions: allQs.length,
      gradedCount: graded.length,
      correctCount: correct,
      wrongCount: wrong,
      accuracy,
    });
  }
  result.sort((a, b) => b.date.localeCompare(a.date));
  return result;
}

function renderDayDetail(g) {
  let html = `<div class="record-detail">`;
  for (const p of g.passages) {
    html += `<div class="detail-passage">
      <div class="passage-title">${escapeHtml(p.passageTitle)}
        <span class="passage-q-count">(${p.questions.length} 题)</span>
      </div>
      <div class="question-list">`;
    for (const q of p.questions) {
      const skill = SKILLS.find((s) => s.id === q.skill);
      const skillName = skill ? skill.name : q.skill || '?';
      let result = '—';
      let resultClass = 'q-skip';
      if (q.isCorrect === true) {
        result = '对';
        resultClass = 'q-correct';
      } else if (q.isCorrect === false) {
        result = '错';
        resultClass = 'q-wrong';
      }
      const stem = q.stem ? truncate(q.stem, 26) : `题目 ${q.questionId || ''}`;
      html += `<div class="question-row">
        <span class="q-skill">${escapeHtml(skillName)}</span>
        <span class="q-stem">${escapeHtml(stem)}</span>
        <span class="q-result ${resultClass}">${result}</span>
      </div>`;
    }
    html += `</div></div>`;
  }
  html += `</div>`;
  return html;
}

async function renderRecordsTab(container) {
  const records = await getAllRecords();
  if (!records || records.length === 0) {
    container.innerHTML = `<div class="empty-state">还没有做题记录。</div>`;
    return;
  }

  // 用题库补充文章标题
  const bank = await getLatestQuestionBank();
  const titleMap = new Map();
  if (bank && Array.isArray(bank.passages)) {
    for (const p of bank.passages) titleMap.set(p.id, p.title);
  }

  const groups = groupRecordsByDate(records, titleMap);

  let html = `<div class="record-list">`;
  for (const g of groups) {
    const acc = g.accuracy === null ? '—' : g.accuracy + '%';
    const accClass =
      g.accuracy === null ? '' : g.accuracy >= 75 ? 'acc-good' : g.accuracy >= 50 ? 'acc-mid' : 'acc-low';
    const expanded = state.expandedDate === g.date;
    html += `
      <div class="record-item card ${expanded ? 'expanded' : ''}" data-date="${escapeHtml(g.date)}">
        <div class="record-head">
          <div class="record-date">${escapeHtml(g.date)}</div>
          <div class="record-stats">
            <span>${g.passageCount} 篇</span>
            <span>对 ${g.correctCount} / 错 ${g.wrongCount}</span>
            <span class="record-acc ${accClass}">${acc}</span>
          </div>
          <span class="record-toggle">${expanded ? '收起' : '展开'}</span>
        </div>
        ${expanded ? renderDayDetail(g) : ''}
      </div>`;
  }
  html += `</div>`;
  container.innerHTML = html;

  container.querySelectorAll('.record-item').forEach((item) => {
    item.querySelector('.record-head').addEventListener('click', () => {
      const date = item.dataset.date;
      state.expandedDate = state.expandedDate === date ? null : date;
      renderRecordsTab(container);
    });
  });
}

/* ============ 趋势 Tab ============ */
function renderBadges(badges) {
  if (!badges || badges.length === 0) {
    return `<div class="badge-empty">还没有获得徽章</div>`;
  }
  return badges
    .map(
      (b) =>
        `<span class="badge-item" title="${escapeHtml(b.name)} ${escapeHtml(b.date || '')}">` +
        `${escapeHtml(b.icon || '🏆')} ${escapeHtml(b.name)}</span>`
    )
    .join('');
}

async function renderTrendTab(container) {
  const records = await getAllRecords();
  const gamification = await getGamification();
  const trendSVG = renderTrendSVG(records, 14);

  const graded = (records || []).filter(
    (r) => r.isCorrect === true || r.isCorrect === false
  );
  const correctCount = graded.filter((r) => r.isCorrect).length;
  const overallAcc =
    graded.length > 0 ? Math.round((correctCount / graded.length) * 100) : 0;

  container.innerHTML = `
    <div class="trend-container card">${trendSVG}</div>
    <div class="stats-grid">
      <div class="stat-card card">
        <div class="stat-num">${records ? records.length : 0}</div>
        <div class="stat-label">总做题数</div>
      </div>
      <div class="stat-card card">
        <div class="stat-num">${overallAcc}%</div>
        <div class="stat-label">总正确率</div>
      </div>
      <div class="stat-card card">
        <div class="stat-num">${gamification.streakDays || 0}</div>
        <div class="stat-label">连续打卡</div>
      </div>
    </div>
    <div class="card gamification-card">
      <div class="card-title">积分与成就</div>
      <div class="game-row"><span>总积分</span><span>${gamification.totalPoints || 0}</span></div>
      <div class="game-row"><span>连续天数</span><span>${gamification.streakDays || 0}</span></div>
      <div class="game-row"><span>已获徽章</span><span>${(gamification.badges || []).length} 个</span></div>
      <div class="badge-list">${renderBadges(gamification.badges || [])}</div>
    </div>
  `;
}

/* ============ 设置 Tab ============ */
async function renderSettingsTab(container, config) {
  const bank = await getLatestQuestionBank();
  const bankVersion = bank ? bank.version : '无';

  container.innerHTML = `
    <div class="settings-group card">
      <div class="card-title">训练设置</div>
      <div class="setting-row">
        <label for="setDailyTarget">每日篇数</label>
        <select id="setDailyTarget">
          ${[1, 2, 3]
            .map(
              (v) =>
                `<option value="${v}" ${config.dailyTarget === v ? 'selected' : ''}>${v} 篇</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="setting-row">
        <label for="setRestInterval">篇间休息</label>
        <label class="switch">
          <input type="checkbox" id="setRestInterval" ${config.restInterval ? 'checked' : ''}/>
          <span class="slider"></span>
        </label>
      </div>
      <div class="setting-row">
        <label for="setMaxDifficulty">难度上限</label>
        <select id="setMaxDifficulty">
          ${[1, 2, 3]
            .map(
              (v) =>
                `<option value="${v}" ${config.maxDifficulty === v ? 'selected' : ''}>${v}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="setting-row">
        <label for="setFontSize">字号</label>
        <select id="setFontSize">
          <option value="normal" ${config.fontSize === 'normal' ? 'selected' : ''}>标准</option>
          <option value="large" ${config.fontSize === 'large' ? 'selected' : ''}>大</option>
          <option value="xlarge" ${config.fontSize === 'xlarge' ? 'selected' : ''}>超大</option>
        </select>
      </div>
    </div>

    <div class="settings-group card">
      <div class="card-title">家长口令</div>
      <div class="setting-row">
        <input id="setPin" type="text" inputmode="numeric" maxlength="4"
               value="${escapeHtml(config.parentPin || '')}" placeholder="4 位数字"/>
        <button class="btn btn-secondary small-btn" id="savePin">修改</button>
      </div>
    </div>

    <div class="settings-group card">
      <div class="card-title">题库管理</div>
      <div class="setting-row">
        <label>当前版本</label>
        <span class="bank-version">${escapeHtml(bankVersion)}</span>
      </div>
      <div class="setting-row">
        <label for="setUpdateSource">更新源</label>
        <input id="setUpdateSource" type="text"
               value="${escapeHtml(config.updateSource || '')}" placeholder="https://..."/>
        <button class="btn btn-secondary small-btn" id="saveSource">保存</button>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary small-btn" id="checkUpdate">检查更新</button>
        <button class="btn btn-secondary small-btn" id="exportData">导出数据</button>
        <button class="btn btn-secondary small-btn" id="importData">导入数据</button>
        <input type="file" id="importFile" accept="application/json" class="hidden"/>
      </div>
      <div id="updateStatus" class="update-status"></div>
    </div>
  `;

  const statusEl = container.querySelector('#updateStatus');

  // 每日篇数
  container.querySelector('#setDailyTarget').addEventListener('change', async (e) => {
    config.dailyTarget = parseInt(e.target.value, 10);
    await saveConfig(config);
    flashSaved(statusEl, '已保存');
  });
  // 篇间休息
  container.querySelector('#setRestInterval').addEventListener('change', async (e) => {
    config.restInterval = e.target.checked;
    await saveConfig(config);
    flashSaved(statusEl, '已保存');
  });
  // 难度上限
  container.querySelector('#setMaxDifficulty').addEventListener('change', async (e) => {
    config.maxDifficulty = parseInt(e.target.value, 10);
    await saveConfig(config);
    flashSaved(statusEl, '已保存');
  });
  // 字号
  container.querySelector('#setFontSize').addEventListener('change', async (e) => {
    config.fontSize = e.target.value;
    await saveConfig(config);
    applyFontSize(config.fontSize);
    flashSaved(statusEl, '已保存');
  });
  // 口令
  container.querySelector('#savePin').addEventListener('click', async () => {
    const v = container.querySelector('#setPin').value.trim();
    if (!/^\d{4}$/.test(v)) {
      statusEl.textContent = '口令需为 4 位数字';
      return;
    }
    config.parentPin = v;
    await saveConfig(config);
    flashSaved(statusEl, '口令已修改');
  });
  // 更新源
  container.querySelector('#saveSource').addEventListener('click', async () => {
    config.updateSource = container.querySelector('#setUpdateSource').value.trim();
    await saveConfig(config);
    flashSaved(statusEl, '更新源已保存');
  });
  // 检查更新
  container.querySelector('#checkUpdate').addEventListener('click', async () => {
    const source =
      container.querySelector('#setUpdateSource').value.trim() || config.updateSource;
    await handleCheckUpdate(container, statusEl, source);
  });
  // 导出
  container.querySelector('#exportData').addEventListener('click', () => exportData());
  // 导入
  const importBtn = container.querySelector('#importData');
  const importFile = container.querySelector('#importFile');
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await importData(file, statusEl);
    const newConfig = await getConfig();
    await renderSettingsTab(container, newConfig);
  });
}

/* ============ 检查更新流程 ============ */
async function handleCheckUpdate(container, statusEl, source) {
  statusEl.textContent = '正在检查更新…';
  const result = await checkForUpdates(source);
  if (!result.hasUpdate) {
    statusEl.textContent = result.reason || '已是最新版本';
    return;
  }
  statusEl.textContent = `发现新版本 ${result.newVersion}，正在下载…`;
  const dl = await downloadUpdate(result.manifest, source);
  if (dl.success) {
    statusEl.textContent = `已更新到 ${dl.version}`;
    // 重新拉取配置并刷新设置页以显示新版本号
    const newConfig = await getConfig();
    await renderSettingsTab(container, newConfig);
  } else {
    statusEl.textContent = '更新失败：' + (dl.reason || '未知错误');
  }
}

/* ============ 导出 / 导入数据 ============ */
async function exportData() {
  const [profile, records, gamification, config] = await Promise.all([
    getProfile(),
    getAllRecords(),
    getGamification(),
    getConfig(),
  ]);
  const data = {
    _app: 'reading-trainer',
    _version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    records,
    gamification,
    config,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reading-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function importData(file, statusEl) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || data._app !== 'reading-trainer') {
      statusEl.textContent = '文件格式不正确';
      return false;
    }

    if (data.config) await saveConfig(data.config);
    if (data.profile) await saveProfile(data.profile);
    if (data.gamification) await saveGamification(data.gamification);
    if (Array.isArray(data.records)) {
      for (const r of data.records) {
        if (r && r.recordId) await addRecord(r);
      }
    }
    statusEl.textContent = '导入成功';
    return true;
  } catch (e) {
    statusEl.textContent = '导入失败：' + (e && e.message ? e.message : String(e));
    return false;
  }
}
