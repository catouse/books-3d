# 林间绘本馆 · 互动 3D 绘本

可本地运行的中文互动绘本网站。基于 React、TypeScript、Three.js 和 Vite，所有封面、纸张纹理、立体模型与音效均在本地生成，无需远程素材服务或 API 密钥。

## 启动

需要 Node.js 22.12+（已用 Node.js 25 验证）。

```sh
npm install
npm run dev
```

打开终端显示的 Local 地址（默认 http://localhost:5173，端口占用时会自动顺延；本次预览为 http://localhost:5174）。手机可在同一局域网打开终端显示的 Network 地址。

```sh
npm run build
npm run preview
```

`dist/` 是构建成品。请通过 HTTP 服务访问；直接双击 HTML 不支持 ES 模块加载。

## Cloudflare 部署

线上地址：[books-3d.catou.se](https://books-3d.catou.se)。

通过 Cloudflare Workers 静态资源托管 `dist/`，配置在 `wrangler.jsonc`。Worker 名称为 `books-3d`，自定义域名为 `books-3d.catou.se`；Cloudflare 会管理对应的 DNS 记录和 HTTPS 证书。

### GitHub 推送后自动部署

已于 2026-09-13 在现有 Worker 的 [构建设置](https://dash.cloudflare.com/95f1c6b69dfd70b5d10ed6ab57ca07f6/workers/services/view/books-3d/production/settings#builds) 中连接 GitHub，自动部署配置如下：

| 配置 | 值 |
| --- | --- |
| GitHub 仓库 | `catouse/books-3d` |
| 生产分支 | `main` |
| 根目录 | `/` |
| 构建命令 | `npm run build` |
| 部署命令 | `npx wrangler deploy` |
| 构建变量 | `NODE_VERSION=24` |
| 构建缓存 | 开启 |
| 非生产分支构建 | 关闭 |

依赖使用仓库中已提交的 `package-lock.json` 安装。部署凭据保存在 Cloudflare 的构建设置中，无需写入仓库。构建命令已经包含 TypeScript 检查；部署命令单独发布构建好的 `dist/`，避免使用 `npm run deploy` 再构建一次。

每次推送到 `main` 都会触发构建，成功后更新 [books-3d.catou.se](https://books-3d.catou.se)。其他分支关闭自动构建；合并到 `main` 后才发布线上版本。构建和部署日志可在 Worker 的 [构建历史记录](https://dash.cloudflare.com/95f1c6b69dfd70b5d10ed6ab57ca07f6/workers/services/view/books-3d/production/builds) 页面查看。

这是 Cloudflare 端的一次性配置；仅提交 `wrangler.jsonc` 不会启用自动部署。连接时已通过 GitHub 当前提交的干净 `npm ci`、生产构建和 Wrangler 部署预检；首次云端构建等待下一次推送到 `main` 后验证。流程参考 [Workers Builds 文档](https://developers.cloudflare.com/workers/ci-cd/builds/)。

### 本地手动部署

首次部署时登录拥有 `catou.se` 的 Cloudflare 账户：

```sh
npm ci
npx wrangler login
```

之后运行以下命令构建并发布当前代码：

```sh
npm run deploy
```

只检查构建与部署配置、不发布时：

```sh
npm run build
npx wrangler deploy --dry-run
```

部署上传的内容仅来自 `dist/`。收藏仍保存在访问者当前域名的浏览器 localStorage 中。

## 体验

- 从真实 3D 书架或书名选择绘本，书本移动至桌面、打开封面，角色和风景立起。
- 开书后舞台平滑扩展为沉浸式阅读空间，隐藏首页介绍、导航、收藏入口和页脚，仅保留故事、页码、声音及返回控件。故事文字与操作集中在底部，不遮挡角色。
- 五本完整短故事，每本四幕：小兔送星星回家、鲸鱼邀请朋友看彩虹、狐狸归还铃铛、松鼠和朋友运大核桃、小熊送树叶伞。桌面一排展示五本，手机分成上三本、下两本。
- 点击角色或场景物件触发反馈；也可使用下面的中文按钮进行键盘操作。
- 每一幕互动结束后，主动选择翻页。立体物完全收起后才翻页，下一幕在翻页完成后才出现。
- 最后可以回答一个回忆问题，也可以直接领取书签；收集记录保存在当前浏览器的 localStorage，浏览器禁止存储时会提示。新增核桃和树叶书签兼容原有收藏。
- 音乐及音效在首次操作后启动，可随时静音；切换后台会暂停。没有朗读或语音。
- 返回书架按钮可中途返回，连续收书后恢复原来的滚动位置与选书焦点；再次选择从头阅读，已收集的奖励不会消失。

## 结构与状态

- `src/scene.ts`：常驻 Three.js 世界、模型、封面绘制、灯光、拾取、镜头与动画。
- `src/stories.ts`：五本书的封面信息、四幕文案、分步互动、回忆问题与书签配置。两本新书的完整文稿见 [新增绘本](artifacts/new-books.md)。
- `src/audio.ts`：Web Audio 背景乐、轻点击、翻纸与星光音效。
- `src/App.tsx`：语义 UI、同步状态锁、测验、收集与弹窗。
- `src/styles.css`：响应式布局、纸张效果、设计变量、光标余迹。
- `DESIGN.md`：视觉和交互约定。

状态顺序：`loading → shelf → opening → reading → reacting → reading → turning`，四幕后进入 `quiz → celebrating → reward`；返回经过 `closing → shelf`。动作开始前同步写入 ref 锁，渲染状态更新前的连击同样会被拦截。页码只在翻页演出完成后递增。

封面和模型由程序生成，启动时等待字体就绪和场景准备完成再开放选书。遵循系统“减少动态效果”设置，保留故事顺序，缩短运动并关闭鼠标余迹。所有网络依赖只发生在依赖安装阶段。

## 验证

```sh
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

Playwright 覆盖五本书通关、连击、分步合作、树叶伞跟随小兔、可跳过的回忆问题、奖励持久化、音量开关、弹窗和手机点触；也检查手机下层书架可点选、新旧书签共存、沉浸界面隐藏首页内容、扩大并复用画布，以及横屏返回后的滚动位置和键盘焦点。失败报告在 `artifacts/test-results/`；人工检查截图保存在 `artifacts/`。测试使用 Chromium；真实 iOS/Android 设备以及 Safari 的音频输出需在对应设备上进一步确认。

Three.js 参考：[WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)、[picking](https://threejs.org/manual/en/picking.html)。

### 初版沉浸阅读检查结果（2026-09-12）

- TypeScript 类型检查、Vite 生产构建、设计静态审查通过。
- 沉浸版 11 项 Playwright 检查通过：独立输出目录的主轮通过 10 项；连击检查改为在点击前逐帧观察短暂的翻页隐藏阶段，针对性复跑通过。包含三本书通关、中文界面与封面检查、键盘和手机触摸操作、收藏持久化及异常恢复。
- 已查看 1440×1000 桌面、390×844 手机竖屏及 844×390 横屏截图。桌面画布高度从 415px 增至 860px，手机竖屏从 320px 增至 645px；横屏保留 278px 舞台。主角、故事物件与可见封面无裁切，文字没有遮脸，无横向溢出。
- 阅读、测验与领奖阶段均隐藏首页内容；画布实例保持不变，返回后恢复原书架滚动位置和书名焦点。
- 正常流程无控制台、脚本或资源加载错误。WebGL 故障注入测试中预期的初始化错误单独识别。
- 生产 JS 压缩传输约 245 KB；Vite 有单文件超过 500 KB 的体积提示，不影响构建。


### 新增两本故事检查结果（2026-09-12）

- 五本故事的整轮 Playwright 检查 18 项通过；核桃壳遮挡调整后的桌面、手机复查另有 2 项通过。类型检查、生产构建和严格 UI 静态审查通过。
- 已检查双层手机书架、新旧书签共存、树皮铺好后才能推核桃，以及交伞后叶伞随小兔移动。新分类标签实测文字对比度分别为 4.89:1、4.82:1。
- 完整文稿与验证范围见 [新增绘本](artifacts/new-books.md)，截图在 `artifacts/`。
