# AI 协作用交接文档

> 产品决策背景，以及踩过的坑。项目是什么、怎么改，看 [README](../README.md) 与 [architecture.md](architecture.md)。

## 1. 开工前先读这三份

1. [`AGENTS.md`](../AGENTS.md) —— 硬性规则与命令清单
2. [`docs/architecture.md`](architecture.md) —— 架构、状态字段速查表、红线、调试手册、发版流程
3. 本文档 —— 环境与流程（否则很可能卡在"推不上去"或"误删文件"上）

## 2. 本机环境（Windows + Codex 沙箱）

| 事实 | 影响 / 对策 |
| --- | --- |
| 本地真源是 `C:\Users\osuphi\Documents\Codex\2026-09-14\z\outputs\`（= 仓库的本地副本），`work/` 放中间产物 | 所有改动都做在 `outputs/`；临时脚本、测试草稿放 `work/`（已在 `.gitignore` 里） |
| 沙箱默认只允许写工作区，网络默认关闭 | 需要联网/写外部路径时用 `request_permissions`（`network: true` 可用）；**不要依赖 `require_escalated`**，某些回合的审批策略会直接拒绝它 |


```powershell
```

## 3. 产品边界（代码读不出、由项目所有者拍板）

- **不含任何自动作答/自动提交**。LLM 子系统已整体移除；视频内互动题弹窗**只检测并提示人工完成**；
  每节课末尾的章节测验/作业**直接跳过**。
- **默认"始终自动播放"**（`respectUserPause: false`）：用户点的暂停不是最终决定，暂停后仍会自动恢复。
  需要真正停下就关掉脚本 —— 这是项目所有者的明确取舍。想回到保守行为可设 `true`。
  `resumeMaxAttemptsPerUnit: 0` 表示不限恢复次数（默认 5 次/小节，保留这层保护是为了别把平台风控惹毛）。
- **不绕过平台风控**：不做 `ratechange` 强制回写、不做验证码绕过、不伪造观看时长上报。
- **不写 `localStorage`、不落盘**：面板拖动位置、诊断开关都只存在内存里，这是有意为之，别"顺手"加持久化。
- **不新增网络请求**：唯一外链是"页面缺 jQuery 时补加载 CDN"。`@grant GM_xmlhttpRequest` 保留只是为了继续运行在
  油猴沙箱里（去掉全部 `@grant` 会改成注入页面上下文），脚本内没有任何网络调用 —— CI 的 `tests/redlines.mjs` 会静态校验。
- 文档用中文；每处修复要在 `docs/patches/` 下补一份"现象 → 根因 → 修复 → 验证 → 回滚"。

## 4. 改动与验证流程

```bash
# 1) 只改唯一源码
#    改 v3_optimized.js（不要手改 v3_optimized.user.js）
node scripts/build-userscript.mjs      # 2) 重新生成油猴版
node --check v3_optimized.js           # 3) 语法
node tests/verify-sync.mjs             # 4) 油猴版 = 元数据 + 源码
node tests/redlines.mjs                # 5) 红线静态扫描
node tests/test-startup.mjs            # 6) 34 项
node tests/test-pause-fix.mjs          # 7) 45 项（用户意图判定矩阵）
node tests/test-diag.mjs               # 8) 50 项
```

以上这些 CI（`.github/workflows/ci.yml`）也会跑。**测试覆盖不到运行期调用**，所以改完删函数后，
除了跑测试，还要 grep 一遍被删符号是否还有残留调用（`this._xxx`）。

交付给用户时：给出 `outputs/v3_optimized.user.js` 的绝对路径、版本号、SHA256，并说明该版本要重装。

## 5. 已知坑速查（症状 → 先看什么）

| 症状 | 先看 | 说明 |
| --- | --- | --- |
| 调音量 / 点恢复播放后鼠标移出，视频停下不再恢复 | `_isUserPauseIntent` / `_wasJustUserResumed` / `respectUserPause` | F17、F19：以前是"用户意图"误判；现在默认还会自动恢复，但判定链本身别改坏 |
| 页面插件报 `$(...).getNiceScroll is not a function` | 诊断报告的 `jQuery 来源` / `启动时探测` | F18：油猴沙箱看不到页面自带 jQuery，历史实现会补注入 CDN 版顶掉页面实例。现在优先用页面自带的 |
| 暂停后不恢复、日志被同一句话刷屏 | `_userPaused`、`diagErrorEchoMax`、`_noteUserPausedStall` | 诊断的错误去重与提示额度、用户暂停提示的节流都在这里 |
| 卡在某一节再也不切小节 | 诊断报告 `nextUnitPending` | 导航锁必须在**所有**退出路径释放（`try/finally` + `_releaseNavLock()`） |
| 脚本"粘上去没反应" | 启动横幅、`jQuery 来源`、诊断报告 `启动时探测` | 页面结构改版（选择器命中 0）或 CDN 被拦都会这样 |
| 定时器/监听泄漏 | 诊断报告 `pendingTimers` | 正常为 0；新增延时必须走 `_schedule()`，新增监听必须能按引用摘除 |

## 6. 候选改进清单（接手时可直接挑）

- README 顶部加 CI 状态徽章（仓库已公开，可直接用）
- 面板目前会镜像页面自身的所有 `console` 输出；可考虑只显示脚本自己产生的日志
- 源码是否移入 `src/`（当前刻意放在根目录：单文件即交付物，便于"粘贴即用"与跟上游同步）
- 面板位置持久化（需要先确认是否接受写 `localStorage`，目前是有意不写）
- `CHANGELOG.md` 目前手写，可考虑从提交信息生成
- **没有真机自动化测试**：测试是"从源码抽代码块 + 桩执行"，真正的浏览器行为只能让用户装上脚本人工验证
- 诊断报告在长时间运行后可能较大（日志上限 2000 行），可考虑导出时的压缩或分段

## 7. 交接自检清单

动手前：

- [ ] 读过 `AGENTS.md`、`architecture.md`、本文档
- [ ] 确认当前 `outputs/` 与远端一致（不一致先把远端同步下来）

交付前：

- [ ] `node scripts/build-userscript.mjs` 跑过，且 `tests/verify-sync.mjs` 通过
- [ ] 三个测试套件 + `redlines.mjs` 全绿
- [ ] 被删/改名的符号没有残留调用
- [ ] 文档与 `CHANGELOG.md` 同步（新增补丁要有 `docs/patches/` 文档并更新 README 索引）
- [ ] 版本号按规则 +1（第四段），并给出可安装文件路径 + SHA256
