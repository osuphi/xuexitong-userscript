# 学习通自动刷课脚本 V3.6（GUI 面板可拖动）

学习通（超星）课程视频自动播放与自动切换的浏览器脚本，右上角带一个可拖动的可视化监控面板。

## 简介

本项目基于 [ywdddddddddd/xuexitongScript](https://github.com/ywdddddddddd/xuexitongScript) 的 V3.6（其上游为 [chaolucky18/xuexitongScript](https://github.com/chaolucky18/xuexitongScript)），在其之上加了一处本地补丁：**右上角的 GUI 监控面板支持拖动**。补丁细节见 [docs/拖动补丁说明.md](docs/拖动补丁说明.md)。

解决什么问题：

- 学习通的课程视频需要一节一节手动点开，中途被暂停还要手动恢复；
- 原有的监控面板固定在右上角，会挡住视频画面或左侧课程目录。

适合谁：需要在学习通上连续观看课程视频、并希望用可视化面板随时确认脚本运行状态的用户。

## 功能

- 自动播放课程视频，并按配置倍速播放（默认 1.0 原速）
- 自动切换：同小节的下一个视频任务点 → 下一小节 → 下一章
- 小节内有多个视频任务点时逐个播完，不会只播第一个
- 异常暂停/卡顿自动恢复：只在"进度确实停滞"时才动手，带冷却与每小节次数上限
- 页面切到后台时保持播放（后台保活）
- 拦截平台"鼠标移出页面自动暂停"的防挂机暂停
- 片尾停滞保护：即将播完且平台已标记任务点完成时直接推进
- 视频元素自动发现：多层 iframe、跨域 frame 容错、节点失效后缓存重查
- 任务点弹窗处理：点"去学习/去完成"回到未完成任务点，而不是硬点"下一节"
- 右上角 GUI 监控面板：**可拖动（本项目补丁）**、可折叠、镜像控制台日志、提供快捷按钮
- 可选能力（均默认关闭）：文档任务点自动翻阅、互动题大模型应答、内嵌章节测验/作业自动作答

## 技术栈

- 原生 JavaScript —— 浏览器内运行的 IIFE，无框架、无打包器、无运行时依赖
- jQuery 3.6 —— 优先使用课程页面自带的；页面没有时才回退到 CDN
- Tampermonkey —— 油猴版通过 `GM_xmlhttpRequest` 发起可选的 LLM 请求
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

> 本仓库目前是私有仓库，`clone` 需要登录凭据。本脚本没有 npm 依赖，**不需要执行 `npm install`**。

安装脚本：

1. 打开 Tampermonkey → 「添加新脚本」；
2. 用 `v3_optimized.user.js` 的内容替换编辑器里的默认模板，`Ctrl+S` 保存（或直接把该文件拖进浏览器窗口，按提示安装）；
3. 打开学习通课程播放页，脚本会自动启动。

## 使用

打开学习通课程页（地址包含 `/mycourse/studentstudy`），脚本自动运行，右上角出现监控面板。

面板操作：

- **拖动**：按住顶部标题栏拖到任意位置（位置仅在本次页面会话内有效，刷新后回到右上角）
- **折叠**：点标题栏右侧的 `—` / `+`
- **按钮**：暂停/继续、下一节、LLM 开/关、自动提交 开/关、设置 Key、清空日志

页面控制台里可以拿到 `app` 对象：

```js
app.run();                        // 重新启动
app.nextUnit();                   // 立即切到下一小节
app.resumeAutoPlay();             // 取消"用户主动暂停"状态，恢复自动保活
app.destroy();                    // 停止并清理定时器与事件监听
app.configs.playbackRate = 2;     // 改倍速后再执行 app.run()
```

## 构建

本仓库遵循"单一源码"约定：`v3_optimized.js` 是唯一实现，`v3_optimized.user.js` 是构建产物，**不要手改油猴文件**。修改源码后执行：

```bash
node scripts/build-userscript.mjs
```

## 目录结构

```
.
├── v3_optimized.js              # 唯一源码（可直接粘进控制台运行）
├── v3_optimized.user.js         # Tampermonkey 油猴版（构建产物）
├── scripts/
│   └── build-userscript.mjs     # 由源码生成油猴版
└── docs/
    └── 拖动补丁说明.md           # 本项目补丁的改动清单、验证方式与回滚方法
```

## 默认配置

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `playbackRate` | `1.0` | 平台按服务端统计学时，加速可能导致学时不达标 |
| `autoplay` | `true` | 进入视频页自动播放 |
| `guiEnabled` | `true` | 右上角监控面板（纯本地 DOM，零网络请求） |
| `pauseGuard` | `true` | 拦截无用户意图的暂停（最近 1.5 秒有操作则放行） |
| `interactionGuard` | `true` | 检测视频内互动题弹窗并暂停自动跳转 |
| `llmEnabled` | `false` | 互动题大模型应答，需自备密钥，密钥只存内存 |
| `llmAutoSubmit` | `false` | 关闭时只选答案，提交留给人点 |
| `llmChapterTest` | `false` | 章节测验只给建议、不自动点击 |
| `llmEmbeddedWork` | `false` | 开启后会填答案并走平台原生提交流程 |
| `docTaskScroll` | `false` | 文档类任务点（PDF/PPT）自动翻阅 |
| `autoAdvanceNoVideo` | `false` | 无视频节点时是否自动前进 |

## 已知限制

- **倍速与任务点由服务端判定**，脚本无法绕过；部分课程会忽略本地倍速或要求完整观看才计学时。
- **频繁抢播可能触发风控**，因此自动恢复播放有冷却和每小节次数上限，达到上限后需要人工介入。
- **缺少完成标记的无视频节点无法自动判断**，脚本会安全停止，需要手动确认后再执行 `app.nextUnit()`。
- **页面改版会导致选择器失配**，届时日志会给出可操作提示，按提示刷新或手动点选小节即可。
- **私有仓库无法用 URL 直接安装油猴脚本**，请使用仓库内的本地文件安装。
- **面板位置不持久化**，刷新页面后回到右上角（与脚本"不写 localStorage"的约定一致）。

## 免责声明

本项目仅用于个人学习与浏览器自动化技术研究。使用本脚本产生的任何后果由使用者自行承担；请自行确认你的使用方式符合所在课程与平台的规定。

## 来源与致谢

- 派生自 [ywdddddddddd/xuexitongScript](https://github.com/ywdddddddddd/xuexitongScript) 的 V3.6（`master` 提交 `7a7a51a`）
- 上游项目：[chaolucky18/xuexitongScript](https://github.com/chaolucky18/xuexitongScript)
- V3.6 在 V3.4 的收敛式修复（导航死锁、多视频任务点、视频元素发现、风控相关暂停处理等）基础上叠加，修复依据来自上游的 issue 反馈与多个 PR 的思路
- 基线校验：本项目改动前的原始 `v3_optimized.js` git blob 为 `cd5d54b4aae93d53f35074326fe20dedb0be0903`，油猴版为 `4447e621e4e32119d6cbbf748b8239dcb1fc6093`，用本仓库构建脚本可逐字节复现
