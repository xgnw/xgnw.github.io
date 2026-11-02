#!/usr/bin/env node
/**
 * 今日热榜 —— 自建后端：本机 Node 服务（零依赖 / 零配置 / 零安装）
 * ---------------------------------------------------------------
 * 与 worker.js（Cloudflare Worker）跑的是同一份 core.js，接口完全一致，
 * 所以在 index.html 里填 http://127.0.0.1:8124 和填 Worker 地址效果一样。
 *
 * 它同时干两件事：
 *   1) 当 API：代理上游热榜接口 + 本地文件缓存（绕开 CORS，页面能实时取数）
 *   2) 当静态服务器：直接托管 index.html / hot-data.js，同源无跨域问题
 *
 * 用法：
 *   node server.js                 启动，默认 http://127.0.0.1:8124
 *   PORT=9000 node server.js       换端口
 *   ADMIN_SECRET=xxx node server.js  开写鉴权（不给密钥时任何人可 PUT，注意场合）
 *
 * 环境变量：
 *   PORT        监听端口，默认 8124
 *   ADMIN_SECRET   PUT /hot-data 的 Bearer 密钥，留空表示不校验
 *   HOT_TTL     缓存秒数，默认 600
 *   UPSTREAMS   覆盖上游列表（逗号分隔，{n} 替成榜单关键字）
 *   HOT_SOURCES 自建榜单清单 JSON，格式见 wrangler.toml 的注释
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const PORT = Number(process.env.PORT || 8124);
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const TTL = Number(process.env.HOT_TTL || 600);
const CACHE_FILE = path.join(DIR, '.cache-hot.json');
const KEY = 'hot-data';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

/* ---------------- 缓存（单个 JSON 文件） ---------------- */
const store = {
  async get() {
    try {
      return fs.readFileSync(CACHE_FILE, 'utf8');
    } catch (e) {
      return null;
    }
  },
  async put(k, v) {
    const tmp = CACHE_FILE + '.tmp';
    fs.writeFileSync(tmp, v, 'utf8');
    fs.renameSync(tmp, CACHE_FILE); // 原子写，避免半截文件被读到
  },
};

/* ---------------- 启动 ---------------- */
(async () => {
  const core = await import('./core.js');
  const {
    DEFAULT_UPSTREAMS,
    corsHeaders,
    fetchUpstream,
    buildAll,
    upstreamUrls,
    normalizeUpstream,
    slugId,
    toBases,
  } = core;

  const bases = toBases(process.env.UPSTREAMS);

  let sources = null;
  if (process.env.HOT_SOURCES) {
    try {
      sources = JSON.parse(process.env.HOT_SOURCES);
    } catch (e) {
      console.error('HOT_SOURCES 解析失败，将使用默认清单：' + e.message);
    }
  }

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    const cors = corsHeaders();
    const send = (obj, status) => {
      const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
      res.writeHead(status || 200, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors));
      res.end(body);
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }

    const segs = u.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    const head = segs.length && segs[0] === 'hot' ? segs.slice(1) : segs;
    const cmd = head[0] || '';

    try {
      /* ---- 健康检查（注意：根路径走静态首页，别被这里抢走） ---- */
      if (cmd === 'health') {
        return send({ ok: true, service: 'hot-api', ttl: TTL, upstreams: bases, port: PORT });
      }

      /* ---- 静态文件 / 首页 ----
       * 判定规则：路径能落到目录里某个真实文件 => 静态托管；否则才走 API。
       * 这样 /zhihu 不会被误判成静态文件而 404，/index.html 也能正常访问。 */
      const rel = segs.length ? segs.join('/') : 'index.html'; // 根路径回落到首页
      const file = path.join(DIR, path.normalize(rel));
      const isFile =
        segs.length === 0 || (fs.existsSync(file) && fs.statSync(file).isFile());
      if (isFile) {
        if (!file.startsWith(DIR)) {
          res.writeHead(403, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, cors));
          return res.end('403 Forbidden');
        }
        if (!fs.existsSync(file)) {
          res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, cors));
          return res.end('404 Not Found: /' + segs.join('/'));
        }
        const ext = path.extname(file).toLowerCase();
        res.writeHead(200, Object.assign({ 'Content-Type': MIME[ext] || 'application/octet-stream' }, cors));
        return fs.createReadStream(file).pipe(res);
      }

      /* ---- 探针 ---- */
      if (cmd === 'probe') {
        const name = decodeURIComponent(head[1] || '');
        if (!name) return send({ ok: false, error: '用法：/probe/<关键字>，如 /probe/zhihu' }, 400);
        const results = [];
        for (const url of upstreamUrls(bases, name)) {
          try {
            const r = await fetch(url, {
              headers: { 'User-Agent': 'hot-api-probe', Accept: 'application/json' },
              signal: AbortSignal.timeout(8000),
            });
            const txt = await r.text();
            const item = { url, status: r.status, ok: r.ok };
            if (r.ok) {
              try {
                const src = normalizeUpstream(name, '', JSON.parse(txt));
                item.count = src.items.length;
                item.sample = src.items[0] && src.items[0].title;
              } catch (e) {
                item.parseError = String(e.message || e).slice(0, 80);
              }
            }
            results.push(item);
          } catch (e) {
            results.push({ url, status: 0, ok: false, error: String(e.message || e).slice(0, 80) });
          }
        }
        return send({ ok: true, name, results });
      }

      /* ---- 读快照 ---- */
      if (cmd === 'hot-data' && req.method === 'GET') {
        const raw = await store.get();
        if (!raw) return send({ ok: false, error: '缓存为空，先访问 /all 抓一次' }, 404);
        try {
          return send({ ok: true, cached: true, ...JSON.parse(raw) });
        } catch (e) {
          return send({ ok: false, error: '缓存损坏：' + e.message }, 500);
        }
      }

      /* ---- 写快照 ---- */
      if (cmd === 'hot-data' && (req.method === 'PUT' || req.method === 'POST')) {
        if (ADMIN_SECRET && req.headers.authorization !== 'Bearer ' + ADMIN_SECRET) {
          return send({ ok: false, error: 'Unauthorized' }, 401);
        }
        let text = '';
        for await (const c of req) text += c;
        let parsed;
        try {
          parsed = JSON.parse(text);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('body 必须是 JSON 对象');
          if (!Array.isArray(parsed.sources) || !parsed.sources.length) throw new Error('sources 必须是非空数组');
        } catch (e) {
          return send({ ok: false, error: 'Invalid JSON: ' + e.message }, 400);
        }
        parsed.updated = parsed.updated || Date.now();
        parsed.updatedText = parsed.updatedText || new Date().toLocaleString('zh-CN', { hour12: false });
        await store.put(KEY, JSON.stringify(parsed));
        return send({ ok: true, sources: parsed.sources.length });
      }

      /* ---- 单榜实时 ---- */
      if (cmd && cmd !== 'all') {
        const name = decodeURIComponent(cmd);
        if (/\.[a-z0-9]+$/i.test(name)) {
          // 像文件名却没落到真实文件上（如 /favicon.ico），别去打上游
          return send({ ok: false, error: 'Not Found', name }, 404);
        }
        const r = await fetchUpstream(bases, name, 8000);
        if (!r.ok) return send({ ok: false, error: r.error, name }, 502);
        return send({
          updated: Date.now(),
          updatedText: new Date().toLocaleString('zh-CN', { hour12: false }),
          source: 'https://tophub.today/',
          sources: [
            { id: slugId(name), name, cat: '', icon: '', url: r.url, items: r.source.items, __upstream: r.url },
          ],
        });
      }

      /* ---- 全量聚合 ---- */
      const t0 = Date.now();
      const built = await buildAll({
        store,
        key: KEY,
        ttl: TTL,
        bases,
        sources,
        timeout: 8000,
        refresh: u.searchParams.get('refresh') === '1',
      });
      console.log(
        `  /all  用 ${((Date.now() - t0) / 1000).toFixed(1)}s，` +
          `成功 ${built.payload.sources.length} 个榜${built.error ? '（失败：' + built.error + '）' : ''}` +
          (built.fresh ? '' : '（缓存命中）')
      );
      return send({ ...built.payload, cached: !built.fresh, fetchError: built.error });
    } catch (e) {
      return send({ ok: false, error: String(e && e.message ? e.message : e) }, 500);
    }
  });

  server.listen(PORT, () => {
    console.log('\n今日热榜 · 自建后端已启动（同源托管 index.html，页面无跨域问题）');
    console.log(`  ↳ 站点        http://127.0.0.1:${PORT}/`);
    console.log(`  ↳ 实时聚合    http://127.0.0.1:${PORT}/all         ` + `缓存 ${TTL}s，缓存文件 ${path.basename(CACHE_FILE)}`);
    console.log(`  ↳ 单榜        http://127.0.0.1:${PORT}/zhihu`);
    console.log(`  ↳ 探针        http://127.0.0.1:${PORT}/probe/zhihu  （看这个榜在哪些上游能用）`);
    console.log(`  ↳ 上游列表    ${bases.join('\n               ')}`);
    console.log(`  ↳ 写鉴权      ${ADMIN_SECRET ? '已开启（Bearer ' + ADMIN_SECRET + '）' : '未开启（ Anyone can PUT ）'}`);
    console.log('\n按 Ctrl+C 停止。换端口：PORT=9000 node server.js\n');
  });
})();
