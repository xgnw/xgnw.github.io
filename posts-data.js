/* ============================================================
 * 博客文章数据（独立文件，由 blog-admin.html 的「发布」功能维护）
 * 前台 blog.html 通过  <script src="posts-data.js"></script>  加载本文件。
 * 增删文章只需修改本文件的 __POSTS__ 数组，页面体积不再随文章增长。
 * ============================================================ */
window.__POSTS__ = [
      {
        slug: "Chrome",
        title: "Chrome",
        date: "2026-09-01",
        tags: ["Chrome"],
        category: "Chrome",
        content: "# Chrome使用技巧\n\n\n\n## 网页截屏\n\n假设目前你已经打开需要截屏的网页，那么接下来按照以下步骤操作。\n\n第1步：打开Chrome调试工具——快捷键为 Ctrl + Shift + I\n\n第2步：打开命令列表——快捷键为 Ctrl + Shift + P\n\n第3步：输入 screenshot\n\n第4步：点击第 2 项 “Capture full size screenshot”，即可完成网页内容的全部截屏\n\n\n\n\n\n## 免费解锁 Medium 付费文章\n\n#### 第1种：通过 readium 书签\n\n第1步：访问 https://sugoidesune.github.io/readium/\n\n第2步：拖动 Readium 按钮到浏览器书签栏\n\n第3步：以后遇到付费文章，点击这个书签就可以自动解锁\n\n补充说明：这种方式有个缺点，浏览器书签栏 必须一直保持为显示状态\n\n\n\n#### 第2种：通过浏览器插件 Bypass Paywalls\n\n第1步：下载离线安装包 https://github.com/iamadamdev/bypass-paywalls-chrome/archive/master.zip \n\n第2步：打开Chrome扩展页，并开启 “开发者模式”\n\n第3步：将解压后的安装包目录拖到 Chrome 扩展页，点击确认即可安装成功\n\n第4步：将 Bypass Paywalls 固定在 Chrome 顶部\n\n第4步：以后遇到付费文章，点击这个扩展程序图标即可自动解锁\n\n\n## 实时查看当前页面渲染性能\n\n除了浏览器本身的 性能(Performance) 面板外，还有另外一个重要的、方便我们查看页面渲染性能的工具——Rendering。\n\n#### 开启Rendering方式\n\n1. 打开浏览器调试工具 DevTool\n\n2. 点击右侧 3 个小圆点\n\n3. 鼠标移动到 More tools\n\n4. 点击 Rendering\n\n5. 在新出现的 Rendering 面板中，勾选 Frame Rendering Stats\n\n   > 备注：在旧的谷歌浏览器中，应该勾选的是 Show FPS meter\n\n这样就可以在网页左上角，实时看到当前渲染性能状况。\n\n\n\n#### 性能数据解读\n\n性能展示的数据，主要 2 个模块：Frames 和 GPU\n\n**GPU 相关：**\n\n1. GPU raster ：on  表示 GPU 光栅化已开启\n\n2. GPU memory：GPU 已用大小、GPU 最大可用大小\n\n   > 在本示例中，通常是当修改浏览器尺寸时，此时需要大量计算，会显示出 GPU memory\n   >\n   > 在普通的 鼠标拖拽 改变地球视角时，不会显示 GPU memory\n\n**Frames相关：**\n\n假设某一时刻，渲染性能结果为 Frames：63% 1082(0m) dropped of 2737\n\n对应的解读为：\n\n第1个数字 63% —— 63% 的帧按时渲染完成\n\n第2个数字 1082 —— 有 1082 个合成帧丢失(未渲染)\n\n第3个数字 0m —— 有 0 个帧丢失\n\n第4个数字 2737 —— 原本计划渲染 2737 个帧\n\n数字之间的计算关系为 63% ≈ 1 - (1082 + 0 )/ 2737\n\n也就是说 第2个数字(丢失的合成帧)越小，那么整体按时完成渲染帧的百分比(第1个数字)越大，意味着此刻网页越流畅。\n\n"
      },
      {
        slug: "code",
        title: "代码注释的一些特殊用法",
        date: "2026-08-25",
        tags: ["代码", "注释"],
        category: "代码",
        content: "# 代码注释的一些特殊用法\n\n\n\n## 用关键词表明代码某种状态\n\n假设有代码注释为：\n\n```\nxxxxx  // TODO\n\nxxxxx  // HACK\n\nxxxxx  // XXX\n\nxxxxx  // FIXME\n\nxxxxx  // REVIEW\n```\n\n**TODO：** 表明这段代码还未完全写完，有待编写\n\n**HACK：** 有 2 层含义，分别为\n\n1. 表明这段代码当前走了 一个捷径，需要我们根据实际需求去调整这段代码\n2. 表明这段代码有可能会有更好的解决方式\n\n**XXX：**表明这段代码有问题，应该尽快修复\n\n**FIXME：** 表明这段代码有问题，但问题严重性并不是特别大，也会尽快修复\n\n**REVIEW：** 表明这段代码需要评审\n\n\n\n<br>\n\n## 让TypeScript忽略检查\n\n假设有段代码虽然 TypeScript 检测到错误，但是我们依然决定要这样执行，那么我们可以添加代码注释，让 TypeScript 忽略掉这段代码检查。\n\n\n\n将 //@ts-ignore 添加到代码 xxxxx 上面一行，可以让 TS 忽略对 这一行代码的检查，即使下一行代码有错误，那么也不会显示错误消息。\n\n```\n//@ts-ignore\nxxxxxx\n```\n\n\n\n禁止在文件的下一行显示 @ts-check 错误，预计至少存在一个错误。\n\n```\n//@ts-expect-error\nxxxxxx\n```\n\n\n\n将 //@ts-nocheck 添加到代码最顶部，则忽略全文检查\n\n```\n//@ts-nocheck\n```\n\n\n\n将 //@ts-check 添加到代码最顶部，则全文必须检查\n\n```\n//@ts-check\n```\n\n\n\n**使用建议：**\n\n1. 建议全局开启 TS 严格检查模式\n2. 只有在万不得已的情况下，才应该使用 //@ts-ignore\n\n\n\n<br>\n\n**在声明 TS 全局对象类型时，使用 3 个斜杠的特殊注释可以引入第三方对象：**\n\n在 global.d.ts 中全局定义某些类型，假设我们需要引入第三方定义的对象，由于在声明文件中无法使用 import ，所以只能通过这种 3 斜杠注释的形式来引入。\n\n\n\n第 1 种：引入 xxx 类型\n\n```\n/// <reference types=\"xxx\" />\n```\n\n\n\n第 2 种：导入 xx.d.ts 文件\n\n```\n/// <reference path=\"xxx.d.ts\" />\n```\n\n\n\n在日常的 ts 或 tsx 中，我们是使用不到这种注释类型的。我们想引入某个类直接 import 即可。\n\n\n\n<br>\n\n## 让ESLint忽略一些检查\n\n忽略本行：\n\n```\n/* eslint-disable-line\n```\n\n<br>\n\n## 让WebPack忽略一些检查\n\n忽略因为动态引入而引发的警告：\n\n```diff\n- const { IFCLoader } = await import( '../files/jsm/loaders/IFCLoader.js');\n+ const { IFCLoader } = await import( /* webpackIgnore: true */ '../files/jsm/loaders/IFCLoader.js');\n```\n\n> 像上述示例代码，如果不添加忽略检查的注释，则会收到警告：Critical dependency: the request of a dependency is an expression\n\n"
      },
      {
        slug: "hello",
        title: "新的开始",
        date: "2026-08-24",
        tags: ["随记"],
        category: "随记",
        content: "这是我新建的**个人博客**。\n\n在这里我会分享一些学习过程中整理的笔记与心得。由于并非专业，内容只能尽力写好每一篇。\n\n> 一个人最好的生活状态，是有人爱时全力拥抱，没人爱时专注自己。\n\n本站采用与 432600.xyz 同源的卡片化视觉，浅色与深色主题均做了适配。"
      },
      {
        slug: "blog-howto",
        title: "这个博客是怎么做出来的",
        date: "2026-08-24",
        tags: ["网站制作", "教程"],
        category: "教程",
        content: "这是一个**纯静态**博客，没有任何后端或构建工具，全部内容都在这一个 `blog.html` 文件里。\n\n## 核心思路\n\n1. 文章数据集中在页面底部的 `POSTS` 数组，改数据即改页面。\n2. 列表与详情都用哈希路由（`#/post/<slug>`）切换，单文件内完成。\n3. 视觉风格参考 Pure 主题的蓝色侧栏三栏布局，沿用同源导航网的卡片化细节。\n\n## 如何新增一篇文章\n\n只需在 `POSTS` 数组里加一个对象：\n\n```js\n{\n  slug: \"my-post\",\n  title: \"我的文章\",\n  date: \"2026-08-25\",\n  tags: [\"标签\"],\n  content: \"正文用 **Markdown** 写~\"\n}\n```\n\n保存后用浏览器打开即可看到。"
      },
      {
        slug: "markdown-demo",
        title: "Markdown 语法速查",
        date: "2026-08-24",
        tags: ["教程"],
        category: "教程",
        content: "博客内置了一个轻量 Markdown 渲染器，支持以下常用语法：\n\n### 标题\n\n用 `#` 到 `######` 表示一至六级标题。\n\n### 强调\n\n- **加粗**：用 `**文字**`\n- *斜体*：用 `*文字*`\n- `行内代码`：用反引号包裹\n\n### 列表\n\n无序列表用 `-` 或 `*`：\n\n- 第一项\n- 第二项\n  - 嵌套项\n\n有序列表用数字：\n\n1. 第一步\n2. 第二步\n\n### 引用与链接\n\n> 引用一段文字，用 `>` 开头。\n\n访问 [简单导航](new.html) 看看同源风格的导航站。\n\n### 分割线\n\n---"
      }
];/* ============================================================
     * 友情链接数据：新增友链只需往 FRIENDS 数组加一个对象即可
     * ============================================================ */
    var FRIENDS = [
      { name: "简单导航", url: "new.html", desc: "本人维护的导航站，收录常用的网站与工具。" },
      { name: "432600.xyz", url: "https://432600.xyz/", desc: "博客与导航站视觉风格的参考来源站。" },
      { name: "百度", url: "https://www.baidu.com", desc: "搜索引擎（占位示例，可替换为自己常逛的站）。" }
    ];