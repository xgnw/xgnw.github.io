'use strict';

/**
 * 今日热榜 —— 自建后端的「共享内核」
 * ---------------------------------------------------------------
 * 被两个宿主复用同一份取数 / 归一化 / 缓存逻辑：
 *   - worker.js  Cloudflare Worker（KV 持久化，公开部署）
 *   - server.js  本机 Node 服务（JSON 文件缓存，零依赖，本地即用）
 *
 * 只依赖 fetch / URL / AbortSignal —— Node 18+ 与 Workers 运行时都自带，
 * 所以两边都不需要装任何 npm 包。
 *
 * 设计要点：
 *   1. 上游不固定 —— 各家 DailyHot 实例随时会挂，所以「按顺序自动降级」，
 *      第一个返回可用数据的上游胜出，全挂则返回最后一条错误信息。
 *   2. 缓存命中就不打上游 —— /all 先读缓存，未过期直接返回；
 *      未命中才并发 fan-out 全部榜单并回写缓存。
 *   3. 部分失败不影响整体 —— 单个上游失败只丢这一个榜，其余照常返回。
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** 默认上游列表（env UPSTREAMS 可覆盖）。{n} 会被替换成榜单关键字。 */
const DEFAULT_UPSTREAMS = [
  'https://api-hot.imsyy.top/{n}',
  'https://dailyhot-api.rinne.tech/{n}',
  'https://api.pearktrue.cn/api/dailyhot/?type={n}',
  'https://dailyhot.hcol.top/{n}',
  'https://60s-api.viki.moe/v2/{n}',
];

/** tophub 图标前缀：榜单名对不上上游时，至少图标还在 */
const ICON_BASE = 'https://file.ipadown.com/tophub/assets/images/media/';

/** KV / 本地缓存都没数据时，用这份兜底清单（upstream 关键字取自 DailyHot 命名） */
const FALLBACK_SOURCES = [
  { name: '知乎热榜', upstream: 'zhihu', cat: '综合热榜', icon: 'zhihu.com.png_160x160.png' },
  { name: '微博热搜', upstream: 'weibo', cat: '综合热榜', icon: 's.weibo.com.png_160x160.png' },
  { name: '抖音总榜', upstream: 'douyin', cat: '影音娱乐', icon: 'douyin.com.png_160x160.png' },
  { name: '今日头条', upstream: 'toutiao', cat: '综合热榜', icon: 'toutiao.com.png_160x160.png' },
  { name: '百度实时热点', upstream: 'baidu', cat: '综合热榜', icon: 'baidu.com.png_160x160.png' },
  { name: '哔哩哔哩日榜', upstream: 'bilibili', cat: '影音娱乐', icon: 'bilibili.com.png_160x160.png' },
  { name: '虎扑步行街', upstream: 'hupu', cat: '游戏社区' },
  { name: 'AcFun 全站榜', upstream: 'acfun', cat: '游戏社区' },
  { name: '36 氪热榜', upstream: '36kr', cat: '科技资讯' },
  { name: '少数派热门', upstream: 'sspai', cat: '科技资讯' },
  { name: '澎湃新闻', upstream: 'pengpai', cat: '综合热榜' },
  { name: '掘金社区', upstream: 'juejin', cat: '技术社区' },
];

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

function fmtHot(n) {
  const v = Number(n);
  if (!v) return '';
  return v >= 1e8 ? (v / 1e8).toFixed(1) + '亿' : v >= 1e4 ? Math.round(v / 1e4) + '万' : String(v);
}

/** 由榜单名派生稳定 id，避免前端「已选榜单」在刷新后错位 */
function slugId(name) {
  let h = 0;
  const t = String(name || '');
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return 's' + h.toString(36);
}

function nowText() {
  return new Date().toLocaleString('zh-CN', { hour12: false });
}

/** 把任意形状的条目数组规整成 {rank,title,url,hot,img} */
function normItems(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const it = arr[i];
    if (!it) continue;
    const title = it.title || it.name || it.word || '';
    if (!title) continue;
    const raw = it.hot || it.hot_value || it.hotValue || it.hotValueText || it.desc || '';
    out.push({
      rank: it.rank || i + 1,
      title: String(title),
      url: it.url || it.link || it.href || '',
      // 上游给的数字（452311 这类）要转成「45万」，字符串原样保留
      hot: typeof raw === 'number' ? fmtHot(raw) : String(raw),
      img: it.img || it.image || it.cover || '',
    });
  }
  return out;
}

/** 从各种上游响应里抠出条目数组（DailyHot / 60s / 自定义接口都认） */
function extractList(j) {
  if (!j || typeof j !== 'object') throw new Error('上游响应不是 JSON 对象');
  if (Number(j.code) === 404 || /not found|404/i.test(String(j.message || ''))) throw new Error('上游无此榜单');
  const d = j.data;
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.data)) return d.data;
  if (d && Array.isArray(d.items)) return d.items;
  if (d && Array.isArray(d.list)) return d.list;
  if (Array.isArray(j.items)) return j.items;
  if (Array.isArray(j.list)) return j.list;
  throw new Error('上游响应里找不到条目数组');
}

/** 把上游响应（任何格式）变成前端认识的榜单对象 */
function normalizeUpstream(name, cat, j) {
  const items = normItems(extractList(j));
  if (!items.length) throw new Error('上游返回空列表');
  return { name: name, cat: cat || '', icon: '', url: '', items: items };
}

/**
 * 上游列表可能是字符串（Worker vars / 环境变量，逗号分隔）或数组（代码里写死），
 * 统一成数组，免得两边各踩一次 `.split is not a function`。
 */
function toBases(x) {
  if (!x) return DEFAULT_UPSTREAMS.slice();
  if (Array.isArray(x)) return x.map((s) => String(s).trim()).filter(Boolean);
  return String(x)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 上游模板 + 榜单关键字 -> 实际 URL */
function upstreamUrls(bases, name) {
  const safe = String(name || '').trim();
  if (!safe) throw new Error('榜单关键字为空');
  return bases.map(function (b) {
    const tpl = String(b).trim();
    if (tpl.indexOf('{n}') > -1) return tpl.replace('{n}', encodeURIComponent(safe));
    return tpl.replace(/\/?$/, '') + '/' + safe;
  });
}

/**
 * 上游节流：公开聚合接口（尤其 60s）对突发请求很敏感，
 * 并发一把会吃 429，导致本来能成功的榜也失败。所以两次上游请求之间至少隔 GAP。
 * 全局共享一个时间戳，跨榜单、跨上游都生效。
 */
const UP_GAP = 250; // 两次上游请求的最小间隔（毫秒）
let __lastUpstreamAt = 0;
function throttle() {
  const wait = UP_GAP - (Date.now() - __lastUpstreamAt);
  if (wait > 0) return new Promise((r) => setTimeout(r, wait));
  return Promise.resolve();
}

/** 按上游顺序降级：第一个可用就返回 */
async function fetchUpstream(bases, name, timeout) {
  const urls = upstreamUrls(bases, name);
  let last = '';
  for (const u of urls) {
    await throttle(); // 每次打上游前先让出 GAP，摊平突发流量
    __lastUpstreamAt = Date.now();
    try {
      const res = await fetch(u, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: timeout ? AbortSignal.timeout(timeout) : undefined,
      });
      if (!res.ok) {
        last = u + ' HTTP ' + res.status;
        continue;
      }
      const j = await res.json();
      const src = normalizeUpstream(name, '', j);
      src.__upstream = u;
      return { ok: true, source: src, url: u, error: '' };
    } catch (e) {
      last = u + ' ' + ((e && e.message) || e);
    }
  }
  return { ok: false, source: null, url: '', error: last || '上游全部不可用' };
}

/* ------------------------------------------------------------------ */
/* 榜单清单                                                             */
/* ------------------------------------------------------------------ */

/**
 * 决定本轮要抓哪些榜。
 * 优先级：env 显式配置 > KV/缓存里已有清单 > 内置兜底清单。
 */
function resolveSources(opts, cached) {
  if (opts.sources && opts.sources.length) {
    return opts.sources.map(function (s) {
      return {
        name: s.name,
        cat: s.cat || s.category || '',
        icon: s.icon || (s.upstream ? ICON_BASE + s.upstream + '.png_160x160.png' : ''),
        upstream: s.upstream || s.key || s.id || '',
      };
    });
  }
  // 优先用缓存里记下的「本轮完整清单」，否则第二次跑会越抓越少
  const fromList = (cached && cached.list) || [];
  const fromCache = fromList.length
    ? fromList
    : ((cached && cached.sources) || []).map(function (s) {
        return { name: s.name, cat: s.cat || '', icon: s.icon || '', upstream: s.upstream || '' };
      });
  if (fromCache.length) {
    return fromCache.map(function (s) {
      return { name: s.name, cat: s.cat || '', icon: s.icon || '', upstream: s.upstream || '' };
    });
  }
  return FALLBACK_SOURCES.map(function (s) {
    return { name: s.name, cat: s.cat || '', icon: s.icon ? ICON_BASE + s.icon : '', upstream: s.upstream };
  });
}

/** 抓单个榜，失败只带 error 不抛 */
async function loadSource(src, bases, timeout) {
  const base = { name: src.name, cat: src.cat || '', icon: src.icon || '', id: slugId(src.name) };
  if (!src.upstream) return Object.assign(base, { items: [], error: '未配置上游关键字' });
  const r = await fetchUpstream(bases, src.upstream, timeout);
  if (!r.ok) return Object.assign(base, { items: [], error: r.error });
  // 显示名始终用配置里的中文名（上游可能回的是英文关键字）
  return Object.assign(base, r.source, {
    id: base.id,
    name: base.name,
    __upstream: r.url,
    error: '',
  });
}

/* ------------------------------------------------------------------ */
/* 聚合入口                                                             */
/* ------------------------------------------------------------------ */

/**
 * 取全量热榜。
 * @returns {Promise<{payload:object, fresh:boolean, error:string}>}
 *   fresh=true 表示这次结果是刚打的（可能部分失败），false 表示缓存命中。
 */
async function buildAll(opts) {
  const store = opts.store;
  const key = opts.key || 'hot-data';
  const ttl = Number(opts.ttl || 600) * 1000; // 单位：秒
  const bases = opts.bases && opts.bases.length ? opts.bases : DEFAULT_UPSTREAMS;

  let cached = null;
  try {
    const raw = await store.get(key);
    if (raw) cached = JSON.parse(raw);
  } catch (e) {
    cached = null;
  }
  const age = cached && cached.updated ? Date.now() - Number(cached.updated) : Infinity;
  if (cached && cached.sources && cached.sources.length && !opts.refresh && age < ttl) {
    return { payload: cached, fresh: false, error: '' };
  }

  const want = opts.want; // Set<string>？不传=全部
  const list = resolveSources(opts, cached);
  const jobs = list.map(async function (src) {
    if (want && !want.has(src.upstream || src.name)) return null;
    try {
      return await loadSource(src, bases, opts.timeout);
    } catch (e) {
      return Object.assign(
        { name: src.name, cat: src.cat || '', icon: src.icon || '', id: slugId(src.name) },
        { items: [], error: (e && e.message) || String(e) }
      );
    }
  });
  const settled = await Promise.all(jobs);

  const ts = Date.now();
  const oldMap = {};
  (cached && cached.sources || []).forEach(function (s) {
    if (s.items && s.items.length) oldMap[s.name] = s;
  });

  const sources = [];
  const failed = [];
  settled.forEach(function (s) {
    if (!s) return;
    if (s.items && s.items.length) {
      sources.push(s);
    } else if (oldMap[s.name]) {
      // 本轮没抓到：保留上一次的结果并打 stale 标记，页面不至于空白
      sources.push(Object.assign({}, oldMap[s.name], { stale: true }));
    } else {
      failed.push(s.name);
    }
  });

  const payload = {
    updated: ts,
    updatedText: nowText(),
    source: opts.source || 'https://tophub.today/',
    list: list.map(function (s) {
      return { name: s.name, cat: s.cat || '', icon: s.icon || '', upstream: s.upstream || '' };
    }),
    sources: sources,
    failed: failed,
    fresh: true,
  };

  const okCount = sources.filter(function (s) { return !s.stale; }).length;
  if (okCount) {
    try {
      await store.put(key, JSON.stringify(payload));
    } catch (e) {
      payload.__storeError = (e && e.message) || String(e);
    }
  }
  return { payload: payload, fresh: true, error: failed.length ? failed.length + ' 个榜取不到：' + failed.join('、') : '' };
}

/* ESM 导出：workers 直接 import，本机 server.js 用 await import() 动态载入。
 * （想在本机用 require('./core.js') 的可自行在末尾补 module.exports，二者选一即可，别重复） */
export {
  DEFAULT_UPSTREAMS,
  FALLBACK_SOURCES,
  ICON_BASE,
  corsHeaders,
  fmtHot,
  slugId,
  toBases,
  nowText,
  normItems,
  extractList,
  normalizeUpstream,
  upstreamUrls,
  fetchUpstream,
  resolveSources,
  loadSource,
  buildAll,
};
