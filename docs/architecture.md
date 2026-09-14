# 架构与维护指南

给要接手改这个脚本的人或 AI 助手。读完你应该能做到：**知道该改哪个函数、知道哪些线不能踩、知道改完怎么验证**。

配套阅读：[README](../README.md)（项目说明）、[拖动补丁说明](patches/gui-drag.md)、[诊断导出说明](patches/diagnostics.md)、[暂停误判修复](patches/pause-misjudge.md)、[启动jQuery修复](patches/jquery-bootstrap.md)。

---

## 1. 项目来源与归属

| 层 | 仓库 | 说明 |
| --- | --- | --- |
| 原创 | `chaolucky18/xuexitongScript` | 最早的脚本（V1/V2/V3），issue 区的问题反馈是后续修复的依据 |
| 上游 | `ywdddddddddd/xuexitongScript` | V3.4–V3.6，做了收敛式修复（F1–F16）并补了测试与构建脚本 |
| 本仓库 | `osuphi/xuexitong-userscript` | 在上游 V3.6 之上叠加本地补丁（见下）+ 维护文档 |

**本项目相对上游的全部改动**（其余代码与上游 V3.6 一致）：

| 编号 | 内容 | 文档 |
| --- | --- | --- |
| — | 右上角 GUI 面板支持拖动 | [拖动补丁说明](patches/gui-drag.md) |
| — | 一键导出诊断报告（日志/状态/选择器命中） | [诊断导出说明](patches/diagnostics.md) |
| F17 | 调音量不再被误判成"用户主动暂停" | [暂停误判修复](patches/pause-misjudge.md) |
| F19 | 点恢复播放后鼠标移出，不再被误判成"用户主动暂停" | 同上 |
| F18 | 启动时优先使用页面自带的 jQuery，不再注入 CDN 版顶掉页面插件 | [启动jQuery修复](patches/jquery-bootstrap.md) |
| — | 诊断日志按内容去重、控制台提示限量（防刷屏） | [诊断导出说明](patches/diagnostics.md) |

**基线校验**：改动前的原始 `v3_optimized.js` git blob 为 `cd5d54b4aae93d53f35074326fe20dedb0be0903`，油猴版为 `4447e621e4e32119d6cbbf748b8239dcb1fc6093`。用本仓库的构建脚本可以逐字节复现后者 —— 改动后跑一遍 `scripts/build-userscript.mjs` 即可确认基线没被误伤。

---

## 2. 文件结构

| 路径 | 能否手改 | 说明 |
| --- | --- | --- |
| `v3_optimized.js` | ✅ **唯一源码** | 全部逻辑都在这里；控制台直贴版就是它 |
| `v3_optimized.user.js` | ❌ **构建产物** | 由 `scripts/build-userscript.mjs` 生成，手改会在下次构建时被覆盖 |
| `scripts/build-userscript.mjs` | ✅ | 只做一件事：把油猴元数据块 + 源码拼成 `v3_optimized.user.js`；版本号在这里 |
| `docs/*.md` | ✅ | 各补丁的说明与维护文档 |

**约定**：`v3_optimized.user.js` 必须严格等于「元数据 + 源码」，改完源码一定要重新构建。

---

## 3. 标准改动流程

```bash
# 1) 改源码（只改 v3_optimized.js）
# 2) 重新生成油猴版
node scripts/build-userscript.mjs
# 3) 语法检查
node --check v3_optimized.js
node --check v3_optimized.user.js
# 4) 跑测试（见第 10 节）
```

**想在页面上快速试**：控制台直贴版不需要构建 —— 把 `v3_optimized.js` 全文粘进学习通课程页的控制台即可（会先 `destroy()` 掉旧实例）。

---

## 4. 启动流程（自上而下的时序）

1. **IIFE 入口**：清理上一实例（`window.__xuexitongPlayerV3`）→ 记录「启动探测」（沙箱/页面各自能看到什么）→ **取 jQuery**（F18：优先页面自带的，绝不覆盖页面全局；只有两处都没有才注入并还原）→ `waitForCoursePage()`。
2. **`waitForCoursePage()`**：每 1 秒轮询一次，要求 `#coursetree` 存在**且**已渲染出 `.posCatalog_select`；最多 20 次，超时给可操作提示。
3. **`initializePlayer()`**：构造 `app` 对象（全部状态字段都在这里声明）→ 挂到 `window.app` 与 `unsafeWindow.app`（后者是为了让页面控制台也能用）。
4. **`run()`**：`_clearTimers()` → 重置本轮状态 → 目录/视频缓存失效 → `_getTreeContainer()` → `_initCellData()` → `_getVideoEl()` → `_bindStepNavigation()` → `_startInteractionWatcher()` → `_bindVisibilityRecovery()` → `_diagInit()` → `_guiInit()` → `play()`。

> ⚠️ `run()` 可以重复调用（等于软重启）。**新增状态字段时，考虑要不要在 `run()` 里重置** —— 不重置会跨轮残留，这是最容易埋 bug 的地方之一。

---

## 5. 运行期主循环

```
play()                     找 video → 设倍速/静音 → _withTimeout(el.play()) → _startVideoMonitoring()
  └─ _checkVideoStatus()   每 1 秒跑一次（videoCheckInterval）
       ├─ 进度停滞？ → _isProgressStalled() → _tryResumePlayback()
       ├─ 片尾保护？ → 已播 ≥ videoCompleteRatio 且平台标记完成 → _handleVideoEnded()
       ├─ 暂停中？   → _userPaused ? 节流提示 : 尝试恢复
       └─ ended？    → _handleVideoEnded() → nextUnit()
  └─ 视频事件       play/pause/ended/loadedmetadata → _handleVideo*()
  └─ nextUnit()     任务点/文档任务点/内嵌作业优先处理 → _resolveCatalogPosition() → playCurrentIndex()
```

四条要点：

- **只有 `currentTime` 真的前进才算在播**（`_isProgressStalled()`），不能用 `paused === false` 判断。
- **恢复播放是有界的**：冷却 + 每小节次数上限（`resumeMaxAttemptsPerUnit`），持续播放 60 秒会把预算返还。
- **`nextUnit()` 的导航锁必须在所有退出路径上释放**（`try/finally` + `_releaseNavLock()`），否则会出现"再也切不了小节"的死锁（上游 F1）。
- **所有延时都必须走 `_schedule()`**，它会把定时器登记到 `_timers`，`destroy()`/`run()` 才能一次性清干净。

---

## 6. 「用户意图」判定（最容易改错的地方）

本脚本要区分两种暂停：**用户主动暂停**（必须尊重，不许抢播）和**页面防挂机的暂停**（要拦掉或恢复）。判定完全基于下面几个时间戳：

| 字段 | 谁写 | 含义 |
| --- | --- | --- |
| `_lastUserInteractionTs` | `_bindUserInteractionWatch()` | 用户在播放器里的最近一次操作（pointerdown/click/keydown），**音量/静音除外** |
| `_lastVolumeInteractionTs` | 同上 | 最近一次音量/静音操作（单独记，不作为暂停意图） |
| `_lastUserPlayTs` | `_handleVideoPlay()` | 最近一次**由用户交互触发**的播放（用来识别"用户刚点开播"） |

判定链条：

```
_isVolumeControlEvent(ev)   是音量控件吗？（只读事件目标，不拦事件）
        ↓ 否
_lastUserInteractionTs = now
        ↓ 随后的 play 事件距离它 ≤ userIntentMatchMs(800ms)？
_lastUserPlayTs = now       记下"这次播放是用户点出来的"

暂停来临时：
_wasJustUserResumed(now)    用户刚亲手点亮播放？（距 play ≤ userResumeGraceMs 3000ms，且此后无新交互）
_isUserPauseIntent(now)     用户在 userPauseWindowMs(2500ms) 内操作过 且 不是刚点亮播放
        ↓ true                         ↓ false
_userPaused = true（不再抢播）     按页面行为处理：拦截或自动恢复
```

**改这块之前请先读 [暂停误判修复](patches/pause-misjudge.md)** —— F17（调音量）和 F19（点恢复播放）都是"把用户的操作误当成暂停意图"造成的，两个 bug 的日志现象几乎一样，根因却不同。

改完必须让 `test-pause-fix.mjs` 的判定矩阵全绿（6 个场景）。加新场景比改阈值更划算。

---

## 7. 状态字段速查

> 声明位置：`initializePlayer()` 里的 `app` 对象字面量。下表的"谁写"只列主要写入点。

**播放与保活**

| 字段 | 含义 |
| --- | --- |
| `_isPlaying` | 脚本是否处于"我要它播"的状态（不代表视频真的在播） |
| `_userPaused` | 已判定为用户主动暂停，停止一切抢播 |
| `_userPausedNoticeTs` | "用户暂停"提示的节流时间戳（60 秒一次） |
| `_tryTimes` | `play()` 异常重试计数 |
| `_checkInterval` | 保活轮询定时器句柄 |
| `_guardLastTime` / `_guardLastWallTs` | 上一次 `currentTime` 值与当时的墙钟时间（停滞判定基准） |
| `_guardLastResumeTs` | 上次恢复播放的时间（冷却用） |
| `_resumeAttemptsThisUnit` / `_resumeCapLogged` | 本小节已用的恢复次数 / 是否已提示过上限 |
| `_progressStreakStart` | 连续正常播放的起点（满 60 秒返还预算） |
| `_pauseGuardBlocked` | 被拦截的防挂机暂停次数（日志前 3 次会打印） |
| `_hiddenKeepAliveActive` / `_hiddenResumeCount` | 后台标签页保活状态 / 后台续播次数 |
| `_guardProbeTimer` / `_seekBackTimesThisUnit` / `_seekBackCapLogged` | 保活阶梯的复检定时器 / 回拨重播次数 / 上限提示 |

**导航与目录**

| 字段 | 含义 |
| --- | --- |
| `_nextUnitPending` | 导航锁（**必须在所有退出路径释放**） |
| `_cellData` | `{cells, nCells, currentCellIndex, currentNCellIndex, currentVideoTitle, resolved, resolveSource}` |
| `_treeContainerEl` | `#coursetree` 的缓存（失效时靠 `isConnected` 判断） |
| `_chapterAdvanceTimes` | 章节测验连续跳过次数（上限 3，防循环） |
| `_consecutiveNoVideoAdvances` / `autoAdvanceNoVideo` | 连续自动前进次数 / 是否允许无视频节点自动前进 |
| `_stepSwitchPending` / `_stepSwitchAt` / `_stepAdvanceTimes` | 学习步骤切换的防抖状态 |

**视频元素与任务点**

| 字段 | 含义 |
| --- | --- |
| `_videoEl` / `_eventVideoEl` / `_boundVideoHandlers` | 当前 video 元素 / 已绑定事件的元素 / 处理函数引用（用于精确解绑） |
| `_currentVideoTaskIndex` / `_videoTaskCount` / `_videoTaskAllComplete` | 小节内视频任务点进度 |
| `_handlingVideoEnd` | 片尾处理的去重标志 |
| `_lastTaskPointDialogClickAt` / `_taskDialogClicksThisUnit` / `_taskDialogCapLogged` | 任务点弹窗点击的冷却 / 本小节次数 / 上限提示 |
| `_userMutedChoice` / `_muteTrackedEl` / `_muteHandler` / `_lastScriptMutedValue` | 用户静音选择的记忆与去重（区分"用户改的"和"脚本兜底改的"） |

**互动题 / LLM / 作业 / 文档任务点**

| 字段 | 含义 |
| --- | --- |
| `_interactionBlocked` / `_interactionWatcher` | 互动题弹窗导致暂停自动跳转 / 检测用的 interval |
| `_llmApiKey` / `_llmSessionId` / `_llmTransport` | 密钥（仅内存）/ 会话路由 ID / 自定义传输实现 |
| `_llmInFlight` / `_llmAbort` | 是否有在途请求 / 中止句柄 |
| `_llmAnswersThisSession` / `_llmLastAnswer` / `_llmLastQuestionKey` | 本会话应答数 / 最近答案 / 同题去重键 |
| `_llmWarnedNoKeyOnce` | "开了 LLM 但没配密钥"只提示一次 |
| `_llmChapterSuggesting` / `_llmChapterSuggestDone` / `_llmChapterSuggestedCount` | 章节测验建议（只提示、不点击）的进行状态 |
| `_workBusy` / `_docTaskBusy` | 内嵌作业 / 文档任务点的处理中标志 |

**GUI**

| 字段 | 含义 |
| --- | --- |
| `_guiPanelEl` / `_guiStatusEl` / `_guiLogEl` / `_guiBodyEl` | 面板与各区块元素 |
| `_guiCollapseHandler` / `_guiDragHandlers` | 折叠 / 拖动的事件处理函数引用（销毁时要按引用摘除） |
| `_guiPos` | 拖动后的位置（仅内存，刷新回到右上角） |
| `_guiLogs` / `_guiCollapsed` / `_guiLastRefreshTs` | 面板日志缓冲（受 `guiMaxLogLines` 限制）/ 折叠状态 / 刷新节流 |
| `version` / `buildVersion` | 上游版本常量（`V3.6`）/ 油猴元数据里的完整构建号（如 `3.6.0.6`；控制台直贴版读不到 `GM_info`，为空字符串） |

**诊断**

| 字段 | 含义 |
| --- | --- |
| `_diagLogs` | 完整日志缓冲（受 `diagLogMaxLines` 限制，默认 2000） |
| `_diagStartedAt` | 本轮启动时间（报告里的"已运行"） |
| `_diagErrors` / `_diagErrorHandlers` / `_diagErrorEchoCount` | 去重后的错误记录 / 错误监听器引用 / 已用掉的提示额度 |
| `_timers` | **所有**延时句柄的账本（`_schedule` 登记，`_clearTimers` 清空） |

---

## 8. 红线（改之前先看这 7 条）

1. **不改页面全局、不注入资源顶掉页面的东西。** F18 的教训：注入一份 jQuery 会把页面自己的 jQuery 实例顶掉，页面插件全线报错。
2. **不劫持页面事件。** 代码里不得出现 `preventDefault()` / `stopPropagation()`（上游的对抗测试会静态扫描这两项），也**不要**在 `document`/`window` 上监听 `mouseout`/`mouseleave` 去阻止暂停（旧实现这么干过，是风控的来源）。需要时用 CSS（`user-select`、`touch-action`）或改写元素自身方法。
3. **所有定时器走 `_schedule()`。** 除 `_schedule()` 与 `_withTimeout()` 内部，源码里不应出现裸 `setTimeout`/`setInterval`（`setInterval` 仅用于保活轮询、互动题检测等明确登记的场景）。
4. **不留监听残留。** 新增的监听必须保存函数引用，并在 `_guiDestroy()` / `destroy()` 里按同一引用摘除。判定标准：`destroy()` 后页面上不应残留脚本添加的监听或定时器。
5. **不写 `localStorage`、不新增网络请求。** 密钥、位置、选择都只存内存；对外请求只允许 jQuery CDN 与已声明的 LLM 端点。
6. **新增开关默认保守。** 一律默认关闭或默认不改变现有行为；涉及"替用户作答/提交"的功能默认关闭，并在文档里写清风险。
7. **失败要说话。** 任何异常退出路径都要打印可操作提示（确认页面地址、手动点目录、`app.run()`、刷新），不要静默停止。

---

## 9. 调试手册

**先导出一份诊断报告**（面板「导出诊断」或 `app.exportDiagnostics()`），然后按下表对号入座：

| 症状 | 先看 | 典型结论 |
| --- | --- | --- |
| 卡住不动 | 运行状态 `isPlaying`、`userPaused`、`nextUnitPending`；视频 `paused`/`readyState` | `userPaused=true` → 被判定成用户暂停；`nextUnitPending=true` → 导航锁没释放（F1 类问题） |
| 找不到视频 | 选择器命中表里各 `video` 选择器是否为 0；frame 结构里 `hasVideo` | 命中 0 说明播放器结构变了；`access=cross-origin` 说明 frame 跨域取不到 |
| 跳节/漏节 | 课程目录解析 `resolved`/`resolveSource`；`nCells` 与预期是否一致 | 解析失败时脚本应报错停止，而不是猜 |
| 暂停后不恢复 | `userPaused`、`userPauseIntentNow`、`lastUserInteractionMsAgo`、`lastUserPlayMsAgo` | 用来复盘"是不是又被误判成用户意图" |
| 页面插件报错 | `jQuery 来源`、`启动时探测` | `jQuery 来源` 不是"页面自带"就说明发生了注入，需要查 F18 逻辑 |
| 定时器/监听泄漏 | `pendingTimers` | 正常应为 0；持续增长说明有延时没登记或没清理 |
| 改版后失效 | 选择器命中表里标 `[0]` 的项 | 命中 0 的就是失配点，直接更新对应选择器 |

日志前缀含义：`[GUI]` 面板动作、`[防挂机]` 拦截的页面暂停、`[诊断]` 诊断采集提示、`[LLM]` 大模型相关。

---

## 10. 测试

三个脚本都是「从源码里抽取代码块 → 配桩执行 → 断言」，不依赖浏览器、不联网：

| 文件 | 断言数 | 覆盖 |
| --- | --- | --- |
| `test-startup.mjs` | 23 | jQuery 获取策略：页面自带/控制台直贴/确实没有需注入/版本太老 + 静态约束 |
| `test-pause-fix.mjs` | 33 | 音量控件识别、反向用例、**用户意图判定矩阵（6 场景）** + 静态约束 |
| `test-diag.mjs` | 50 | 诊断：日志缓冲与裁剪、错误去重与提示额度、URL 脱敏、报告结构、下载路径 |

跑法：`node test-xxx.mjs`，退出码 0 为通过。

**写新用例的注意事项**（都是踩过的坑）：

1. 抽取出来的代码块**看不到 IIFE 作用域里的变量**（例如 `jqueryInjectedByScript`、`startupProbe`）。测试里要给这些自由变量准备同名桩，否则会 `ReferenceError`。
2. `vm.runInNewContext(...)` 返回的是"完成值"；如果被求值的是一个函数表达式，**别忘了再调用一次** `()`。
3. 静态断言要**先去掉行注释**再扫描（注释里出现 `preventDefault` 这类词是允许的）—— 与上游对抗测试保持一致。
4. 抽取用的锚点字符串（函数头、块起始行）一旦被改动，测试会直接失败并提示"找不到 XX"，这是有意的保护。

---

## 11. 发版流程

**版本号规则**：`上游主版本.次版本.修订号.本地构建号`，例如 `3.6.0.5`。前三段跟上游（当前 V3.6 → `3.6.0`），第四段每次本地改动 +1。不改 `@name`/`@namespace`，这样油猴是就地替换而不是并排新增。上游升到 3.7.0 时重置为 `3.7.0.1`。

**运行期怎么显示版本**：`VERSION = 'V3.6'` 是上游标签常量；油猴版还能从 `GM_info.script.version` 读到完整构建号，读取逻辑是 IIFE 顶部的 `readBuildVersion()`，结果存进 `app.buildVersion`。三处会显示它：启动横幅（`=== 学习通自动刷课脚本 V3.6 / 构建 3.6.0.6 启动 ===`）、面板标题（`学习通脚本监控 3.6.0.6`）、诊断报告的「脚本版本」行。控制台直贴版没有 `GM_info`，自动回退成只显示 `V3.6` —— 所以拿到别人的诊断报告时，先看这一行就能确认对方装的是哪个构建。

1. 改 `v3_optimized.js`；
2. 更新 `scripts/build-userscript.mjs` 里的 `// @version`；
3. `node scripts/build-userscript.mjs`；
4. 跑三个测试 + `node --check`；
5. 校验「油猴版 = 元数据 + 源码」（可用 `String.endsWith` 粗查，或复刻上游的 `tests/verify-v3.mjs`）；
6. 更新文档：新补丁要单独写一份 `docs/*.md`，并同步 README 的补丁列表与文档索引；
7. 提交。

> 提交方式备忘：本仓库目前的提交是通过 GitHub API 逐文件写入的（作者环境里 `git push` 到 github.com 会 TLS 中断）。用常规 git 流程提交也完全可以，只要保证第 5 步的同步关系成立。

---

## 12. 上游历史修复索引（F1–F16）

这些是上游为解决 issue 反馈做的修复，读代码时会不断遇到它们的注释，索引在此便于理解"为什么代码长这样"：

| 编号 | 问题 | 相关函数 |
| --- | --- | --- |
| F1 | 导航死锁：失败一次后再也切不了小节 | `nextUnit()` / `_releaseNavLock()` |
| F2 | 一个小节只播第一个视频 / 跳错章节 | `_resolveCatalogPosition()` / `_getVideoTaskFrames()` |
| F3 | 无视频、纯课件小节卡死 | `_handleNoVideoNode()` / `_classifyNodeCompletion()` |
| F4 | 异常暂停反复抢播触发风控 | `_isProgressStalled()` / `_tryResumePlayback()` / `_isUserPauseIntent()` |
| F5 | 视频内互动题弹窗卡死 | `_findInteractionDialog()` / `_checkInteractionDialog()` |
| F6 | 少量播放器识别不到 video | `_videoSelectors()` / `_getVideoEl()` / `_invalidateVideoCache()` |
| F7 | 粘完没反应、文档链接失效 | IIFE 入口 / `waitForCoursePage()` |
| F9 | 运行情况只能看控制台 | `_guiInit()` 等 |
| F10 | 互动题需人工作答（可选 LLM） | `_answerInteractionWithLlm()` |
| F11 | 内嵌章节测验/作业（默认关闭） | `_handleEmbeddedWorks()` |
| F12 | 片尾停滞保护 | `_checkVideoStatus()` 内的 `videoCompleteRatio` 分支 |
| F13 | 文档任务点自动翻阅（默认关闭） | `_handleDocTasks()` |
| F15 | 拦截平台防挂机暂停 | `_installPauseGuard()` |
| F16 | 后台标签页保活 | `_startHiddenKeepAlive()` |

---

## 13. 已知缺口与后续可做的事

1. ~~版本号不可见~~ **已在 `3.6.0.6` 解决**：面板标题、启动横幅与诊断报告的「脚本版本」现在都会显示完整构建号（读 `GM_info.script.version`，控制台直贴版回退到 `V3.6`）。
2. **面板会镜像页面自身的 console 输出**（上游行为）。如果嫌吵，可以只显示脚本自己产生的日志。
3. **面板拖动位置不持久化**（遵循"不写 localStorage"的取舍）；想持久化需要先讨论是否接受落盘。
4. **章节测验/作业自动作答**默认关闭，本项目不跟进、也不做绕过风控的对抗（`ratechange` 回写、验证码绕过等一律不做）。
5. **上游若发布新版本**：按第 11 节的流程把本地补丁重新叠一遍；`docs/` 下每份补丁文档都写了"改动点在哪、怎么回滚"。
