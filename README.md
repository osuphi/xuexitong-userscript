# 学习通自动刷课脚本 V3.6（可拖动面板 + 诊断导出）

学习通（超星）课程视频自动播放与自动切换的浏览器脚本，右上角带一个可拖动的可视化监控面板，并支持一键导出含运行状态的诊断报告。

## 简介

本仓库在 V3.6 基础上叠加了四处本地补丁（均已在实机验证），完整出处见文末「来源与致谢」：

1. **右上角的 GUI 监控面板支持拖动** —— 见 [docs/patches/gui-drag.md](docs/patches/gui-drag.md)
2. **一键导出诊断报告**（日志 + 运行状态 + 选择器命中情况）—— 见 [docs/patches/diagnostics.md](docs/patches/diagnostics.md)
3. **暂停误判修复**：调音量、点恢复播放后鼠标移出，不再被误判成"用户主动暂停" —— 见 [docs/patches/pause-misjudge.md](docs/patches/pause-misjudge.md)
4. **启动 jQuery 策略修复**：优先使用页面自带的 jQuery，不再注入 CDN 版顶掉页面插件 —— 见 [docs/patches/jquery-bootstrap.md](docs/patches/jquery-bootstrap.md)

解决什么问题：

- 学习通的课程视频需要一节一节手动点开，中途被暂停还要手动恢复；
- 原有的监控面板固定在右上角，会挡住视频画面或左侧课程目录。

适合谁：需要在学习通上连续观看课程视频、并希望用可视化面板随时确认脚本运行状态的用户。

## 功能

- 自动播放课程视频，并按配置倍速播放（默认 1.0 原速）
- 自动切换：同小节的下一个视频任务点 → 下一小节 → 下一章
- 小节内有多个视频任务点时逐个播完，不会只播第一个
- 异常暂停/卡顿自动恢复：只在"进度确实停滞"时才动手，带冷却与每小节次数上限；**默认连用户点的暂停也会自动恢复**（`respectUserPause`，见「默认配置」）
- 页面切到后台时保持播放（后台保活）
- 拦截平台"鼠标移出页面自动暂停"的防挂机暂停
- 片尾停滞保护：即将播完且平台已标记任务点完成时直接推进
- 视频元素自动发现：多层 iframe、跨域 frame 容错、节点失效后缓存重查
- 任务点弹窗处理：点"去学习/去完成"回到未完成任务点，而不是硬点"下一节"
- 右上角 GUI 监控面板：**可拖动（本项目补丁）**、可折叠、镜像控制台日志、提供快捷按钮
- **导出诊断报告（本项目补丁）**：一键把日志、运行状态、视频与 iframe 结构、选择器命中表导出成文件，便于排查问题
- **不含任何自动作答功能**：互动题弹窗只检测并提示人工完成；每节课末尾的章节测验/作业直接跳过

## 技术栈

- 原生 JavaScript —— 浏览器内运行的 IIFE，无框架、无打包器、无运行时依赖
- jQuery 3.6 —— 优先使用课程页面自带的；页面没有时才回退到 CDN
- Node.js —— **仅**用于把唯一源码拼装成油猴版，见 [scripts/build-userscript.mjs](scripts/build-userscript.mjs)

## 环境要求

- 现代浏览器（Chrome / Edge / Firefox）—— 拖动功能依赖 Pointer Events
- Tampermonkey 扩展（推荐；也可以把源码直接粘进浏览器控制台）
- Node.js >= 20.11 —— **仅**在需要重新生成油猴版时用到（构建脚本使用了 `import.meta.dirname`）

## 安装

```bash
git clone https://github.com/osuphi/xuexitong-userscript.git
cd xuexitong-userscript
```


仓库是公开的，因此也有更省事的方式 —— 直接在浏览器里打开这个链接，油猴会弹出安装界面：

```
https://raw.githubusercontent.com/osuphi/xuexitong-userscript/main/v3_optimized.user.js
```

或者用油猴的「实用工具 → 从 URL 安装」粘贴上面的地址。手动安装：

安装脚本：

1. 打开 Tampermonkey → 「添加新脚本」；
2. 用 `v3_optimized.user.js` 的内容替换编辑器里的默认模板，`Ctrl+S` 保存（或直接把该文件拖进浏览器窗口，按提示安装）；
3. 打开学习通课程播放页，脚本会自动启动。

## 使用

打开学习通课程页（地址包含 `/mycourse/studentstudy`），脚本自动运行，右上角出现监控面板。

面板操作：

- **拖动**：按住顶部标题栏拖到任意位置（位置仅在本次页面会话内有效，刷新后回到右上角）
- **折叠**：点标题栏右侧的 `—` / `+`

页面控制台里可以拿到 `app` 对象：

```js
app.run();                        // 重新启动
app.nextUnit();                   // 立即切到下一小节
app.resumeAutoPlay();             // 取消"用户主动暂停"状态，恢复自动保活
app.destroy();                    // 停止并清理定时器与事件监听
app.configs.playbackRate = 2;     // 改倍速后再执行 app.run()
```

### 排查问题：导出诊断报告

出问题时点面板上的 **「导出诊断」**，或者按 `F12` 打开控制台执行：

```js
app.exportDiagnostics();          // 导出可读的 txt 报告（含完整日志）
app.exportDiagnostics('json');    // 导出结构化 json，便于附加到 issue
app.getLogs();                    // 直接返回日志文本，可手动复制
app.getDiagnostics();             // 返回结构化诊断对象，不落盘
```


报告生成与下载全部在本地完成（Blob + `<a download>`），不发任何网络请求；页面地址与视频地址都会自动去掉 query 参数，避免把临时票据带进报告。

## 构建

本仓库遵循"单一源码"约定：`v3_optimized.js` 是唯一实现，`v3_optimized.user.js` 是构建产物，**不要手改油猴文件**。修改源码后执行：

```bash
node scripts/build-userscript.mjs
```

## 维护与二次开发

想继续改这个脚本（人或 AI 助手）请先读这两份：

- [docs/architecture.md](docs/architecture.md) —— **启动与运行期的完整时序**、**状态字段速查表**（谁写、谁读）、"用户意图判定"这块最容易改错的地方、**7 条红线**、调试手册（症状 → 先看哪个字段）、测试怎么跑与怎么写新用例、发版流程、上游 F1–F16 修复索引。
- [AGENTS.md](AGENTS.md) —— 给 AI / 自动化助手的精简入口：硬性规则、改完必须跑的命令清单、版本号规则、记录要求、不要做的事。

快速上手：改 `v3_optimized.js`（唯一源码）→ `node scripts/build-userscript.mjs` 重新生成油猴版 → `node --check` 两个文件 → 跑测试。

## 目录结构

```
.
├── README.md                    # 项目说明（入口）
├── CHANGELOG.md                 # 版本变更记录
├── CONTRIBUTING.md              # 贡献指南
├── SECURITY.md                  # 安全策略（凭据/隐私边界）
├── AGENTS.md                    # 给 AI / 自动化助手的工作约定
├── .gitignore / .gitattributes / .editorconfig   # 仓库与编辑器规范
├── v3_optimized.js              # 唯一源码（可直接粘进控制台运行）
├── v3_optimized.user.js         # Tampermonkey 油猴版（构建产物，故意提交）
├── .github/
│   ├── workflows/ci.yml         # 语法 + 同步 + 测试 + 红线静态扫描
│   ├── ISSUE_TEMPLATE/          # Bug 反馈模板（引导附诊断报告）
│   └── PULL_REQUEST_TEMPLATE.md
├── scripts/
│   └── build-userscript.mjs     # 由源码生成油猴版
├── tests/
│   ├── test-startup.mjs         # jQuery 获取策略、版本号解析（34 项）
│   ├── test-pause-fix.mjs       # 用户意图判定矩阵 + 恢复策略（45 项）
│   ├── test-diag.mjs            # 诊断导出（50 项）
│   └── verify-sync.mjs          # 校验「油猴版 = 元数据 + 源码」
└── docs/
    ├── index.md                 # 文档索引
    ├── architecture.md          # 架构、状态字段速查、红线、调试手册、发版流程
    └── patches/
        ├── gui-drag.md          # 面板拖动
        ├── diagnostics.md       # 诊断导出
        ├── pause-misjudge.md    # F17/F19：暂停被误判为用户意图
        └── jquery-bootstrap.md  # F18：启动 jQuery 策略
```

## 默认配置

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `playbackRate` | `1.0` | 平台按服务端统计学时，加速可能导致学时不达标 |
| `autoplay` | `true` | 进入视频页自动播放 |
| `guiEnabled` | `true` | 右上角监控面板（纯本地 DOM，零网络请求） |
| `pauseGuard` | `true` | 拦截无用户意图的暂停（最近 1.5 秒有操作则放行） |
| `interactionGuard` | `true` | 检测视频内互动题弹窗并暂停自动跳转 |
| `docTaskScroll` | `false` | 文档类任务点（PDF/PPT）自动翻阅 |
| `autoAdvanceNoVideo` | `false` | 无视频节点时是否自动前进 |
| `respectUserPause` | `false` | **本仓库默认**：不把用户的暂停当最终决定，暂停后仍会自动恢复（想真正停下请关闭本脚本）；设为 `true` 回到上游"尊重用户暂停"的行为 |
| `resumeMaxAttemptsPerUnit` | `5` | 每小节自动恢复的次数上限；**显式设为 `0` 表示不限次数** |
| `diagEnabled` | `true` | 收集日志与运行状态用于导出（与面板开关独立） |
| `diagLogMaxLines` | `2000` | 诊断日志缓冲上限（最小 50 条） |
| `diagCaptureErrors` | `true` | 是否捕获页面未处理错误 |
| `diagErrorEchoMax` | `5` | 最多对前几条「不同」错误做控制台提示，之后只写入报告（防止页面高频报错刷屏） |

## 已知限制

- **倍速与任务点由服务端判定**，脚本无法绕过；部分课程会忽略本地倍速或要求完整观看才计学时。
- **频繁抢播可能触发风控**：默认配置是"无论谁暂停都自动恢复"，恢复动作有冷却与每小节次数上限（可用 `resumeMaxAttemptsPerUnit: 0` 解开上限，但会让抢播更频繁）。
- **缺少完成标记的无视频节点无法自动判断**，脚本会安全停止，需要手动确认后再执行 `app.nextUnit()`。
- **页面改版会导致选择器失配**，届时日志会给出可操作提示，按提示刷新或手动点选小节即可。
- **面板位置不持久化**，刷新页面后回到右上角（与脚本"不写 localStorage"的约定一致）。

## 免责声明

本项目仅用于个人学习与浏览器自动化技术研究。使用本脚本产生的任何后果由使用者自行承担；请自行确认你的使用方式符合所在课程与平台的规定。

## 来源与致谢

- 派生自 [ywdddddddddd/xuexitongScript](https://github.com/ywdddddddddd/xuexitongScript) 的 V3.6（`master` 提交 `7a7a51a`）
- 上游项目：[chaolucky18/xuexitongScript](https://github.com/chaolucky18/xuexitongScript)
- V3.6 在 V3.4 的收敛式修复（导航死锁、多视频任务点、视频元素发现、风控相关暂停处理等）基础上叠加，修复依据来自上游的 issue 反馈与多个 PR 的思路
- 基线校验：本项目改动前的原始 `v3_optimized.js` git blob 为 `cd5d54b4aae93d53f35074326fe20dedb0be0903`，油猴版为 `4447e621e4e32119d6cbbf748b8239dcb1fc6093`，用本仓库构建脚本可逐字节复现
