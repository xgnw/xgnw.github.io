#!/usr/bin/env node
/**
 * 今日热榜 —— 数据抓取脚本
 * 数据源：https://tophub.today（今日热榜 tophub 的网页版，与 www.tophubdata.com 同源）
 *
 * 用法：
 *   node fetch-hot.js            抓取全部榜单 -> hot-data.js
 *   node fetch-hot.js 微博       只抓指定榜单（按名称包含匹配，可空格分隔多个）
 *   node fetch-hot.js --all      强制重抓（默认已是全量）
 *
 * 说明：
 *   纯 Node 内置能力实现（fetch + 正则），无需任何依赖。
 *   浏览器受 CORS 限制无法直接读取 tophub，所以抓取放在本地/构建期完成，
 *   结果写入同目录 hot-data.js，页面通过 <script src="hot-data.js"> 加载（file:// 也能打开）。
 *
 * 若需用自有后端实时接口，可设环境变量 HOT_SRC_URL=http://your-api/zhihu，
 * 此时脚本改为从该 URL 拉取 JSON（形如 {data:[{title,url,hot}]}）。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'hot-data.js');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/* ------------------------------------------------------------------
 * 榜单节点清单（node id 取自 tophub 首页，命名便于手工维护）
 * 分类仅用于前端分组展示，不影响抓取。
 * ------------------------------------------------------------------ */
/**
 * alt：to中hub 抓不到（被反爬拦截）时的兜底接口。
 * 这里用 60s 公开聚合 API，字段为 {title, hot_value, link}。
 */
const ALT = 'https://60s-api.viki.moe/v2/';

const fmtHot = (n) => {
  const v = Number(n);
  if (!v) return '';
  return v >= 1e8 ? (v / 1e8).toFixed(1) + '亿' : v >= 1e4 ? Math.round(v / 1e4) + '万' : String(v);
};

async function fetchAlt(src) {
  const res = await fetch(ALT + src.alt, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const j = await res.json();
  const list = Array.isArray(j.data) ? j.data : [];
  const items = list
    .filter((it) => it && it.title && it.link)
    .map((it, i) => ({
      rank: i + 1,
      title: it.title,
      url: it.link,
      hot: it.hot_value ? fmtHot(it.hot_value) : '',
      img: '',
    }));
  if (!items.length) throw new Error('兜底接口无数据');
  process.stdout.write(`  · ${src.name} (兜底源 ${items.length} 条)\n`);
  return { ...src, url: ALT + src.alt, icon: ICON_BASE + src.icon, items, upstream: src.alt, fallback: true };
}

const LIST = [
  { id: 'mproPpoq6O', cat: '综合热榜', name: '知乎热榜', icon: 'zhihu.com.png_160x160.png', alt: 'zhihu' },
  { id: 'KqndgxeLl9', cat: '综合热榜', name: '微博热搜', icon: 's.weibo.com.png_160x160.png', alt: 'weibo' },
  { id: 'DpQvNABoNE', cat: '综合热榜', name: '抖音总榜', icon: 'douyin.com.png_160x160.png', alt: 'douyin' },
  { id: 'x9ozB4KoXb', cat: '综合热榜', name: '今日头条', icon: 'toutiao.com.png_160x160.png', alt: 'toutiao' },
  { id: 'Jb0vmloB1G', cat: '综合热榜', name: '百度实时热点', icon: 'baidu.com.png_160x160.png' },
  { id: 'NaEdZndrOM', cat: '综合热榜', name: '搜狗实时热点', icon: 'sogou.com.png_160x160.png' },
  { id: 'n6YoVqDeZa', cat: '综合热榜', name: '夸克热搜榜', icon: 'so.m.sm.cn.png_160x160.png' },
  { id: 'Om4ejxvxEN', cat: '综合热榜', name: '百度贴吧热议', icon: 'tieba.baidu.com.png_160x160.png' },
  { id: 'WnBe01o371', cat: '综合热榜', name: '微信公众号热文', icon: 'mp.weixin.qq.com.png_160x160.png' },
  { id: '74KvxwokxM', cat: '综合热榜', name: '哔哩哔哩日榜', icon: 'bilibili.com.png_160x160.png' },
  { id: 'Q1Vd5Ko85R', cat: '科技资讯', name: '36氪热榜', icon: '36kr.com.png_160x160.png' },
  { id: 'Y2KeDGQdNP', cat: '科技资讯', name: '少数派热门', icon: 'sspai.com.png_160x160.png' },
  { id: '5VaobgvAj1', cat: '科技资讯', name: '虎嗅网热文', icon: 'huxiu.com.png_160x160.png' },
  { id: 'KMZd7VOvrO', cat: '科技资讯', name: '知乎日报', icon: 'daily.zhihu.com.png_160x160.png' },
  { id: '20MdK2vw1q', cat: '科技资讯', name: '果壳科学人', icon: 'guokr.com.png_160x160.png' },
  {
    id: 'wWmoO5Rd4E',
    cat: '科技资讯',
    name: '微信读书',
    icon: 'weread.qq.com.png_160x160.png',
  },
  { id: 'mDOvnyBoEB', cat: '影音娱乐', name: '豆瓣电影新片', icon: 'movie.douban.com.png_160x160.png' },
  { id: 'KqndgDmeLl', cat: '影音娱乐', name: '开眼视频日报', icon: 'kaiyanapp.com.png_160x160.png' },
  { id: 'WYKd69jvaP', cat: '影音娱乐', name: '梨视频总榜', icon: 'pearvideo.com.png_160x160.png' },
  { id: 'W1VdJPZoLQ', cat: '影音娱乐', name: '微信视频榜', icon: 'mp.weixin.qq.com.png_160x160.png' },
  { id: 'qENeYpdY49', cat: '游戏社区', name: 'AcFun全站榜', icon: 'acfun.cn.png_160x160.png' },
  { id: 'YqoXQGXvOD', cat: '游戏社区', name: '汽车之家论坛', icon: 'club.autohome.com.cn.png_160x160.png' },
  { id: 'G47o8weMmN', cat: '游戏社区', name: '虎扑步行街', icon: 'bbs.hupu.com.png_160x160.png' },
  { id: 'Jb0vmmlvB1', cat: '游戏社区', name: '天涯热帖榜', icon: 'bbs.tianya.cn.png_160x160.png' },
  { id: 'rDgeyqeZqJ', cat: '游戏社区', name: '水木社区热评', icon: 'newsmth.net.png_160x160.png' },
  { id: 'NRrvWq3e5z', cat: '游戏社区', name: '煎蛋一周热文', icon: 'jandan.net.png_160x160.png' },
  { id: 'NKGoRAzel6', cat: '技术社区', name: '吾爱破解热帖', icon: '52pojie.cn.png_160x160.png' },
  { id: 'wWmoO5Rd4E', cat: '其他', name: '历史今天', icon: 'baike.so.com.png_160x160.png' },
].filter((s, i, arr) => arr.findIndex((x) => x.id === s.id && x.name === s.name) === i);

const ICON_BASE = 'https://file.ipadown.com/tophub/assets/images/media/';

/* ------------------------------------------------------------------ */

const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();

const strip = (h) => h.replace(/<[\s\S]*?>/g, '');

/** 解析节点页 <table> 中的条目行 */
function parseItems(html, limit) {
  const rows = html.split('<tr>').slice(1);
  const items = [];
  for (const row of rows) {
    if (!/<a href="https?:\/\//.test(row)) continue;
    const link = row.match(/<a href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const title = decode(strip(link[2]));
    if (!title) continue;
    const rank = (row.match(/<td align="center">(\d+)\./) || [])[1] || items.length + 1;
    const hot = (row.match(/<div class="item-desc">([\s\S]*?)<\/div>/) || [])[1];
    const img = (row.match(/<img src="([^"]+)"/) || [])[1] || '';
    items.push({
      rank: Number(rank),
      title,
      url: link[1],
      hot: hot ? decode(hot) : '',
      img: /^https?:/.test(img) ? img : '',
    });
    if (items.length >= limit) break;
  }
  return items;
}

/** 先访问首页拿到 tophub 的访客 cookie，否则节点页会返回 403 */
async function firstCookie() {
  const res = await fetch('https://tophub.today/', {
    headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' },
    signal: AbortSignal.timeout(20000),
  });
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const jar = (raw.length ? raw : (res.headers.get('set-cookie') || '').split(','))
    .map((c) => c.split(';')[0])
    .filter(Boolean);
  return jar.join('; ');
}

async function fetchNode(src, cookie) {
  const url = `https://tophub.today/n/${src.id}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Cookie: cookie },
        headers: {
          'User-Agent': UA,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          Referer: 'https://tophub.today/',
          'Cache-Control': 'no-cache',
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const html = await res.text();
      const items = parseItems(html, 30);
      if (!items.length) throw new Error('无解析结果');
      process.stdout.write(`  ✓ ${src.name} (${items.length} 条)\n`);
      // upstream 是自己后端的上游关键字（走自建后端时用），没有就留空
      return { ...src, url, icon: ICON_BASE + src.icon, items, upstream: src.alt || '' };
    } catch (err) {
      if (attempt === 3) {
        process.stdout.write(`  ✗ ${src.name} tophub 失败（${err.message}）\n`);
        // 有兜底源的榜单退到公开聚合接口，至少保证页面有真数据
        if (src.alt) {
          try {
            return await fetchAlt(src);
          } catch (e2) {
            process.stdout.write(`  ✗ ${src.name} 兜底也失败：${e2.message}\n`);
          }
        }
        return { ...src, url, icon: ICON_BASE + src.icon, items: [], error: err.message };
      }
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
}

(async () => {
  const cli = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  let targets = LIST;
  if (cli.length) {
    targets = LIST.filter((s) => cli.some((k) => s.name.includes(k)));
    if (!targets.length) {
      console.error('未匹配到榜单，可选：' + LIST.map((s) => s.name).join('、'));
      process.exit(1);
    }
  }

  console.log(`抓取 ${targets.length} 个榜单，来源 https://tophub.today …\n`);
  const started = Date.now();
  const sources = [];
  // 串行 + 抖动延迟：tophub 对高并发会返回 403，放慢是唯一稳妥的做法
  const cookie = await firstCookie().catch(() => '');
  for (const src of targets) {
    sources.push(await fetchNode(src, cookie));
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 900));
  }

  const payload = {
    updated: Date.now(),
    updatedText: new Date().toLocaleString('zh-CN', { hour12: false }),
    source: 'https://tophub.today/',
    sources,
  };

  // 合并旧数据：本轮没抓到的榜单保留上次结果，避免一次失败就把已有数据洗空
  try {
    const oldRaw = fs.readFileSync(OUT, 'utf8').match(/window\.__HOT_DATA__\s*=\s*(\{[\s\S]*\});?\s*$/);
    if (oldRaw) {
      const old = JSON.parse(oldRaw[1]);
      // 只保留「旧的有数据」且「本轮没抓到」的，纯空壳不要留
      const keep = (old.sources || []).filter(
        (s) => s.items && s.items.length && !sources.some((n) => n.id === s.id && n.items.length)
      );
      if (keep.length) {
        sources.push(...keep.map((s) => ({ ...s, stale: true })));
        console.log(`  保留上次成功数据 ${keep.length} 个榜单`);
      }
    }
  } catch (e) { /* 首次运行没有旧文件，忽略 */ }

  const body = JSON.stringify(payload).replace(/</g, '\\u003c');
  fs.writeFileSync(
    OUT,
    `/* 自动生成，勿手改。重新生成：node fetch-hot.js */\nwindow.__HOT_DATA__ = ${body};\n`,
    'utf8'
  );

  const ok = sources.filter((s) => s.items.length).length;
  console.log(`\n完成：${ok}/${sources.length} 个榜单成功，耗时 ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log('已写入 ' + OUT);

  /* 可选：把快照推到自建后端（Worker 或 server.js），这样页面 /hot-data 也能读到这份数据
   *   HOT_API=https://hot-api.xxx.workers.dev node fetch-hot.js --upload
   *   HOT_API=http://127.0.0.1:8124 HOT_SECRET=xxx node fetch-hot.js --upload
   * 不上后端就只更新本地 hot-data.js，页面打开仍是上次那份快照。 */
  const wantUpload = process.argv.indexOf('--upload') > -1 || !!process.env.HOT_API;
  const apiBase = (process.env.HOT_API || '').replace(/\/+$/, '');
  if (wantUpload && !apiBase) {
    console.log('跳过上传：未设 HOT_API（想上传请加参数 --upload 并配置 HOT_API 与 HOT_SECRET）');
    return;
  }
  if (!wantUpload) return;

  const secret = process.env.HOT_SECRET || '';
  const target = apiBase.replace(/\/+$/, '') + '/hot-data';
  console.log('上传到后端 ' + target + ' …');
  try {
    const res = await fetch(target, {
      method: 'PUT',
      headers: Object.assign(
        { 'Content-Type': 'application/json', Accept: 'application/json' },
        secret ? { Authorization: 'Bearer ' + secret } : {}
      ),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    const txt = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + txt.slice(0, 160));
    console.log('✓ 上传成功（' + JSON.parse(txt).sources + ' 个榜单）');
  } catch (e) {
    console.log('✗ 上传失败：' + e.message);
    console.log('  本地数据仍在 ' + OUT + '，页面照常可用；后端那条路需自行 PUT 或访问 /all 重新抓取。');
  }
})();
