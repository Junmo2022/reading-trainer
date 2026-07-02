// js/router.js
// 极简 hash 路由：以 #/path?param=value 的形式承载路由与参数。

const routes = new Map();

/**
 * 注册一条路由。
 * @param {string} path 形如 '/' '/diagnosis' '/train'
 * @param {(el: HTMLElement, params: Object) => void|Promise} handler
 */
export function register(path, handler) {
  routes.set(path, handler);
}

/**
 * 带参数导航。参数会被序列化成 query string 拼到 hash 后面。
 * @param {string} path
 * @param {Object} [params] 键值对
 */
export function navigate(path, params = {}) {
  let hash = path || '/';
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  if (entries.length) {
    const sp = new URLSearchParams();
    for (const [k, v] of entries) sp.set(k, String(v));
    const qs = sp.toString();
    if (qs) hash += (hash.includes('?') ? '&' : '?') + qs;
  }
  if (location.hash === '#' + hash) {
    // hash 没变化时手动触发一次渲染
    renderRoute();
  } else {
    location.hash = hash;
  }
}

/**
 * 从当前 location.hash 解析出 path 与 params。
 * @returns {{path: string, params: Object}}
 */
export function getParams() {
  let hash = location.hash.slice(1) || '/';
  const qIdx = hash.indexOf('?');
  let path = hash;
  let query = '';
  if (qIdx >= 0) {
    path = hash.slice(0, qIdx);
    query = hash.slice(qIdx + 1);
  }
  if (!path) path = '/';
  const params = {};
  if (query) {
    const sp = new URLSearchParams(query);
    for (const [k, v] of sp.entries()) params[k] = v;
  }
  return { path, params };
}

/**
 * 渲染当前路由对应的视图。
 */
async function renderRoute() {
  const { path, params } = getParams();
  const app = document.getElementById('app');
  if (!app) return;
  const handler = routes.get(path);
  if (handler) {
    try {
      await handler(app, params);
    } catch (err) {
      console.error('路由渲染失败:', path, err);
      app.innerHTML =
        '<div class="error-page"><div class="error-emoji">😵</div><p>页面加载出错了</p></div>';
    }
  } else {
    app.innerHTML =
      '<div class="error-page"><div class="error-emoji">🧭</div><p>找不到这个页面</p></div>';
  }
}

/**
 * 启动路由：监听 hashchange 并执行首次渲染。
 */
export function startRouter() {
  window.addEventListener('hashchange', renderRoute);
  renderRoute();
}
