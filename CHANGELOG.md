# 版本变更记录

本项目基于上游 [`ywdddddddddd/xuexitongScript`](https://github.com/ywdddddddddd/xuexitongScript) 的 V3.6（其上游为 [`chaolucky18/xuexitongScript`](https://github.com/chaolucky18/xuexitongScript)）。

版本号规则：`上游主版本.次版本.修订号.本地构建号`，例如 `3.6.0.6` —— 前三段跟上游，第四段每有一次本地改动 +1。油猴仪表盘与诊断报告里都能看到完整构建号。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [3.6.0.6] - 2026-09-14

### 新增

- **运行期版本号可见**：IIFE 顶部新增 `readBuildVersion()`，从油猴元数据读 `GM_info.script.version`，
  存进 `app.buildVersion`；启动横幅、面板标题、诊断报告的「脚本版本」行都会显示完整构建号
  （控制台直贴版没有 `GM_info`，自动回退到源码常量 `V3.6`）。
- **测试纳入仓库**：`tests/` 下三个套件（共 117 项断言）+ `tests/verify-sync.mjs`（校验油猴版 = 元数据 + 源码）。
- **持续集成**：`.github/workflows/ci.yml`，跑语法检查、同步校验、三个测试套件，以及红线静态扫描
  （禁止 `preventDefault`/`stopPropagation`/鼠标事件劫持/新增网络请求/`localStorage`，并校验裸 `setTimeout` 数量）。
- **文档体系**：新增 `AGENTS.md`（给 AI/自动化助手的入口）、`docs/architecture.md`（架构与状态字段速查、
  红线、调试手册、测试与发版流程）、`docs/index.md`（文档索引）；补丁说明统一收纳到 `docs/patches/`。
- **项目规范文件**：`.gitignore`、`.gitattributes`、`.editorconfig`、`CONTRIBUTING.md`、`SECURITY.md`、
  `CODE_OF_CONDUCT.md`，以及 GitHub 的 issue / PR 模板。

### 变更

- 文档文件名改为 ASCII，便于工具链与 CI 处理（内容仍为中文）。对照表见文末。

## [3.6.0.5] - 2026-09-14

### 修复

- **F19：点恢复播放后被误判成"用户主动暂停"**。视频暂停时点击画面恢复播放、随后迅速把鼠标移出浏览器，
  页面防挂机的 `pause()` 会被当成用户意图，脚本从此不再自动恢复。
  现在判定补上"用户意图方向"：若这次 play 是由最近一次交互触发的且此后没有新交互，
  紧随其后的暂停归因于页面（`pauseGuard` 直接拦截，也不会置 `_userPaused`）。
  详见 [docs/patches/pause-misjudge.md](docs/patches/pause-misjudge.md)。

### 新增

- 诊断报告新增 `lastUserInteractionMsAgo` / `lastUserPlayMsAgo` / `userPauseIntentNow`，用于定位"暂停被误判"这类问题。

## [3.6.0.4] - 2026-09-14

### 修复

- **F18：启动时不再注入 CDN jQuery 顶掉页面自己的实例**。油猴在 `@grant` 下运行于沙箱，
  沙箱里看不到页面自带的 jQuery（实测页面是 v1.7.2 而沙箱里是 `undefined`），原逻辑于是补注入一份 CDN 版，
  覆盖了页面的 `window.$`/`window.jQuery`，导致页面插件失效（`$(...).getNiceScroll is not a function` 实测刷了 720 次）。
  现在：优先使用页面自带的 jQuery；只有两个窗口都没有（或版本太老、没有 `.on`/`.off`）才注入，
  并在注入后立刻还原页面原有全局。详见 [docs/patches/jquery-bootstrap.md](docs/patches/jquery-bootstrap.md)。

### 新增

- 诊断报告新增 `jQuery 注入` 与 `启动时探测`（沙箱窗口 / 页面窗口分别能看到什么），用于判定这类冲突。

## [3.6.0.3] - 2026-09-14

### 修复

- **F17：调音量不再被误判成"用户主动暂停"**。原先任何播放器内的操作（含音量滑杆）都会刷新"用户刚操作过"的时间戳，
  于是调完音量把鼠标移出浏览器时，页面防挂机的暂停既被 `pauseGuard` 放行、又被记成用户意图，之后再也不自动恢复。
  现在音量/静音类操作单独计时，不计入暂停意图。

### 变更

- 删除了暂停后每秒重复打印的"按有界策略尝试恢复播放"（实际并未发起恢复，实测 60 行/分钟）；
  "用户暂停"提示改为每分钟最多一次。
- 面板状态行新增 `用户暂停: 是（不自动恢复）/ 否`。

## [3.6.0.2] - 2026-09-14

### 修复

- **诊断日志刷屏**：页面高频抛同一个错时（如缺 nicescroll 插件），原先每来一次就记一条并往控制台 echo 一次，
  瞬间冲爆面板与日志缓冲。现在按「来源 + 错误内容」去重并累加计数，控制台提示限量（默认前 5 条不同错误），
  报告里显示成 `（N 种 / 共 M 次）`。
- 日志采集与面板开关解耦：`guiEnabled=false` 时也会继续收集，否则出问题时"没有东西可导"。

## [3.6.0.1] - 2026-09-14

### 新增

- 首次发布：上游 V3.6 之上的本地补丁
  - **GUI 面板可拖动**（按住标题栏移动，位置仅本次会话有效）——
    [docs/patches/gui-drag.md](docs/patches/gui-drag.md)
  - **一键导出诊断报告**（日志 + 运行状态 + 视频/iframe 结构 + 选择器命中表）——
    [docs/patches/diagnostics.md](docs/patches/diagnostics.md)
  - 拖动与诊断的实现都遵循上游约定：不劫持事件（无 `preventDefault`）、所有定时器走 `_schedule()`、
    新增监听在 `destroy()` 时按引用摘除、不写 `localStorage`。

## 文档改名对照（3.6.0.6）

| 旧路径 | 新路径 |
| --- | --- |
| `docs/架构与维护指南.md` | `docs/architecture.md` |
| `docs/拖动补丁说明.md` | `docs/patches/gui-drag.md` |
| `docs/诊断导出说明.md` | `docs/patches/diagnostics.md` |
| `docs/暂停误判修复.md` | `docs/patches/pause-misjudge.md` |
| `docs/启动jQuery修复.md` | `docs/patches/jquery-bootstrap.md` |
