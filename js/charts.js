// js/charts.js — 纯 SVG 图表（不引第三方库）
import { SKILLS, SKILL_IDS } from './skills.js';

/**
 * 六技能雷达图
 * @param {object} profile 当前画像，含 profile.skills[skillId].mastery (0-100)
 * @param {object|null} compareProfile 对比画像（初始诊断），结构同 profile；为 null 则不画
 * @returns {string} SVG 字符串
 */
export function renderRadarSVG(profile, compareProfile) {
  const size = 260;
  const center = 130;
  const maxRadius = 90;
  // 6 条轴线：从 -PI/2（正上方）开始，每 60 度一条
  const angles = SKILL_IDS.map((_, i) => -Math.PI / 2 + i * (Math.PI / 3));

  const numFmt = (n) => (Math.round(n * 100) / 100).toFixed(2);

  // 根据掌握度与轴索引计算顶点坐标
  const vertex = (mastery, i) => {
    const m = Math.max(0, Math.min(100, mastery || 0));
    const r = (m / 100) * maxRadius;
    return [center + r * Math.cos(angles[i]), center + r * Math.sin(angles[i])];
  };

  // 4 层网格圆
  let gridCircles = '';
  for (let layer = 1; layer <= 4; layer++) {
    const r = (layer / 4) * maxRadius;
    gridCircles +=
      `<circle cx="${center}" cy="${center}" r="${numFmt(r)}" fill="none" ` +
      `stroke="#E8E8E8" stroke-width="1"/>`;
    // 刻度数值
    const labelY = center - r + 3;
    gridCircles +=
      `<text x="${center + 2}" y="${labelY}" font-size="8" fill="#BBB">${layer * 25}</text>`;
  }

  // 6 条轴线
  let axisLines = '';
  for (let i = 0; i < 6; i++) {
    const [x, y] = vertex(100, i);
    axisLines +=
      `<line x1="${center}" y1="${center}" x2="${numFmt(x)}" y2="${numFmt(y)}" ` +
      `stroke="#E8E8E8" stroke-width="1"/>`;
  }

  // 技能名称标签（放在轴外端）
  let labels = '';
  const labelR = maxRadius + 20;
  for (let i = 0; i < 6; i++) {
    const lx = center + labelR * Math.cos(angles[i]);
    const ly = center + labelR * Math.sin(angles[i]);
    const skill = SKILLS[i] || { name: SKILL_IDS[i] };
    labels +=
      `<text x="${numFmt(lx)}" y="${numFmt(ly)}" text-anchor="middle" ` +
      `dominant-baseline="middle" font-size="12" fill="#666" font-weight="500">` +
      `${skill.name}</text>`;
  }

  // 对比画像（黄色虚线）
  let comparePoly = '';
  if (compareProfile && compareProfile.skills) {
    const cmpMasteries = SKILL_IDS.map(id => (compareProfile.skills[id] || {}).mastery || 0);
    const cmpPoints = cmpMasteries.map((m, i) => vertex(m, i));
    const cmpStr = cmpPoints.map(p => numFmt(p[0]) + ',' + numFmt(p[1])).join(' ');
    comparePoly =
      `<polygon points="${cmpStr}" fill="none" stroke="#FAAD14" ` +
      `stroke-width="1.5" stroke-dasharray="4 3" opacity="0.85"/>`;
    for (let i = 0; i < 6; i++) {
      const [x, y] = cmpPoints[i];
      comparePoly +=
        `<circle cx="${numFmt(x)}" cy="${numFmt(y)}" r="2.5" fill="#FAAD14"/>`;
    }
  }

  // 当前画像（蓝色填充）
  const masteries = SKILL_IDS.map(id => (profile && profile.skills ? (profile.skills[id] || {}).mastery || 0 : 0));
  const points = masteries.map((m, i) => vertex(m, i));
  const polygonStr = points.map(p => numFmt(p[0]) + ',' + numFmt(p[1])).join(' ');
  const currentPoly =
    `<polygon points="${polygonStr}" fill="rgba(74,144,217,0.25)" ` +
    `stroke="#4A90D9" stroke-width="2" stroke-linejoin="round"/>`;

  // 当前画像顶点圆点
  let dots = '';
  for (let i = 0; i < 6; i++) {
    const [x, y] = points[i];
    dots += `<circle cx="${numFmt(x)}" cy="${numFmt(y)}" r="3.5" fill="#4A90D9" stroke="#fff" stroke-width="1"/>`;
  }

  return (
    `<svg viewBox="0 0 ${size} ${size}" width="100%" height="auto" ` +
    `xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
    gridCircles + axisLines + comparePoly + currentPoly + dots + labels +
    `</svg>`
  );
}

/**
 * 近 N 天正确率折线图
 * @param {Array} records 做题记录数组，每条含 date、isCorrect(true/false/null)
 * @param {number} days 天数，默认 14
 * @returns {string} SVG 字符串；无数据时返回提示 HTML
 */
export function renderTrendSVG(records, days = 14) {
  const width = 320;
  const height = 160;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const safeDays = Math.max(2, Math.floor(days) || 14);
  const recordsArr = Array.isArray(records) ? records : [];

  // 按日期聚合：每天统计 isCorrect 不为 null 的正确率
  const byDate = new Map();
  for (const r of recordsArr) {
    if (!r || !r.date) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  }

  const today = new Date();
  const dayData = [];
  for (let i = safeDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const recs = byDate.get(dateStr) || [];
    const graded = recs.filter(r => r.isCorrect === true || r.isCorrect === false);
    const accuracy =
      graded.length > 0
        ? Math.round((graded.filter(r => r.isCorrect).length / graded.length) * 100)
        : null;
    dayData.push({ date: dateStr, accuracy, count: graded.length });
  }

  // 完全没有数据
  const hasData = dayData.some(d => d.accuracy !== null);
  if (!hasData) {
    return `<div class="trend-empty">暂无做题数据</div>`;
  }

  const numFmt = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const xStep = plotW / (safeDays - 1);
  const xOf = (i) => padL + i * xStep;
  const yOf = (acc) => padT + plotH - (acc / 100) * plotH;

  // Y 轴网格 + 刻度（0-100%，分 4 格）
  let yGrid = '';
  for (let i = 0; i <= 4; i++) {
    const acc = i * 25;
    const y = yOf(acc);
    yGrid +=
      `<line x1="${padL}" y1="${numFmt(y)}" x2="${width - padR}" y2="${numFmt(y)}" ` +
      `stroke="#EEEEEE" stroke-width="1"/>`;
    yGrid +=
      `<text x="${padL - 6}" y="${numFmt(y + 3)}" text-anchor="end" font-size="9" fill="#999">` +
      `${acc}%</text>`;
  }

  // X 轴日期标签：每 5 天标一个，并补上最后一天
  let xLabels = '';
  const labelIdx = new Set();
  for (let i = 0; i < safeDays; i += 5) labelIdx.add(i);
  labelIdx.add(safeDays - 1);
  for (const i of labelIdx) {
    const x = xOf(i);
    const dateLabel = dayData[i].date.slice(5); // MM-DD
    xLabels +=
      `<text x="${numFmt(x)}" y="${height - padB + 16}" text-anchor="middle" font-size="9" fill="#999">` +
      `${dateLabel}</text>`;
  }

  // 折线路径 + 圆点（无数据天不画点，折线跳过）
  let pathD = '';
  let dots = '';
  let started = false;
  for (let i = 0; i < safeDays; i++) {
    if (dayData[i].accuracy === null) {
      started = false; // 中断折线
      continue;
    }
    const x = xOf(i);
    const y = yOf(dayData[i].accuracy);
    pathD += (started ? ' L' : 'M') + numFmt(x) + ' ' + numFmt(y);
    started = true;
    dots += `<circle cx="${numFmt(x)}" cy="${numFmt(y)}" r="2.8" fill="#4A90D9" stroke="#fff" stroke-width="1"/>`;
  }

  return (
    `<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" ` +
    `xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">` +
    yGrid + xLabels +
    `<path d="${pathD}" fill="none" stroke="#4A90D9" stroke-width="2" ` +
    `stroke-linejoin="round" stroke-linecap="round"/>` +
    dots +
    `</svg>`
  );
}
