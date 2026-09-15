# AGENTS.md — 给 AI / 自动化助手的工作约定

本文件是给 AI 助手（以及任何自动化改代码的工具）的入口。**动手前请先读 [`docs/architecture.md`](docs/architecture.md)**，它包含架构、状态字段速查表与改动流程；本文件只列最关键的约定。

## 这个仓库是什么

本仓库在 V3.6 基础上叠加了若干本地补丁（面板拖动、诊断导出、F17–F20 修复）；出处见 README「来源与致谢」。

## 改代码的硬性规则

1. **只改 `v3_optimized.js`**（唯一源码）。`v3_optimized.user.js` 是产物，改完源码后跑 `node scripts/build-userscript.mjs` 重新生成。
2. **不改页面全局、不注入资源顶掉页面的东西**（F18 教训：补注入 jQuery 会让页面插件全线报错）。
3. **不劫持事件**：代码中不得出现 `preventDefault()`、`stopPropagation()`；不要在 `document`/`window` 上监听 `mouseout`/`mouseleave` 阻止暂停。
4. **所有延时走 `this._schedule()`**；除 `_schedule()` / `_withTimeout()` 内部外不得出现裸 `setTimeout`。
5. **新增监听必须能按引用移除**，保证 `destroy()` 后零残留。
6. **不写 `localStorage`、不新增网络请求**（只允许 jQuery CDN 与已声明的 LLM 端点）。
7. **新增开关默认保守**（默认关闭或默认不改变现有行为）；不实现"替用户作答/提交"的默认行为。
8. 失败路径必须有可操作提示，不允许静默停止。

## 改完必须做的验证

```bash
node scripts/build-userscript.mjs      # 重新生成油猴版
node --check v3_optimized.js           # 语法
node --check v3_optimized.user.js
node tests/verify-sync.mjs             # 油猴版 = 元数据 + 源码
node tests/test-startup.mjs            # 34 项
node tests/test-pause-fix.mjs          # 45 项（含"用户意图判定矩阵"与恢复策略）
node tests/test-diag.mjs               # 50 项
```

- 测试位于仓库 `tests/`，**不依赖任何第三方包**（用 Node 内置 `node:vm` 从源码里抽代码块执行），CI 里会跑同样的命令，见 `.github/workflows/ci.yml`。
- 写新用例的思路与坑见 [架构与维护指南](docs/architecture.md) 第 10 节。
- 测试里抽取的代码块**看不到 IIFE 作用域变量**，需要给同名桩；`vm.runInNewContext` 若求值的是函数表达式，记得再调用一次。
- 静态断言要**去掉行注释**再扫描。

## 版本号

`上游主版本.次版本.修订号.本地构建号`，如 `3.6.0.5`。前三段跟上游，第四段每次本地改动 +1，写在 `scripts/build-userscript.mjs` 的 `// @version` 里。不改 `@name`/`@namespace`（油猴就地替换）。

运行期版本由 IIFE 顶部的 `readBuildVersion()` 读 `GM_info.script.version` 得到（存进 `app.buildVersion`），显示在启动横幅、面板标题与诊断报告的「脚本版本」行；控制台直贴版没有 `GM_info`，自动回退到源码常量 `VERSION`。改版本号时这三处会自动跟随，不需要另外改。

## 改动的记录要求

- 每处修复用 `F编号（本地修复）` 注释标注，并在 `docs/` 下写一份文档：现象 → 根因 → 修复内容 → 验证 → 回滚方式。
- 同步更新 `README.md` 的补丁列表与文档索引。

## 不要做的事

- 不要为了让脚本"更好用"而绕过平台风控（`ratechange` 强制回写、验证码绕过、伪造上报等）。
- 不要把密钥、令牌、Cookie 写进仓库或日志。
- 不要手改 `v3_optimized.user.js`。
