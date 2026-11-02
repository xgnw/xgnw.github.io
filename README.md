# 简单导航 · 项目说明（README）

一套**纯静态、零依赖、单文件**的网址导航 + 静态博客 + 浏览器内可视化管理后台，
可在 GitHub Pages、Cloudflare Pages 等任意静态托管上运行，也支持直接双击打开。

> 站点标题：导航站为「简单导航 - 简单但实用的导航」；博客为「我的博客」。
> 所有页面均为**单 HTML 文件**（内联 CSS + JS），无需构建、无需安装依赖、无需后端即可展示。

---

## 一、项目简介

本项目包含**四个可独立运行的页面** + 一个数据文件 + 一个可选的 Cloudflare 数据后端：

| 文件 | 作用 | 标题 |
| --- | --- | --- |
| `index.html` | 导航站前台（对外展示） | 简单导航 |
| `admin.html` | 导航数据管理后台（浏览器内增删改导航 / 搜索引擎） | 导航数据管理 |
| `blog.html` | 静态博客（Pure 蓝色三栏前台） | 我的博客 |
| `blog-admin.html` | 博客数据管理后台（浏览器内增删改文章 / 友情链接） | 文章 / 友链后台 |
| `posts-data.js` | 博客数据文件（文章 `window.__POSTS__` + 友情链接 `var FRIENDS`） | — |
| `cloudflare/worker.js` + `wrangler.toml` | 可选：Cloudflare 数据读写后端 | — |

- 导航站：`index.html` 与 `admin.html` 共享同一份数据源（导航分类 / 链接、搜索引擎列表）。
- 博客：`blog.html` 与 `blog-admin.html` 共享 `posts-data.js`（文章 + 友情链接）。
- 两套管后端都基于「**数据驱动 + 三种数据源**」设计，让非开发者也能在浏览器里直接改内容，
  并一键写回到**本机文件 / GitHub / Cloudflare**，不必每次手动编辑 HTML。

---

## 二、核心特性

### 2.1 导航站前台（`index.html`）

- **分类导航（数据驱动）**：所有分类与链接由页面底部的 `NAV_DATA` 数组定义，
  左侧菜单 + 右侧卡片由 `renderNav()` 自动渲染，增删分类 / 链接只需改这一个数组。
- **自适应卡片网格**：使用 CSS Grid `grid-template-columns: repeat(auto-fill, minmax(var(--card-base), 1fr))`，
  任一列宽足够才换行，**即使某分类只有一个链接也只占一列**，多端宽度下列数自然伸缩。
- **多搜索引擎切换**：搜索框支持在多个引擎间切换（百度、Google、Bing 等），
  回车后在新标签打开搜索结果，引擎列表抽成 `window.SEARCH_ENGINES` 数组，可由管理后台维护。
- **主题切换**：亮色 / 深色 / 跟随系统三种模式，通过 `data-theme` 属性 + `localStorage`
  记忆偏好，颜色集中定义在 `:root` 主题变量里（`--theme` 一行即可换整体配色）。
- **关于本站弹窗**：页脚「关于本站」点击弹出窗口，内含站点制作过程说明与免责声明。
- **页脚版权区**：展示版权文案、「最后更新时间」（`document.lastModified`）以及
  **页面加载用时**（基于 Navigation Timing API，在 `window.load` 后计算并写入）。
- **返回顶部 / Scroll Spy**：滚动超过 200px 显示「返回顶部」按钮；左侧菜单随滚动
  高亮当前所在分类（scroll spy）。
- **服务端数据覆盖（可选）**：内置 `NAV_DATA_URL` 变量，若配置为 Cloudflare/KV 地址，
  页面加载时会先拉取 `<NAV_DATA_URL>/nav-data` 覆盖内置默认值，
  **拉取失败或留空则自动回退到内置数据**，保证「直接上传」的版本永远不会白屏。
- **响应式**：移动端侧栏 / 菜单折叠为顶部条，分隔线等布局同步适配。

### 2.2 导航数据管理后台（`admin.html`）

> 前台 `index.html` **不含任何管理入口 / 代码**，管理逻辑完全隔离在 `admin.html`。

- **三种数据源（可任意切换）**：
  1. **本机文件**（File System Access API）：浏览器直接读写你本机的 `index.html`，
     无需任何服务器，**仅 Chrome / Edge 等 Chromium 内核浏览器可用**。
  2. **GitHub 仓库**（GitHub Contents API）：浏览器直连 GitHub 读取 / 写回仓库里的
     `index.html`（含 `sha` 校验），提交后 GitHub Pages 自动重建，**任意浏览器可用，推荐**。
  3. **Cloudflare KV**（Worker + KV）：针对直接上传部署的 Cloudflare Pages/Workers，
     数据外置到 KV 的 `nav-data` key，由自建 Worker 作读写后端，脱离 Git 也能在线管理。
- **分类与链接管理**：增 / 删 / 改分类与链接；每行支持「顶 / 底 / ↑ / ↓」四种排序
  （顶 = 置顶数组首位、底 = 置底、↑↓ = 相邻交换）；分类头可折叠；顶部搜索框可过滤。
- **搜索引擎管理**：独立标签页维护 `SEARCH_ENGINES`，支持增 / 删 / 改 / 排序
  （置顶 = 设为默认搜索引擎）。
- **客户端登录闸门**：打开后台需输入密码（默认 `admin`），用 Web Crypto
  `crypto.subtle` 做 SHA-256 比对（盐 `navsite-admin-v1`），哈希存于 `localStorage` 的 `adminPassHash`。
  ⚠️ 这是**客户端闸门**，仅防止随手误改，并非真正安全（哈希在源码可见），真实权限闸门
  是文件读写权限 / GitHub Token / Cloudflare 密钥。
- **记忆连接**：GitHub Token、Cloudflare 地址 / 密钥等连接信息存于 `localStorage`，
  下次打开自动重连；本机文件句柄记在 IndexedDB，授权仍在时可自动载入。

### 2.3 静态博客（`blog.html`，Pure 蓝色三栏风格）

- **布局（三栏，主色 `#425AEF`，与导航网同源）**：
  - **左栏（固定蓝色侧栏，sticky）**：头像 / 站名 / 简介 / 位置（取自 `SITE_INFO`）、**站内搜索框**、
    导航菜单（首页 / 归档 / 友链 / 关于，仅链接变色、无底色）、**主题切换**（浅色 / 深色 / 跟随系统，已移入侧栏）、
    社交图标（GitHub / 邮箱 / RSS）、页脚。
  - **主区**：文章列表 / 详情 / 归档 / 友链 / 关于 五个视图按需切换。
  - **右栏（窄侧栏，sticky，≤980px 自动隐藏）**：聚合 **公告 / 分类（带计数）/ 标签云 / 归档（按月）/ 最新文章（前 5 篇）** 五个小工具卡片。
- **多页面（hash 路由，无刷新 SPA 式切换，并自动更新 `document.title`）**：
  - `#/` 首页文章列表（标题 + 摘要 + 日期 + 字数 + 阅读时长 + 标签，按日期倒序）
  - `#/post/<slug>` 文章详情（内置**零依赖极简 Markdown 渲染器**）
  - `#/archives` 存档：按年份倒序、年内按日期分组（右栏另有按月归档入口）
  - `#/links` 友情链接：网格卡片（`auto-fill + minmax(240px, 1fr)`，悬停上浮）
  - `#/about` 关于：由 `blog.html` 内 `SITE_INFO` 对象驱动的段落 + 元信息块 + 联系邮箱
- **站内搜索与筛选**：左栏搜索框按「标题 + 正文」实时关键词过滤（200ms 防抖）；
  点击文章标签或右栏标签云可筛选对应标签，主区顶部出现「当前筛选」提示与「清除筛选」按钮；分类点击跳转到归档页。
- **数据与页面分离**：文章与友情链接**都放在独立文件 `posts-data.js`**——
  文章为 `window.__POSTS__` 数组、友情链接为 `var FRIENDS` 数组，由 `<script src="posts-data.js">` 加载。
  站点「关于」信息 `SITE_INFO` 仍留在 `blog.html` 内。文章 / 友链数据与页面解耦后，
  新增或修改文章 / 友链只动 `posts-data.js`，`blog.html` 体积不再随内容增长；
  导航高亮由 `data-route` + `setActiveNav()` 同步。
- **主题切换**：支持亮 / 深 / 跟随系统，偏好存于 `localStorage` 的 `blogThemePref`，并在 `<head>` 内预解析
  避免首屏闪白；开关位于左栏。
- **远程数据覆盖（可选）**：内置 `POSTS_URL` 变量，若配置为 Cloudflare/KV 地址，
  页面加载时会并行拉取 `<POSTS_URL>/blog-posts`（文章）与 `<POSTS_URL>/blog-friends`（友链）覆盖内置值，
  **拉取失败或留空则自动回退到 `posts-data.js` 内置值**。
- **响应式**：≤980px 隐藏右栏；≤768px 侧栏转为顶部横条、菜单环绕排列、搜索框隐藏。

### 2.4 博客数据管理后台（`blog-admin.html`，新增）

> 前台 `blog.html` **不含任何管理入口 / 代码**，管理逻辑完全隔离在 `blog-admin.html`。

- **顶栏视图切换**：`✍ 文章` / `🔗 友情链接` 两套界面共享同一后台，顶栏「新建 / 保存 / 发布」随视图自动切换语义。
- **文章管理**：左侧文章列表（搜索 + 草稿红点 + 删除），右侧编辑器（大标题 → 5 列元信息 →
  工具栏 → 左 Markdown 带行号输入框 + 右实时预览），支持保存草稿 / 发布。
- **友情链接管理**：左侧友链列表（搜索 + 删除），右侧编辑器（名称 / 网址 / 描述 + 实时卡片预览）+ 新建友链。
- **三种数据源（与导航后台同源思路，发布目标指向 `posts-data.js`）**：
  1. **本机文件**：File System Access 选择本机 `posts-data.js`（Chrome / Edge）。
  2. **GitHub 仓库**：Contents API 读取 / 写回仓库里的 `posts-data.js`（默认路径 `posts-data.js`，带 `sha`）。
  3. **Cloudflare KV**：分别读写 `blog-posts`（文章）与 `blog-friends`（友链）两个 key。
- **发布模态（五种动作）**：复制片段 / 下载 `posts-data.js` / 写回本机 / 🌐GitHub / ☁Cloudflare，
  后两者按当前数据源与 `sha` / KV 是否已读取可用性自动启用。
- **客户端登录闸门 + 改密码**：打开后台需输入密码（默认 `admin`），用 Web Crypto SHA-256
  比对（盐 `navsite-admin-v1`），哈希存于 `localStorage` 的 **`blogAdminPassHash`**（与导航后台的
  `adminPassHash` 相互独立，改一处不影响另一处）。「修改密码」模态可校验旧密码后写入新哈希。

### 2.5 Cloudflare 数据后端（`cloudflare/`）

- **`worker.js`**：一个轻量 Worker，把数据存进 Workers KV，同时服务三组 key：
  - 导航：`nav-data`（admin 写、index 读）
  - 博客文章：`blog-posts`（blog-admin 写、blog 读）
  - 博客友链：`blog-friends`（blog-admin 写、blog 读）
  - `GET /<key>`：公开读取 KV 数据 JSON（CORS `*`），前台拉数据用。
  - `PUT /<key>`：写回数据，需 `Authorization: Bearer <ADMIN_SECRET>` 校验；body 为合法 JSON 对象即可。
  - `OPTIONS`：处理 CORS 预检。
- **`wrangler.toml`**：Worker 配置（KV 绑定 `NAV_KV` + `ADMIN_SECRET` 变量），附完整部署说明。

---

## 三、技术栈与代码实现

| 维度 | 实现方式 |
| --- | --- |
| **整体形态** | 纯静态单文件 HTML，内联 `<style>` 与 `<script>`，**零构建、零第三方依赖、零运行时框架** |
| **语言** | 原生 JavaScript（Vanilla JS，ES 模块仅用于 Worker）、HTML5、CSS3 |
| **样式** | CSS 变量（`:root`）做主题系统；CSS Grid + Flexbox 布局；媒体查询做响应式 |
| **本地文件读写** | File System Access API（`showOpenFilePicker` / `createWritable`），仅 Chromium（Chrome / Edge） |
| **远程数据写回** | GitHub Contents REST API（base64 内容 + `sha` 乐观锁）；Cloudflare Workers + Workers KV |
| **鉴权 / 哈希** | Web Crypto API `crypto.subtle.digest` SHA-256（盐 `navsite-admin-v1`）做客户端登录闸门 |
| **路由** | 基于 `location.hash` 的前端路由（博客多页面、文章详情），无刷新切换、无后端 |
| **性能度量** | Navigation Timing API（`performance.timing` / `loadEventEnd`）计算页面加载用时 |
| **持久化** | `localStorage`（主题、密码哈希、连接信息）+ IndexedDB（本机文件句柄） |
| **Markdown** | 自研极简 Markdown → HTML 渲染（标题 / 段落 / 列表 / 代码 / 链接 / 引用 / 分割线，无外部库） |
| **数据解析** | 括号深度配对 + `new Function` 安全求值，从源文件抽取顶层 `window.__POSTS__` / `var FRIENDS` 数据块 |
| **编码兼容** | GitHub / KV 的 base64 用 `b64EncodeUnicode` / `b64DecodeUnicode` 做 UTF-8 安全的编解码 |

> **可维护性约定**：导航数据 `NAV_DATA` 与搜索引擎 `SEARCH_ENGINES` 集中在 `index.html` 底部带注释的脚本块；
> 博客文章 `window.__POSTS__` 与友链 `var FRIENDS` 集中在 `posts-data.js`；`renderNav()`、`renderPostList()`、
> `renderFriendList()` 等渲染函数自动同步菜单 / 卡片 / 列表，改数据即改全站，无需动布局代码。

---

## 四、目录结构

```text
我的网站/
├── index.html              # 导航站前台（对外）
├── admin.html              # 导航数据管理后台（浏览器内编辑）
├── blog.html               # 静态博客前台
├── blog-admin.html         # 博客数据管理后台（浏览器内编辑文章 / 友链）
├── posts-data.js           # 博客数据：文章 __POSTS__ + 友链 FRIENDS
├── cloudflare/             # 可选：Cloudflare 数据后端
│   ├── worker.js           #   Worker 读写逻辑（KV：nav-data / blog-posts / blog-friends）
│   └── wrangler.toml       #   Worker 部署配置
├── README.md               # 本文件
└── _归档_多余文件/          # 历史副本 / 备份 / 一次性脚本（非运行必需，可整体删除）
```

> 部署时只需上传 `index.html`、`admin.html`、`blog.html`、`blog-admin.html`、`posts-data.js`
> （及可选的 `cloudflare/` 后端）。`_归档_多余文件/` 内为开发过程中的备份或一次性工具，**不属于线上运行所需**。

---

## 五、部署指南

### 5.1 GitHub Pages（推荐，最简单）

1. 把 `index.html`、`admin.html`、`blog.html`、`blog-admin.html`、`posts-data.js` 推到仓库。
2. 仓库 Settings → Pages → 选择分支部署。
3. 管理导航用 **admin.html 的「GitHub 仓库」模式**；管理博客用 **blog-admin.html 的「GitHub 仓库」模式**；
   写回即触发 Pages 自动重建。

### 5.2 Cloudflare Pages（连接 GitHub 仓库）

- 在 Cloudflare Pages 绑定仓库、开启 Git 集成自动部署。
- 同样使用 admin / blog-admin 的「GitHub 仓库」模式管理——GitHub API 对任意域名
  返回 `Access-Control-Allow-Origin: *`，跨域可直接调用，**无需任何后端**。

### 5.3 Cloudflare Pages 直接上传 + Worker KV（不走 Git）

适用于「直接把文件传到 Cloudflare」、不想依赖 GitHub 的场景：

1. 部署 Worker：`wrangler login` → `wrangler kv namespace create NAV_KV`（把输出 id 填进
   `wrangler.toml`）→ `wrangler secret put ADMIN_SECRET`（密钥需与两个后台填的「管理员密钥」一致）
   → `wrangler deploy`，得到 Worker 地址（如 `https://nav-data-api.xxx.workers.dev`）。
2. 导航前台：把 `index.html` 里的 `var NAV_DATA_URL = ''` 改成你的 Worker 地址。
3. 博客前台：把 `blog.html` 里的 `var POSTS_URL = ''` 改成同一个 Worker 地址。
4. 管理：打开 Cloudflare 上的 `admin.html` / `blog-admin.html` → 切到「Cloudflare KV」→
   填地址 + 密钥 + 连接 → 改完点「保存并写回」，前台刷新即从 KV 读到新数据。

### 5.4 任意静态托管 / 本地打开

- 直接把上述 5 个文件丢到任意静态服务器，或**双击 `index.html` / `blog.html` 本地查看**即可
  （`posts-data.js` 通过相对路径 `<script src>` 加载，`file://` 双击也能正常工作）。
- 本地管理用 admin / blog-admin 的「本机文件」模式（需用 Chrome / Edge）。

---

## 六、使用说明：管理后台三种数据源

### 6.1 导航后台 `admin.html`

打开 `admin.html` → 输入密码（默认 `admin`，**请首次登录后立即修改**）。

顶部数据源 tab 可在「本机文件 / GitHub 仓库 / Cloudflare KV」间切换：

| 模式 | 适用场景 | 关键填写项 | 写回机制 |
| --- | --- | --- | --- |
| **本机文件** | 本地直接改本机文件 | 点「选择 index.html」 | File System Access 直接覆盖本机 `index.html` |
| **GitHub 仓库** | GitHub Pages / Cloudflare 连 Git | Token（需 `repo` 或 Fine-grained Contents 读写）、`用户名/仓库`、`分支`、`路径` | 调用 GitHub Contents API `PUT`（`sha` 乐观锁），提交后自动重建 |
| **Cloudflare KV** | Cloudflare 直接上传部署 | Worker 地址、管理员密钥、Key 名（默认 `nav-data`） | `PUT` 到 Worker，写进 KV |

管理操作通用说明：
- **分类 / 链接**：左侧表单新增，右侧列表可搜索、折叠分类、并对每行做「顶 / 底 / ↑ / ↓」排序；
  过滤态下排序按钮自动禁用，避免跨过滤错位。
- **搜索引擎**：切到「搜索引擎」标签页，增删改 + 排序（置顶即设为默认）。
- 改动后底部保存条显示红点（未保存态），点「保存并写回」持久化。

### 6.2 博客后台 `blog-admin.html`

打开 `blog-admin.html` → 输入密码（默认 `admin`，**可与导航后台密码不同，互不影响**）。

顶栏先选 `✍ 文章` 或 `🔗 友情链接` 视图，再在「本机文件 / GitHub 仓库 / Cloudflare KV」间切换数据源：

| 模式 | 适用场景 | 关键填写项 | 写回机制 |
| --- | --- | --- | --- |
| **本机文件** | 本地直接改本机文件 | 点「选择 posts-data.js」 | File System Access 直接覆盖本机 `posts-data.js` |
| **GitHub 仓库** | GitHub Pages / Cloudflare 连 Git | Token、`用户名/仓库`、`分支`、`路径`（默认 `posts-data.js`） | 调用 GitHub Contents API `PUT`（`sha` 乐观锁） |
| **Cloudflare KV** | Cloudflare 直接上传部署 | Worker 地址、管理员密钥、`blog-posts`（文章）/ `blog-friends`（友链）两个 Key 名 | 分别 `PUT` 到 Worker 的两个 KV key |

管理操作通用说明：
- **文章**：左侧列表选文 / 删除 / 搜索，右侧编辑标题、发布路径、标签、分类、封面、日期与 Markdown 正文，
  右侧实时预览；「保存草稿」暂存到本地，「发布」打开发布模态。
- **友情链接**：左侧列表搜索 / 删除，右侧填写名称 / 网址 / 描述并实时预览卡片；「新建」清空表单新增一条。
- **修改密码**：点顶栏「修改密码」，校验旧密码后把新密码哈希写入 `blogAdminPassHash`，下次用新密码登录。
- **发布**：点「发布」后弹窗提供 复制片段 / 下载 `posts-data.js` / 写回本机 / 🌐GitHub / ☁Cloudflare 五种动作，
  会把当前文章 + 友链整文件落到 `posts-data.js`（或对应远程目标）。

---

## 七、开发与生产过程

本项目采用**「单文件 + 数据驱动 + 迭代微调」**的开发方式，整体演进如下：

1. **起点**：以 432600.xyz 的数据为蓝本，做成单文件 HTML 导航页；`NAV_DATA` 数组最初位于
   页面中部，后移至底部并加「改这里即可」横幅注释，提升可编辑性。
2. **去模板化**：逐步清理原模板残留的 CSS 变量、JS 对象、localStorage key、
   页面 title 等痕迹，确立自己的命名与蓝色配色体系。
3. **浏览器内可视化编辑**：先实现带 `node serve.js` 鉴权的服务端方案；后为「更简单」，
   **改为纯浏览器方案**——用 File System Access API 直接读写本机 `index.html` / `posts-data.js`，
   并加一层客户端登录闸门，彻底去掉 node 依赖（`serve.js` 已弃用并归档）。
4. **代码质量保障**：每次改动后用 `node --check` / `vm.Script` 对各 `<script>` 块做语法校验，
   校验 `div/section/...` 标签开闭平衡，并用最小 DOM 桩实跑渲染 / 路由逻辑，确保结构完整、功能不受影响。
5. **搜索引擎管理**：将搜索引擎列表从硬编码抽成 `window.SEARCH_ENGINES` 数组，交由管理后台维护。
6. **UI 细节逐项打磨**：卡片网格 `auto-fit` → `auto-fill`（单列不拉伸）；字体层级区分主次；
   新增「关于本站」弹窗；页脚链接美化；版权区加「加载用时」；导航与博客统一为蓝色主题体系。
7. **GitHub 数据源**：让 admin / blog-admin 直连 GitHub Contents API 读写，无需后端（API 本身 CORS 开放），
   解决静态托管下后台无法直接写回服务器文件的问题。
8. **静态博客 + 数据分离**：新建纯静态博客，后演进为 **Pure 蓝色三栏布局**（左蓝侧栏 + 主区 + 右栏小工具），
   实现 hash 路由、`#/archives` / `#/links` / `#/about` 页面，并将文章 + 友链抽成独立 `posts-data.js`，与 `blog.html` 彻底解耦。
9. **博客后台 + 友链管理**：新建 `blog-admin.html`，复用导航后台的三数据源 + 改密码框架，
   增加「文章 / 友链」视图切换与完整 CRUD；Cloudflare Worker 放宽为通用 KV，同时服务
   `nav-data` / `blog-posts` / `blog-friends` 三个 key。

---

## 八、安全注意事项

- **后台密码是客户端闸门**：哈希在源码可见，仅防误改，不防蓄意攻击。两个后台的密码哈希
  （`adminPassHash` 与 `blogAdminPassHash`）相互独立，**不要部署在完全公开且不可信的环境中当作高安全后台**。
- **GitHub Token / Cloudflare 密钥**等同仓库或数据写权限：
  - 优先使用 **Fine-grained Token**（仅授予单个仓库的 Contents 读写）或最小权限 Token。
  - **不要在公共 / 他人电脑上勾留 Token**；连接信息存于 `localStorage`，清除浏览器数据即失效。
- **Cloudflare `ADMIN_SECRET`**：推荐用 `wrangler secret put` 注入，而非写进 `wrangler.toml` 明文。
- **第三方脚本**：`index.html` 中含 51.la 访问统计埋点（第三方请求）。如不需要或介意静默上报，
  可直接删除对应 `<script>` 块，不影响导航功能。

---

## 九、维护与校验

- **改导航 / 搜索引擎**：用 `admin.html`（三种数据源之一），不要手改 `NAV_DATA` 除非你知道自己在做什么。
- **改文章 / 友情链接**：用 `blog-admin.html`（三种数据源之一），直接改 `posts-data.js` 也可但易出错。
- **改「关于」页内容**：改 `blog.html` 内的 `SITE_INFO` 对象。
- **改主题配色**：导航站改 `index.html` 顶部 `:root` 的 `--theme`；博客改 `blog.html` 的顶部变量。
- **改卡片列数 / 列宽**：导航站改 `--card-base`（越大列数越少）；博客友链列宽在 `.friends` 的 `minmax`。
- **上线前自检**（本项目的标准动作）：
  1. `node --check` / `vm.Script` 校验所有 `<script>` 语法；
  2. 校验 HTML 标签开闭平衡（div/section/main/nav/footer 等）；
  3. 用最小 DOM 桩实跑渲染与路由逻辑，确认无运行期报错。
  4. ⚠️ 任何 `<script>` 字符串里若出现字面 `</script>`，HTML 解析会提前结束脚本块导致整页报废——
     代码生成数据片段时务必写成 `<\/script>`。

---

*本 README 由项目维护过程整理，覆盖导航站、两个管理后台、博客与 Cloudflare 后端的全部功能、
技术实现与部署方式。*
