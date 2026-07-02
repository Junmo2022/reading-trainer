// js/updater.js — 题库更新机制
import {
  getLatestQuestionBank,
  getAllQuestionBanks,
  saveQuestionBank,
} from './store.js';

/**
 * 版本号比较：支持 "2026.07.001" 这类点分数字版本
 * @returns {number} 1 表示 a>b，-1 表示 a<b，0 表示相等
 */
export function compareVersions(a, b) {
  const pa = String(a || '').split('.');
  const pb = String(b || '').split('.');
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = parseInt(pa[i] || '0', 10) || 0;
    const nb = parseInt(pb[i] || '0', 10) || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * 将更新源解析为 manifest.json 的完整 URL
 * 支持传入：目录、目录+斜杠、或完整 manifest.json URL
 */
function resolveManifestUrl(updateSource) {
  let s = String(updateSource || '').trim();
  if (!s) return null;
  if (/\/manifest\.json$/.test(s)) return s;
  if (s.endsWith('/')) return s + 'manifest.json';
  return s + '/manifest.json';
}

/**
 * 将更新源解析为文件下载基址（去除末尾 manifest.json，并补斜杠）
 */
function resolveFileUrl(updateSource, file) {
  let s = String(updateSource || '').trim();
  s = s.replace(/\/manifest\.json$/, '');
  if (!s.endsWith('/')) s += '/';
  return s + file;
}

/**
 * 检查更新：fetch 远程 manifest.json，比对版本号
 * @param {string} updateSource 更新源（目录或 manifest.json 的 URL）
 * @returns {Promise<{hasUpdate:boolean, manifest?:object, currentVersion?:string, newVersion?:string, reason?:string}>}
 *
 * 注意：updateSource 为空或 fetch 失败时返回 {hasUpdate:false, reason:'...'}，不影响离线使用。
 */
export async function checkForUpdates(updateSource) {
  if (!updateSource || !String(updateSource).trim()) {
    return { hasUpdate: false, reason: '未配置更新源' };
  }

  const url = resolveManifestUrl(updateSource);
  let manifest;
  try {
    const resp = await fetch(url, { cache: 'no-cache' });
    if (!resp.ok) {
      return { hasUpdate: false, reason: `无法获取更新清单（HTTP ${resp.status}）` };
    }
    manifest = await resp.json();
  } catch (e) {
    return { hasUpdate: false, reason: '网络请求失败：' + (e && e.message ? e.message : String(e)) };
  }

  if (!manifest || !manifest.version) {
    return { hasUpdate: false, reason: '更新清单格式无效' };
  }

  const subject = manifest.subject || 'chinese';
  const current = await getLatestQuestionBank(subject);
  const currentVersion = current ? current.version : '';

  if (!currentVersion) {
    return {
      hasUpdate: true,
      manifest,
      currentVersion: '',
      newVersion: manifest.version,
      reason: '本地尚无题库',
    };
  }

  const cmp = compareVersions(manifest.version, currentVersion);
  return {
    hasUpdate: cmp > 0,
    manifest,
    currentVersion,
    newVersion: manifest.version,
    reason: cmp > 0 ? '' : '已是最新版本',
  };
}

/**
 * 下载更新：根据 manifest 下载题库包 JSON，校验 passageCount，调 saveQuestionBank 入库
 * @param {object} manifest 远程清单对象
 * @param {string} updateSource 更新源
 * @returns {Promise<{success:boolean, version?:string, reason?:string}>}
 */
export async function downloadUpdate(manifest, updateSource) {
  if (!manifest || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    return { success: false, reason: '更新清单中未包含文件列表' };
  }

  const version = manifest.version;
  let lastVersion = version;

  for (const file of manifest.files) {
    const url = resolveFileUrl(updateSource, file);
    let bank;
    try {
      const resp = await fetch(url, { cache: 'no-cache' });
      if (!resp.ok) {
        return { success: false, reason: `下载失败（HTTP ${resp.status}）` };
      }
      bank = await resp.json();
    } catch (e) {
      return { success: false, reason: '下载失败：' + (e && e.message ? e.message : String(e)) };
    }

    if (!bank || !Array.isArray(bank.passages)) {
      return { success: false, reason: '题库文件格式无效' };
    }

    // 校验篇数
    if (typeof manifest.passageCount === 'number') {
      if (bank.passages.length !== manifest.passageCount) {
        return {
          success: false,
          reason: `篇数校验失败（期望 ${manifest.passageCount}，实际 ${bank.passages.length}）`,
        };
      }
    }

    // 确保有版本号与学科字段
    if (!bank.version) bank.version = version;
    if (!bank.subject) bank.subject = manifest.subject || 'chinese';

    await saveQuestionBank(bank);
    lastVersion = bank.version;
  }

  return { success: true, version: lastVersion };
}

/**
 * 获取本地所有已入库的题库版本
 * @returns {Promise<Array>}
 */
export async function getVersions() {
  return await getAllQuestionBanks();
}
