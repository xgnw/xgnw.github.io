# 今日热榜（hot）

单文件静态站，聚合知乎、微博、抖音、头条等全网热榜，排版参考 `hot.432600.xyz`。

- **页面**：`index.html`（无框架、无构建、零依赖，双击即可打开）
- **静态数据**：`hot-data.js`（`window.__HOT_DATA__`，由脚本生成，勿手改）
- **抓取**：`fetch-hot.js`（Node 内置能力，无需 npm 安装）
- **后端（可选）**：`core.js` 共享内核 + `server.js`（本机）/ `worker.js`（Cloudflare Worker）

> 两种取数方式，按需选：
> **A. 构建期快照** —— `node fetch-hot.js` 生成 `hot-data.js`，页面 `file://` 直接开，最简单。
> **B. 自建后端实时取** —— 跑一个后端代理上游热榜接口，页面打开就是最新榜（本文第三节）。

---

## 一、快速开始（快照模式）

```bash
node fetch-hot.js          # 抓全量榜单，约 2 分钟
# 然后双击 index.html
```

页面通过 `<script src="hot-data.js">` 拿数据，不依赖任何服务、不需要装包。

---

## 二、数据抓取脚本

```bash
node fetch-hot.js                 # 抓全量 28 个榜单
node fetch-hot.js 微博 知乎        # 只抓名字里含「微博 / 知乎」的榜（空格分隔多个）
HOT_API=http://127.0.0.1:8124 node fetch-hot.js --upload   # 抓完顺手推到自建后端
```

### 数据源

主源是 <https://tophub.today>（今日热榜，与 `www.tophubdata.com` 同源）。节点页结构固定，
脚本按 `<tr>` 解析出：序号、标题、原文链接、热度、缩略图。

### 两个必须知道的行为

1. **会触发反爬**：tophub 对高频请求返回 403 并弹图形验证码（IP 级）。
   所以脚本是**串行 + 600~1500ms 随机延迟**；一旦看到大面积 403，等十几分钟再跑即可，
   已抓到的榜单不会丢。
2. **旧数据会被保留**：本次没抓到的榜，若上次抓到了会打 `stale` 标记保留，
   不会被写成空壳。反复跑不会越跑越少。

### 兜底源

tophub 抓不到时自动退到公开聚合接口 `60s-api.viki.moe`（字段 `{title, hot_value, link}`），
保证页面不白屏。兜底的榜单关键字在 `fetch-hot.js` 的 `LIST` 里用 `alt` 配置。

### 输出结构

```js
window.__HOT_DATA__ = {
  updated: 1730000000000,        // 毫秒时间戳
  updatedText: "2026/10/2 20:11:33",
  source: "https://tophub.today/",
  sources: [{
    id: "KqndgxeLl9",
    cat: "综合热榜",
    name: "微博热搜",
    upstream: "weibo",           // 走自建后端时的上游关键字，空串表示该榜没有可用上游
    icon: "https://file.ipadown.com/tophub/assets/images/media/…png",
    url: "https://tophub.today/n/KqndgxeLl9",
    items: [{ rank, title, url, hot, img }]
  }]
};
```

想加/删榜单，改 `fetch-hot.js` 顶部 `LIST` 数组（`id` 来自 tophub 首页的 `/n/xxx` 链接）。

---

## 三、自建后端（实时取数）

### 为什么需要它

上游热榜接口（DailyHot 各实例、60s API…）几乎都不发 `Access-Control-Allow-Origin`，
**浏览器直连会被 CORS 拦掉**。后端在服务端代抓、加缓存，再以 `Access-Control-Allow-Origin: *`
返回，前端就能随便调。顺带解决「每次开页面都打一遍上游」的问题。

### 端点（base = 你的后端地址）

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/all` | GET | 全量聚合。缓存命中直接返回；未命中则并发抓全部榜单并回写缓存 |
| `/all?refresh=1` | GET | 跳过缓存强制重抓 |
| `/<name>` | GET | 单个榜单，如 `/zhihu`，返回 `{sources:[…]}` |
| `/hot-data` | GET | 只读最新快照（最快，但可能过期） |
| `/hot-data` | PUT | 写快照，**需** `Authorization: Bearer <ADMIN_SECRET>` |
| `/probe/<name>` | GET | 探测该榜单在哪些上游可用（配上游时先用它） |
| `/health` | GET | 健康检查：当前上游列表、缓存时长 |
| — | OPTIONS | CORS 预检 |

响应统一是前端 `normalize()` 认得的形状：

```js
{ updated, updatedText, source, sources: [{ id, name, cat, icon, items: [{rank,title,url,hot}] }] }
```

### 方案 A：本机 `server.js`（零依赖，先玩起来）

```bash
node server.js                     # 默认 http://127.0.0.1:8124
PORT=9000 node server.js           # 换端口
```

`server.js` 同时是**静态服务器**：访问 <http://127.0.0.1:8124/> 打开的就是首页，同源无跨域。
缓存落在同目录 `.cache-hot.json`（原子写），改缓存时长设 `HOT_TTL=120 node server.js`。

浏览器里把后端地址填进右上角 `⚙` →「自建后端地址」，或写进 `index.html` 的
`CFG.API_BASE = 'http://127.0.0.1:8124'`。

### 方案 B：Cloudflare Worker（公网可用）

```bash
npm install -g wrangler && wrangler login
wrangler kv namespace create HOT_KV          # 把输出的 id 填进 wrangler.toml
wrangler secret put ADMIN_SECRET             # 写接口的管理员密钥
wrangler deploy
```

.env 造型的 `wrangler.toml` 已配好 `HOT_KV` 绑定与 `HOT_TTL` / `UP_TIMEOUT` 变量，
部署后把 `https://hot-api.<子域>.workers.dev` 填进 `CFG.API_BASE` 或页面 `⚙` 即可。

> `core.js` 是共享内核，wrangler 打包时会自动连同 `worker.js` 一起上传，不用改 anything。

### 环境变量（`server.js` / Worker vars 通用）

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `PORT` | `8124` | 仅 `server.js`：监听端口 |
| `ADMIN_SECRET` | 空 | 仅 `server.js`：`PUT` 校验密钥，留空=不校验 |
| `HOT_TTL` | `600` | 缓存秒数，热榜 10 分钟足够新 |
| `UP_TIMEOUT` | `8000` | 单个上游请求超时（毫秒） |
| `UPSTREAMS` | 内置 5 个 | 上游列表，逗号分隔，`{n}` 替成榜单关键字 |
| `HOT_SOURCES` | 空 | 自建榜单清单 JSON，格式见 `wrangler.toml` 注释 |

### 上游与自动降级

默认上游按序尝试，第一个返回可用数据就胜出：

```
https://api-hot.imsyy.top/{n}
https://dailyhot-api.rinne.tech/{n}
https://api.pearktrue.cn/api/dailyhot/?type={n}
https://dailyhot.hcol.top/{n}
https://60s-api.viki.moe/v2/{n}
```

- 上游挂了不影响其它榜，**绝大部分只丢这一个榜**。
- **两次上游请求之间强制间隔 250ms**：公开聚合接口对突发很敏感，并发打会吃 429，
  本来能成功的榜也会被拖下水（这条踩过坑）。
- 榜单清单优先级：`HOT_SOURCES` > 缓存里记下的清单 > 内置兜底清单。
- 不知道某个榜在上游叫什么关键字？用 `/probe/zhihu`——它会逐个上游试一遍，
  返回哪个能用、返回多少条、第一条标题是什么。

---

## 四、前端可调项

`index.html` 底部内联脚本里的 `CFG`：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `API_BASE` | `''` | **自建后端地址**（Worker 或 `server.js`）。填了就实时取数；留空只用本地 `hot-data.js` |
| `HOT_DATA_URL` | `''` | 改走 JSON + `fetch`（需 http 环境，`file://` 禁用 fetch） |
| `CACHE_MS` | `10*60*1000` | 本地缓存有效期（当前策略下主要影响「x 分钟前更新」的文案） |
| `DEFAULT_SHOW` | `12` | 首次进入默认展示的榜单数 |

后端地址也存在 `localStorage['hotApi']`（`{base, url, token}`），改完立刻生效，不重写 `index.html`。

### 启动顺序（重要）

先渲染本地 `hot-data.js` 出首屏，**再后台拉后端数据覆盖**，所以后端慢或不通都不会白屏。
顶栏提示条会说明当前状态：`⟳ 正在拉取…` / `✓ 已连接自建后端` / `⚠ 自建后端未就绪（降级到本地快照）`。

### 顶栏按钮

| 按钮 | 作用 |
| --- | --- |
| 🌙 / ☀️ | 深浅色切换，存 `localStorage['hotTheme']` |
| ⟳ | 重新拉一次（优先打自建后端 `/all`；没配就打开设置） |
| ⚙ | 数据源设置：后端地址 / 其他接口地址 / Token（按 `Bearer` 发送）；「恢复本地数据」回到 `hot-data.js` |
| ↗ | 打开数据源站点 |

选中的榜单存 `localStorage['hotSel']`，刷新后自动还原（后端刷新新数据时也会尽量保住）。

### 支持实时接口返回的格式（`normalize()` 已兼容）

```js
{ sources: [{ name, cat, icon, url, items: [{ title, url, hot }] }] }
{ data: [{ title, hot_value, link }] }          // 单榜
[ { title, url, hot } ]                          // 单榜数组
```

字段别名都做了兜底（`title/name`、`link/url/href`、`hot/hot_value/hotValue/desc`）。
热度如果是数字会自动格式化成「172万」这类中文计数。

---

## 五、二次开发

- **换主色**：改 `<style>` 顶部 `:root` 的 `--brand`（与项目导航站一致，默认 `#425AEF`）。
- **卡片列数**：改 `main .grid` 的 `grid-template-columns` 的 `minmax(330px, 1fr)`。
- **每榜显示条数**：`renderGrid()` 里的 `s.items.slice(0, 20)`。
- **默认展示榜单数**：`CFG.DEFAULT_SHOW`。
- **类名**：`.hd` 顶栏 / `.chips` 榜单快捷条 / `.card` 榜单卡 / `.row` 热榜条目 / `.notice` 提示条。
- **移动端**：`@media (max-width:720px)` 切成单列、隐藏热度列。
- **改后端行为**：只动 `core.js`（取数 / 归一化 / 缓存），`server.js` 与 `worker.js` 都会跟着变。

---

## 六、部署

- **GitHub Pages / Cloudflare Pages（快照模式）**：把 `hot/` 传上去，`fetch-hot.js` 跑完提交
  `hot-data.js` 的改动即可。
- **配了后端（Worker 模式）**：页面从后端读数据，`hot-data.js` 只当首屏兜底，
  也就是源码里旧的快照可以不再提交。
- **只在本地用**：`node server.js` 一条命令，后端 + 站点一起起来了。

---

## 七、注意事项

1. **别高频跑 `fetch-hot.js`**：tophub 的 403 是 IP 级，要人工过验证码才恢复；
   建议每小时最多一次，或挂定时任务（脚本本身不会自己跑）。
2. **浏览器不能直连 tophub**：CORS 限制，所以抓取在 Node 侧；自建后端则代理上游 JSON 接口。
3. **上游会限流**：多处合起来看，单次跑超过 3~4 个上游请求就可能吃 429（60s 尤其敏感）。
   真要覆盖几十个榜，建议锁死 `UPSTREAMS` 只留自己最稳的一两个。
4. **`/all` 是并发 fan-out**：榜单越多回源越久，靠 `HOT_TTL` 缓存摊平。首次冷启动可能 5~10s。
5. **图标来自 `file.ipadown.com`**：国内偶发慢/失败，图片已加 `onerror` 静默隐藏，不会破版。
6. **版权**：只做聚合展示，条目链接与版权归各原始平台与作者所有。

---

## 八、验证

```bash
node --check core.js worker.js server.js fetch-hot.js
node _test-dom.js     # 不装任何依赖
```

`_test-dom.js` 覆盖：内联脚本语法、**本地快照渲染**、**后端 `/all` 实时拉取并渲染**、**后端离线降级到快照**、
**空数据兜底文案**。会校验卡片数 > 0、条目带外链、后端请求地址正确、状态提示到位。
