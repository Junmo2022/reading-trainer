// js/child-ui.js
// 孩子端完整 UI 逻辑：诊断引导、诊断流程、主界面、训练流程、完成页。
// 答题渲染（选择题/填空题/简答题）在诊断与训练中复用。

import {
  getLatestQuestionBank,
  getPlan,
  savePlan,
  getProfile,
  saveProfile,
  getGamification,
  saveGamification,
  getConfig,
  addRecord,
} from './store.js';
import { SKILLS, createEmptyProfile, updateMastery } from './skills.js';
import { selectDiagnosisPassages, computeInitialProfile } from './diagnoser.js';
import { generateDailyPlan } from './scheduler.js';
import { awardPoints, updateStreak, checkBadges } from './rewards.js';
import { navigate } from './router.js';

/* ------------------------------------------------------------------ */
/* 工具函数                                                            */
/* ------------------------------------------------------------------ */

const today = () => new Date().toISOString().slice(0, 10);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 把短文按段落包成 <p> */
function formatPassageText(text) {
  return String(text || '')
    .split('\n')
    .filter((p) => p.trim() !== '')
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
}

/** 答案归一化：去掉所有空白后比较，用于填空题判分 */
function normalizeAnswer(s) {
  return String(s == null ? '' : s).replace(/\s+/g, '');
}

/** 依据 config.fontSize 取得短文区附加 class */
function fontSizeClass(fontSize) {
  if (fontSize === 'large') return ' large';
  if (fontSize === 'xlarge') return ' xlarge';
  return '';
}

/** 等级文案 */
function levelText(level) {
  return (
    { unknown: '尚未评估', basic: '起步阶段', developing: '发展中', proficient: '掌握良好' }[
      level
    ] || '尚未评估'
  );
}

/* ------------------------------------------------------------------ */
/* 诊断引导页                                                          */
/* ------------------------------------------------------------------ */

export function renderDiagnosisIntro(el) {
  el.innerHTML = `
    <div class="diagnosis-intro">
      <div class="intro-emoji">👋</div>
      <h2 class="intro-title">欢迎来到阅读训练营</h2>
      <p class="intro-desc">先来做一个小测试，了解一下你的阅读水平。一共 3 篇短文，每篇读完后答几道题。不用紧张，慢慢读，当作一次小练习就好。</p>
      <ul class="intro-tips">
        <li>认真读完短文，再开始答题</li>
        <li>答完后会看到讲解，帮助你学习</li>
        <li>大约需要 10～15 分钟</li>
      </ul>
      <button class="btn btn-primary intro-start-btn" id="diagnosis-start">开始诊断</button>
    </div>
  `;
  document.getElementById('diagnosis-start').addEventListener('click', () => {
    navigate('/diagnosis');
  });
}

/* ------------------------------------------------------------------ */
/* 诊断流程                                                            */
/* ------------------------------------------------------------------ */

export async function renderDiagnosis(el) {
  const bank = await getLatestQuestionBank('chinese');
  const config = await getConfig();

  if (!bank || !bank.passages || bank.passages.length === 0) {
    renderEmptyState(el, '题库还没有准备好', '请稍后再来', true);
    return;
  }

  const passages = selectDiagnosisPassages(bank);
  if (passages.length === 0) {
    renderEmptyState(el, '暂无可用的诊断短文', '请稍后再来', true);
    return;
  }

  const ctx = {
    mode: 'diagnosis',
    passages,
    passageIdx: 0,
    questionIdx: 0,
    phase: 'reading',
    lastAnswer: null,
    submitting: false,
    questionStartTime: Date.now(),
    correctCount: 0,
    totalCount: 0,
    passageCorrect: 0,
    passageTotal: 0,
    results: [], // 供 computeInitialProfile 使用：{skill, isCorrect, difficulty}
    profile: createEmptyProfile('chinese'),
    config,
    bank,
    plan: null,
    fontSize: config.fontSize,
  };

  enterPassage(el, ctx);
}

/* ------------------------------------------------------------------ */
/* 孩子主界面                                                          */
/* ------------------------------------------------------------------ */

export async function renderChildHome(el, profile, gamification, config) {
  const todayStr = today();
  const plan = await getPlan(todayStr);
  let doneCount = 0;
  if (plan && Array.isArray(plan.sessions)) {
    doneCount = plan.sessions.filter((s) => s.completed).length;
  }
  const dailyTarget = config.dailyTarget || 2;
  const totalSessions = plan && plan.sessions.length ? plan.sessions.length : dailyTarget;
  const progressPct = totalSessions > 0 ? Math.min(100, (doneCount / totalSessions) * 100) : 0;
  const allDone = !!plan && plan.sessions.length > 0 && doneCount >= plan.sessions.length;

  const badges = (gamification && gamification.badges) || [];
  let badgesHtml;
  if (badges.length) {
    badgesHtml = '<div class="home-badges">';
    for (const b of badges) {
      badgesHtml += `<div class="badge-item">
        <div class="badge-icon">${escapeHtml(b.icon)}</div>
        <div class="badge-name">${escapeHtml(b.name)}</div>
      </div>`;
    }
    badgesHtml += '</div>';
  } else {
    badgesHtml =
      '<div class="home-badges empty"><span class="badges-empty-hint">还没有徽章，加油获得第一个吧！</span></div>';
  }

  el.innerHTML = `
    <div class="child-home">
      <div class="home-streak">
        <span class="streak-icon">🔥</span>
        <span class="streak-text">连续打卡 <b>${gamification.streakDays || 0}</b> 天</span>
      </div>

      <div class="home-progress card">
        <div class="progress-label">今日进度 ${doneCount} / ${totalSessions}</div>
        <div class="progress-bar"><div style="width:${progressPct}%"></div></div>
      </div>

      <button class="start-button" id="start-train">${allDone ? '今日已完成' : '开始训练'}</button>

      <div class="home-points card">
        <div class="points-icon">⭐</div>
        <div class="points-info">
          <div class="points-num">${gamification.totalPoints || 0}</div>
          <div class="points-label">总积分</div>
        </div>
      </div>

      <div class="home-badges-title">我的徽章（${badges.length}）</div>
      ${badgesHtml}

      <button class="btn btn-secondary parent-entry" id="parent-entry">家长入口</button>
    </div>
  `;

  document.getElementById('start-train').addEventListener('click', async () => {
    if (allDone) {
      navigate('/train');
      return;
    }
    const btn = document.getElementById('start-train');
    btn.disabled = true;
    const origin = btn.textContent;
    btn.textContent = '准备中…';
    try {
      await startTraining({ profile, config });
    } catch (e) {
      console.error('生成训练计划失败:', e);
      btn.disabled = false;
      btn.textContent = origin;
      alert('生成训练计划失败，请重试');
    }
  });

  document.getElementById('parent-entry').addEventListener('click', () => {
    navigate('/parent');
  });
}

/** 主界面点击「开始训练」时生成或复用今日计划，再跳到训练页 */
async function startTraining({ profile, config }) {
  const bank = await getLatestQuestionBank('chinese');
  const todayStr = today();
  let plan = await getPlan(todayStr);
  const doneToday = [];
  if (plan && Array.isArray(plan.sessions)) {
    plan.sessions.forEach((s) => {
      if (s.completed) doneToday.push(s.passageId);
    });
  }
  const incompleteCount = plan ? plan.sessions.filter((s) => !s.completed).length : 0;
  if (!plan || incompleteCount === 0) {
    plan = generateDailyPlan(profile, bank, config.dailyTarget || 2, doneToday);
    await savePlan(plan);
  }
  navigate('/train');
}

/* ------------------------------------------------------------------ */
/* 训练页                                                              */
/* ------------------------------------------------------------------ */

export async function renderReader(el, params) {
  const bank = await getLatestQuestionBank('chinese');
  const plan = await getPlan(today());
  const profile = (await getProfile('chinese')) || createEmptyProfile('chinese');
  const gamification = await getGamification();
  const config = await getConfig();

  if (!plan || !plan.sessions || plan.sessions.length === 0) {
    renderEmptyState(el, '今天还没有训练计划', '回到首页点「开始训练」即可生成', true);
    return;
  }

  const incomplete = plan.sessions.filter((s) => !s.completed);
  if (incomplete.length === 0) {
    renderEmptyState(el, '今天的训练已经完成啦！', '真棒，明天继续加油～', true);
    return;
  }

  const passages = incomplete
    .map((s) => bank.passages.find((p) => p.id === s.passageId))
    .filter(Boolean);

  if (passages.length === 0) {
    renderEmptyState(el, '没有找到可训练的短文', '请稍后再来', true);
    return;
  }

  const ctx = {
    mode: 'train',
    passages,
    passageIdx: 0,
    questionIdx: 0,
    phase: 'reading',
    lastAnswer: null,
    submitting: false,
    questionStartTime: Date.now(),
    correctCount: 0,
    totalCount: 0,
    passageCorrect: 0,
    passageTotal: 0,
    results: [],
    profile,
    gamification,
    config,
    bank,
    plan,
    fontSize: config.fontSize,
    newBadges: [],
    pointsEarned: 0,
  };

  enterPassage(el, ctx);
}

/* ------------------------------------------------------------------ */
/* 完成页：简单跳回首页                                                  */
/* ------------------------------------------------------------------ */

export function renderComplete(el) {
  navigate('/');
}

/* ------------------------------------------------------------------ */
/* 共享：进入一篇短文（渲染阅读视图）                                     */
/* ------------------------------------------------------------------ */

function enterPassage(el, ctx) {
  ctx.phase = 'reading';
  ctx.questionIdx = 0;
  ctx.lastAnswer = null;
  ctx.submitting = false;
  ctx.passageCorrect = 0;
  ctx.passageTotal = 0;
  ctx.questionStartTime = Date.now();
  renderReaderView(el, ctx);
}

function renderReaderView(el, ctx) {
  const passage = ctx.passages[ctx.passageIdx];
  const fSizeClass = fontSizeClass(ctx.fontSize);
  const totalQ = passage.questions.length;
  const headerTitle =
    ctx.mode === 'diagnosis'
      ? `阅读诊断 ${ctx.passageIdx + 1}/${ctx.passages.length}`
      : passage.title;

  el.innerHTML = `
    <div class="reader-view">
      <header class="reader-header">
        <button class="reader-back" id="reader-back" aria-label="返回">‹</button>
        <div class="reader-title">${escapeHtml(headerTitle)}</div>
        <div class="reader-progress" id="reader-progress">0/${totalQ}</div>
      </header>
      <div class="passage-content${fSizeClass}" id="passage-content">
        <h2 class="passage-title">${escapeHtml(passage.title)}</h2>
        <div class="passage-meta">${escapeHtml(passage.genre || '')} · ${passage.wordCount || ''}字 · ${passage.grade}年级</div>
        <div class="passage-text">${formatPassageText(passage.content)}</div>
      </div>
      <div class="quiz-area" id="quiz-area"></div>
    </div>
  `;

  document.getElementById('reader-back').addEventListener('click', () => {
    // 已完成的题目记录/画像都已落库，直接回首页即可
    navigate('/');
  });

  updateQuiz(el, ctx);
}

/** 只更新答题区与进度，保留短文滚动位置 */
function updateQuiz(el, ctx) {
  const passage = ctx.passages[ctx.passageIdx];
  const progressEl = document.getElementById('reader-progress');
  if (progressEl) progressEl.textContent = `${ctx.passageTotal}/${passage.questions.length}`;

  const quizArea = document.getElementById('quiz-area');
  if (!quizArea) return;

  if (ctx.phase === 'reading') {
    renderQuizStart(quizArea, passage, ctx, el);
  } else if (ctx.phase === 'question') {
    renderQuestionInto(quizArea, passage, passage.questions[ctx.questionIdx], ctx, el);
  }
}

/* ------------------------------------------------------------------ */
/* 阅读区 -> 开始答题按钮                                               */
/* ------------------------------------------------------------------ */

function renderQuizStart(quizArea, passage, ctx, el) {
  quizArea.innerHTML = `
    <div class="quiz-start">
      <p class="quiz-start-hint">认真读一读上面的短文，读完后点按钮开始答题。</p>
      <button class="btn btn-primary quiz-start-btn" id="quiz-start-btn">读完了，开始答题</button>
    </div>
  `;
  document.getElementById('quiz-start-btn').addEventListener('click', () => {
    ctx.phase = 'question';
    ctx.questionIdx = 0;
    ctx.questionStartTime = Date.now();
    updateQuiz(el, ctx);
  });
}

/* ------------------------------------------------------------------ */
/* 单题渲染：选择题 / 填空题 / 简答题                                    */
/* ------------------------------------------------------------------ */

function renderQuestionInto(quizArea, passage, question, ctx, el) {
  const answered = !!ctx.lastAnswer;
  const skill = SKILLS.find((s) => s.id === question.skill);
  const skillName = skill ? skill.name : question.skill;

  let html = `
    <div class="question-card">
      <div class="question-meta">
        <span class="skill-tag">${escapeHtml(skillName)}</span>
        <span class="diff-dots">${'★'.repeat(question.difficulty || 1)}</span>
      </div>
      <div class="question-stem">${escapeHtml(question.stem)}</div>
  `;

  if (question.type === 'choice') {
    const correctIdx = 'ABCD'.indexOf(question.answer);
    html += '<div class="options">';
    (question.options || []).forEach((opt, i) => {
      const letter = 'ABCD'[i];
      let cls = 'option';
      if (answered) {
        if (i === correctIdx) cls += ' correct';
        else if (ctx.lastAnswer.selectedIdx === i) cls += ' wrong';
      }
      html += `<button class="${cls}" data-idx="${i}" ${answered ? 'disabled' : ''}>
        <span class="option-letter">${letter}</span>
        <span class="option-text">${escapeHtml(opt)}</span>
      </button>`;
    });
    html += '</div>';
  } else if (question.type === 'fill') {
    html += '<div class="fill-input-wrap">';
    if (answered) {
      html += `<div class="fill-answer-display">你的答案：${escapeHtml(ctx.lastAnswer.userAnswer)}</div>`;
    } else {
      html += `<input type="text" class="fill-input" id="fill-input" placeholder="在这里填写答案" autocomplete="off" autocapitalize="off">`;
    }
    html += '</div>';
  } else {
    // 简答题 short
    html += '<div class="short-input-wrap">';
    if (answered) {
      html += `<div class="short-answer-display">你的回答：${escapeHtml(ctx.lastAnswer.userAnswer)}</div>`;
    } else {
      html += `<textarea class="short-input" id="short-input" placeholder="在这里写下你的回答" rows="4"></textarea>`;
    }
    html += '</div>';
  }

  if (!answered) {
    html += `<button class="btn btn-primary submit-btn" id="submit-btn">提交答案</button>`;
  } else {
    html += renderFeedbackCard(question, ctx.lastAnswer);
    const isLast = ctx.questionIdx >= passage.questions.length - 1;
    html += `<button class="btn btn-primary next-btn" id="next-btn">${isLast ? '完成本篇' : '下一题'}</button>`;
  }

  html += '</div>';
  quizArea.innerHTML = html;

  if (!answered) {
    if (question.type === 'choice') {
      quizArea.querySelectorAll('.option').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          submitAnswer(el, passage, question, ctx, idx, null);
        });
      });
    } else if (question.type === 'fill') {
      const input = quizArea.querySelector('#fill-input');
      const submitBtn = quizArea.querySelector('#submit-btn');
      const doSubmit = () => {
        const val = input.value;
        if (!val.trim()) {
          input.classList.add('input-error');
          input.placeholder = '请先填写答案再提交';
          return;
        }
        submitAnswer(el, passage, question, ctx, null, val);
      };
      submitBtn.addEventListener('click', doSubmit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doSubmit();
        }
      });
    } else {
      const input = quizArea.querySelector('#short-input');
      const submitBtn = quizArea.querySelector('#submit-btn');
      submitBtn.addEventListener('click', () => {
        const val = input.value;
        if (!val.trim()) {
          input.classList.add('input-error');
          input.placeholder = '请先写下回答再提交';
          return;
        }
        submitAnswer(el, passage, question, ctx, null, val);
      });
    }
  } else {
    quizArea.querySelector('#next-btn').addEventListener('click', () => {
      advanceQuestion(el, passage, ctx);
    });
  }
}

/** 反馈卡：correct 绿 / wrong 红 / neutral 蓝；含讲解与关键句 */
function renderFeedbackCard(question, lastAnswer) {
  const isCorrect = lastAnswer.isCorrect;
  let stateClass = 'neutral';
  let title = '参考一下';
  if (isCorrect === true) {
    stateClass = 'correct';
    title = '答对了！';
  } else if (isCorrect === false) {
    stateClass = 'wrong';
    title = '答错了';
  }

  let html = `<div class="feedback-card ${stateClass}">
    <div class="feedback-title">${title}</div>`;

  if (question.type === 'choice') {
    const correctIdx = 'ABCD'.indexOf(question.answer);
    html += `<div class="feedback-answer"><span class="feedback-label">正确答案：</span>${escapeHtml(
      'ABCD'[correctIdx]
    )}. ${escapeHtml(question.options[correctIdx])}</div>`;
  } else if (question.type === 'fill') {
    html += `<div class="feedback-answer"><span class="feedback-label">正确答案：</span>${escapeHtml(
      question.answer
    )}</div>`;
  } else {
    html += `<div class="feedback-answer"><span class="feedback-label">参考答案：</span>${escapeHtml(
      question.answer
    )}</div>`;
  }

  html += `<div class="feedback-explanation"><span class="feedback-label">讲解：</span>${escapeHtml(
    question.explanation || ''
  )}</div>`;

  if (question.key_quote) {
    html += `<div class="feedback-keyquote"><span class="feedback-label">原文关键句：</span>${escapeHtml(
      question.key_quote
    )}</div>`;
  }

  html += '</div>';
  return html;
}

/* ------------------------------------------------------------------ */
/* 提交答案 -> 判分 -> 落记录 -> 更新画像                                 */
/* ------------------------------------------------------------------ */

async function submitAnswer(el, passage, question, ctx, selectedIdx, textAnswer) {
  if (ctx.submitting) return;
  ctx.submitting = true;

  let userAnswer = '';
  let isCorrect = null;

  if (question.type === 'choice') {
    userAnswer = 'ABCD'[selectedIdx];
    const correctIdx = 'ABCD'.indexOf(question.answer);
    isCorrect = selectedIdx === correctIdx;
    ctx.lastAnswer = { userAnswer, isCorrect, selectedIdx };
  } else if (question.type === 'fill') {
    userAnswer = (textAnswer || '').trim();
    isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(question.answer);
    ctx.lastAnswer = { userAnswer, isCorrect };
  } else {
    // 简答题不判对错
    userAnswer = (textAnswer || '').trim();
    isCorrect = null;
    ctx.lastAnswer = { userAnswer, isCorrect };
  }

  try {
    await recordAnswer(passage, question, ctx, userAnswer, isCorrect);
  } catch (e) {
    console.warn('记录答案失败:', e);
  }

  ctx.submitting = false;
  updateQuiz(el, ctx);
}

/** 创建 record 并落库；按模式更新画像 / 收集诊断结果 */
async function recordAnswer(passage, question, ctx, userAnswer, isCorrect) {
  const durationSec = Math.max(1, Math.round((Date.now() - ctx.questionStartTime) / 1000));
  const record = {
    recordId: uid(),
    date: today(),
    passageId: passage.id,
    questionId: question.id,
    skill: question.skill,
    userAnswer,
    isCorrect,
    durationSec,
    showedExplanation: true,
  };
  await addRecord(record);

  ctx.passageTotal += 1;
  ctx.totalCount += 1;
  if (isCorrect) {
    ctx.passageCorrect += 1;
    ctx.correctCount += 1;
  }

  if (ctx.mode === 'diagnosis') {
    // 收集结果，待全部完成后用 computeInitialProfile 一次性生成初始画像
    ctx.results.push({
      skill: question.skill,
      isCorrect,
      difficulty: question.difficulty,
    });
  } else {
    // 训练模式：每题即时更新画像并落库（简答题 isCorrect=null 也会传入）
    ctx.profile = updateMastery(ctx.profile, question.skill, isCorrect, question.difficulty);
    await saveProfile(ctx.profile);
  }
}

/* ------------------------------------------------------------------ */
/* 进入下一题 / 一篇完成                                                 */
/* ------------------------------------------------------------------ */

function advanceQuestion(el, passage, ctx) {
  ctx.questionIdx += 1;
  ctx.lastAnswer = null;
  ctx.submitting = false;

  if (ctx.questionIdx >= passage.questions.length) {
    onPassageDone(el, ctx);
  } else {
    ctx.questionStartTime = Date.now();
    updateQuiz(el, ctx);
  }
}

async function onPassageDone(el, ctx) {
  // 训练模式：标记该 session 完成
  if (ctx.mode === 'train' && ctx.plan) {
    const passageId = ctx.passages[ctx.passageIdx].id;
    const session = ctx.plan.sessions.find((s) => s.passageId === passageId);
    if (session) session.completed = true;
    try {
      await savePlan(ctx.plan);
    } catch (e) {
      console.warn('保存计划失败:', e);
    }
  }

  ctx.passageIdx += 1;

  if (ctx.passageIdx < ctx.passages.length) {
    // 还有下一篇 -> 篇间休息
    ctx.phase = 'break';
    renderBreakView(el, ctx);
  } else {
    // 全部完成
    ctx.phase = 'complete';
    await onAllComplete(el, ctx);
  }
}

/* ------------------------------------------------------------------ */
/* 篇间休息页                                                          */
/* ------------------------------------------------------------------ */

function renderBreakView(el, ctx) {
  const showCountdown = !!(ctx.config && ctx.config.restInterval);
  el.innerHTML = `
    <div class="break-view">
      <div class="break-emoji">🌿</div>
      <h2 class="break-title">休息一下</h2>
      <p class="break-stat">这一篇你做对了 ${ctx.passageCorrect} / ${ctx.passageTotal} 道</p>
      ${showCountdown ? '<div class="break-countdown" id="break-countdown">60</div>' : ''}
      <button class="btn btn-primary" id="break-continue">继续下一篇</button>
    </div>
  `;

  let timer = null;
  let countdown = 60;

  if (showCountdown) {
    const cdEl = document.getElementById('break-countdown');
    timer = setInterval(() => {
      countdown -= 1;
      if (cdEl) cdEl.textContent = String(countdown);
      if (countdown <= 0) {
        clearInterval(timer);
        timer = null;
        enterPassage(el, ctx);
      }
    }, 1000);
  }

  document.getElementById('break-continue').addEventListener('click', () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    enterPassage(el, ctx);
  });
}

/* ------------------------------------------------------------------ */
/* 全部完成：发放奖励 / 生成画像 -> 完成页                              */
/* ------------------------------------------------------------------ */

async function onAllComplete(el, ctx) {
  if (ctx.mode === 'diagnosis') {
    // 诊断结束：根据结果生成初始画像
    const initialProfile = computeInitialProfile(createEmptyProfile('chinese'), ctx.results);
    await saveProfile(initialProfile);
    ctx.diagnosisProfile = initialProfile;
    renderCompleteView(el, ctx);
  } else {
    // 训练结束：发放积分、更新连续打卡、检查徽章
    let g = ctx.gamification;
    const oldTotal = g.totalPoints || 0;
    const badgesBefore = new Set((g.badges || []).map((b) => b.id));

    g = awardPoints(g, ctx.correctCount, ctx.totalCount);
    g = updateStreak(g);

    const firstSession = !badgesBefore.has('first_complete');
    g = checkBadges(g, {
      firstSession,
      allCorrect: ctx.totalCount > 0 && ctx.correctCount === ctx.totalCount,
      totalQuestions: ctx.totalCount,
    });

    await saveGamification(g);

    ctx.gamification = g;
    ctx.pointsEarned = (g.totalPoints || 0) - oldTotal;
    ctx.newBadges = (g.badges || []).filter((b) => !badgesBefore.has(b.id));

    renderCompleteView(el, ctx);
  }
}

function renderCompleteView(el, ctx) {
  if (ctx.mode === 'diagnosis') {
    const profile = ctx.diagnosisProfile || {};
    const weakCount = (profile.weakSkills || []).length;
    const overall = levelText(profile.overallLevel);
    el.innerHTML = `
      <div class="complete-view">
        <div class="complete-emoji">🎯</div>
        <h2 class="complete-title">诊断完成！</h2>
        <p class="complete-subtitle">已为你生成专属学习画像</p>
        <div class="complete-stats">
          <div class="stat-card"><div class="stat-num">${ctx.correctCount}/${ctx.totalCount}</div><div class="stat-label">答对题数</div></div>
          <div class="stat-card"><div class="stat-num">${weakCount}</div><div class="stat-label">待加强技能</div></div>
        </div>
        <p class="complete-subtitle">当前水平：${escapeHtml(overall)}</p>
        <button class="btn btn-primary" id="complete-home">开始训练</button>
      </div>
    `;
  } else {
    const g = ctx.gamification || {};
    let badgesHtml = '';
    if (ctx.newBadges && ctx.newBadges.length) {
      badgesHtml = '<div class="new-badges"><div class="new-badges-title">🎉 解锁新徽章</div><div class="badges-list">';
      for (const b of ctx.newBadges) {
        badgesHtml += `<div class="badge-item"><div class="badge-icon">${escapeHtml(
          b.icon
        )}</div><div class="badge-name">${escapeHtml(b.name)}</div></div>`;
      }
      badgesHtml += '</div></div>';
    }
    el.innerHTML = `
      <div class="complete-view">
        <div class="complete-emoji">🏆</div>
        <h2 class="complete-title">太棒了！</h2>
        <p class="complete-subtitle">今天的训练完成啦</p>
        <div class="complete-stats">
          <div class="stat-card"><div class="stat-num">+${ctx.pointsEarned}</div><div class="stat-label">本次得分</div></div>
          <div class="stat-card"><div class="stat-num">${g.streakDays || 0}</div><div class="stat-label">连续天数</div></div>
          <div class="stat-card"><div class="stat-num">${g.totalPoints || 0}</div><div class="stat-label">总积分</div></div>
        </div>
        ${badgesHtml}
        <button class="btn btn-primary" id="complete-home">返回首页</button>
      </div>
    `;
  }
  document.getElementById('complete-home').addEventListener('click', () => navigate('/'));
}

/* ------------------------------------------------------------------ */
/* 空状态                                                              */
/* ------------------------------------------------------------------ */

function renderEmptyState(el, title, desc, withHome) {
  el.innerHTML = `
    <div class="empty-state">
      <div class="error-emoji">📚</div>
      <h2 style="font-size:20px;color:var(--color-text)">${escapeHtml(title)}</h2>
      <p>${escapeHtml(desc)}</p>
      ${withHome ? '<button class="btn btn-primary" id="empty-home">返回首页</button>' : ''}
    </div>
  `;
  if (withHome) {
    document.getElementById('empty-home').addEventListener('click', () => navigate('/'));
  }
}
