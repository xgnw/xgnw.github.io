/**
 * Cloudflare Worker：导航站 / 博客 数据读写后端（通用 KV JSON 存储）
 * ---------------------------------------------------------------
 * 替代 GitHub Contents API 的「写文件」能力——Cloudflare Pages/Workers
 * 是静态托管，没有浏览器可直连的写文件接口，所以用本 Worker 把数据
 * 存进 KV，admin 页面直接读写 KV，前台运行时从 KV 拉取。
 *
 * 一个 Worker + 一个 KV 命名空间即可同时服务「导航站」与「博客」：
 *   - 导航站：key 默认 nav-data，admin 写入 { NAV_DATA, SEARCH_ENGINES }，
 *             前台 NAV_DATA_URL 指向本 Worker、从 /nav-data 读取。
 *   - 博客：  key 默认 blog-posts，blog-admin 写入 { POSTS }，
 *             前台 blog.html 的 POSTS_URL 指向本 Worker、从 /blog-posts 读取。
 *
 * 端点（key 取自路径，GET/PUT 都用同一个 key）：
 *   GET  /<key>          公开读取 KV 中的 JSON（前台用，CORS 开放）
 *   PUT  /<key>          写回 JSON，需 Authorization: Bearer <ADMIN_SECRET>
 *   OPTIONS              处理 CORS 预检
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, '')) || 'nav-data';

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    };

    /* CORS 预检 */
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    /* 公开读：前台拉取最新数据（导航站读 /nav-data，博客读 /blog-posts） */
    if (request.method === 'GET') {
      const val = await env.NAV_KV.get(key);
      const body = val || '{}';
      return new Response(body, {
        headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors),
      });
    }

    /* 写回：admin 调用，需密钥；校验 body 为合法 JSON 对象（键值对，不限定字段） */
    if (request.method === 'PUT' || request.method === 'POST') {
      const auth = request.headers.get('Authorization') || '';
      if (auth !== 'Bearer ' + env.ADMIN_SECRET) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors),
        });
      }
      const text = await request.text();
      try {
        const j = JSON.parse(text);
        if (typeof j !== 'object' || j === null || Array.isArray(j)) {
          throw new Error('body 必须是 JSON 对象（如 { NAV_DATA: [...] } 或 { POSTS: [...] }）');
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON: ' + e.message }), {
          status: 400,
          headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors),
        });
      }
      await env.NAV_KV.put(key, text);
      return new Response(JSON.stringify({ ok: true }), {
        headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors),
      });
    }

    return new Response('Method Not Allowed', { status: 405, headers: cors });
  },
};
