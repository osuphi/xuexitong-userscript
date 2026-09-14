# 贡献指南

感谢愿意帮忙改这个脚本。**动手前请先读 [AGENTS.md](AGENTS.md) 与 [docs/architecture.md](docs/architecture.md)** ——
它们把架构、状态字段、红线与验证流程都写清楚了，能省掉大量来回。

## 快速流程

```bash
# 1) 只改唯一源码
$EDITOR v3_optimized.js

# 2) 重新生成油猴版（改了源码必须做，别手改产物）
node scripts/build-userscript.mjs

# 3) 语法 + 同步 + 测试
node --check v3_optimized.js
node --check v3_optimized.user.js
node tests/verify-sync.mjs
node tests/test-startup.mjs
node tests/test-pause-fix.mjs
node tests/test-diag.mjs
```

三条命令也可以合并写成一行（CI 里就是这么跑的，见 `.github/workflows/ci.yml`）。

## 硬性约束（PR 会被这些卡住）

1. **只改 `v3_optimized.js`**；`v3_optimized.user.js` 是构建产物。
2. **不劫持事件**：不得出现 `preventDefault()` / `stopPropagation()`，也不要在 `document`/`window` 上监听
   `mouseout`/`mouseleave` 去阻止暂停。
3. **不改页面全局、不注入资源顶掉页面的东西**（F18 的教训：补注入 jQuery 会让页面插件全线报错）。
4. **所有延时走 `this._schedule()`**；除 `_schedule()` / `_withTimeout()` 内部外不得出现裸 `setTimeout`。
5. **新增监听必须能按引用摘除**，保证 `destroy()` 后零残留。
6. **不写 `localStorage`、不新增网络请求**（只允许页面 jQuery CDN 与已声明的 LLM 端点）。
7. **新增开关默认保守**：默认关闭，或默认不改变现有行为。
8. **失败要说话**：异常退出路径要打印可操作提示，不要静默停止。

## 提交修复时请一并提供

- **复现步骤**与现象；有条件的话附一份诊断报告（面板「导出诊断」或 `app.exportDiagnostics()`）。
- **根因**：说明是哪个函数/哪个判定导致的。
- 用 `F编号（本地修复）` 注释标注改动点（编号接续已有的 F1–F19，避免与上游编号冲突）。
- 在 `docs/patches/` 下补一份文档：现象 → 根因 → 修复内容 → 验证 → 回滚方式。
- 更新 `README.md` 的文档索引与 `CHANGELOG.md`。
- 如果 bug 与"用户意图判定"有关，请在 `tests/test-pause-fix.mjs` 的判定矩阵里补一个场景。

## 写新测试要注意（踩过的坑）

- 测试是「从源码里抽出代码块 → 配桩执行」，抽出的代码块**看不到 IIFE 作用域的变量**，需要准备同名桩。
- `vm.runInNewContext(...)` 返回的是"完成值"；若求值的是函数表达式，记得再调用一次。
- 静态断言要**先去掉行注释**再扫描（注释里出现 `preventDefault` 这类词是允许的）。
- 抽取用的锚点字符串（函数头、块起始行）改动后测试会直接报"找不到 XX"，这是有意为之的保护。

## 不接受的改动

- 绕过平台风控的做法（`ratechange` 强制回写、验证码绕过、伪造观看时长上报等）。
- 把密钥、Cookie、令牌写进仓库或日志。
- 默认开启"替用户作答/提交"的功能。
