/**
 * 今日热榜 —— 自建后端：Cloudflare Worker
 * ---------------------------------------------------------------
 * 存在的意义不是「存文件」，而是帮浏览器绕开 CORS：
 * 上游热榜 API（DailyHot 各实例、60s API…）大多不发跨域头，
 * 浏览器直连会被拦；由 Worker 服务端代抓，再以 CORS:* 返回即可。
 * 顺带把结果缓存进 KV，避免每个访客都去打一次上游。
 *
 * 端点（base 即你的 Worker 地址，如 https://hot-api.xxx.workers.dev）
 *   GET  /all                实时聚合全量榜单（缓存 TTL 由 HOT_TTL 指定，默认 600s）
 *   GET  /all?refresh=1      跳过缓存强制重抓
 *   GET  /<name>             单个榜单，如 /zhihu；返回 {sources:[…]} 结构
 *   GET  /hot-data           只读 KV 里的最新快照（比 /all 快，但可能过期）
 *   PUT  /hot-data           写快照，需 Authorization: Bearer <ADMIN_SECRET>
 *   GET  /probe/<name>       探测该榜单在哪些上游可用（第一次配上游时很有用）
 *   GET  /health             健康检查
 *   OPTIONS                  CORS 预检
 *
 * 依赖：仅 core.js（同目录共享内核），wrangler deploy 时会自动一起打包。
 */

import {
  DEFAULT_UPSTREAMS,
  FALLBACK_SOURCES,
  corsHeaders,
  fetchUpstream,
  buildAll,
  upstreamUrls,
  normalizeUpstream,
  slugId,
  toBases,
} from './core.js';

const KEY = 'hot-data';

const json = (obj, status) =>
  new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsHeaders()),
  });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders();

    /* CORS 预检 */
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    /* 路径：允许 /xxx 与 /hot/xxx 两种写法 */
    const segs = url.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    const head = segs.length && segs[0] === 'hot' ? segs.slice(1) : segs;
    const cmd = head[0] || '';

    /* KV 适配器：与本机 server.js 的 store 接口保持一致 */
    const store = {
      async get(k) {
        try {
          return (await env.HOT_KV.get(k)) || null;
        } catch (e) {
          return null;
        }
      },
      async put(k, v) {
        await env.HOT_KV.put(k, v, { expirationTtl: 86400 }); // 最多留一天
      },
    };

    const bases = toBases(env.UPSTREAMS); // vars 里是逗号字符串，没配则用内置列表
    const ttl = Number(env.HOT_TTL || 600);
    const timeout = Number(env.UP_TIMEOUT || 8000);
    const ttlSec = url.searchParams.get('ttl') ? Number(url.searchParams.get('ttl')) : ttl;

    let sources = null;
    if (env.HOT_SOURCES) {
      try {
        sources = JSON.parse(env.HOT_SOURCES);
      } catch (e) {
        sources = null;
      }
    }

    const opts = Object.assign(
      { store, key: KEY, ttl: ttlSec, bases, timeout, sources },
      url.searchParams.get('refresh') ? { refresh: true } : {}
    );

    /* ---------------- 健康检查 ---------------- */
    if (!cmd || cmd === 'health') {
      return json({
        ok: true,
        service: 'hot-api',
        ttl: ttlSec,
        upstreams: bases,
        builtinSources: FALLBACK_SOURCES.length,
      });
    }

    /* ---------------- 探针：这个榜在哪些上游能取到 ---------------- */
    if (cmd === 'probe') {
      const name = decodeURIComponent(head[1] || '');
      if (!name) return json({ ok: false, error: '用法：/probe/<关键字>，如 /probe/zhihu' }, 400);
      const results = [];
      for (const u of upstreamUrls(bases, name)) {
        try {
          const res = await fetch(u, {
            headers: { 'User-Agent': 'hot-api-probe', Accept: 'application/json' },
            signal: AbortSignal.timeout(timeout),
          });
          const txt = await res.text();
          results.push({ url: u, status: res.status, ok: res.ok && res.ok !== 404 });
          if (res.ok) {
            try {
              const src = normalizeUpstream(name, '', JSON.parse(txt));
              results[results.length - 1].count = src.items.length;
              results[results.length - 1].sample = src.items[0] && src.items[0].title;
            } catch (e) {
              results[results.length - 1].parseError = String(e.message || e).slice(0, 80);
            }
          }
        } catch (e) {
          results.push({ url: u, status: 0, ok: false, error: String(e.message || e).slice(0, 80) });
        }
      }
      return json({ ok: true, name: name, results: results });
    }

    /* ---------------- 读快照（只读，最快） ---------------- */
    if (cmd === 'hot-data' && request.method === 'GET') {
      const raw = await store.get(KEY);
      if (!raw) return json({ ok: false, error: 'KV 为空，先访问 /all 抓一次或 PUT 写入' }, 404);
      try {
        return json({ ok: true, cached: true, ...JSON.parse(raw) });
      } catch (e) {
        return json({ ok: false, error: 'KV 内容损坏：' + e.message }, 500);
      }
    }

    /* ---------------- 写快照（后台上传用） ---------------- */
    if (cmd === 'hot-data' && (request.method === 'PUT' || request.method === 'POST')) {
      const auth = request.headers.get('Authorization') || '';
      if (auth !== 'Bearer ' + env.ADMIN_SECRET) {
        return json({ ok: false, error: 'Unauthorized' }, 401);
      }
      const text = await request.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('body 必须是 JSON 对象');
        if (!Array.isArray(parsed.sources)) throw new Error('缺少 sources 字段');
        if (!parsed.sources.length) throw new Error('sources 不能为空');
      } catch (e) {
        return json({ ok: false, error: 'Invalid JSON: ' + e.message }, 400);
      }
      parsed.updated = parsed.updated || Date.now();
      parsed.updatedText = parsed.updatedText || new Date().toLocaleString('zh-CN', { hour12: false });
      await store.put(KEY, JSON.stringify(parsed));
      return json({ ok: true, sources: parsed.sources.length });
    }

    /* ---------------- 单榜实时 ---------------- */
    if (cmd && cmd !== 'all') {
      const name = decodeURIComponent(cmd);
      const r = await fetchUpstream(bases, name, timeout);
      if (!r.ok) return json({ ok: false, error: r.error, name: name }, 502);
      const payload = {
        updated: Date.now(),
        updatedText: new Date().toLocaleString('zh-CN', { hour12: false }),
        source: 'https://tophub.today/',
        sources: [
          { id: slugId(name), name: name, cat: '', icon: '', url: r.url, items: r.source.items, __upstream: r.url },
        ],
      };
      return json(payload);
    }

    /* ---------------- 全量聚合（默认） ---------------- */
    const res = await buildAll(opts);
    return json(
      Object.assign({}, res.payload, { cached: res.fresh ? false : true, fetchError: res.error })
    );
  },
};
