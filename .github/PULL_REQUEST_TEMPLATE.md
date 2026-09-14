## 这个 PR 做了什么

<!-- 一句话概括；关联的 issue 用 #编号 -->

## 改动类型

- [ ] 修 bug（附上复现方式与根因）
- [ ] 新增功能（默认值是否保守？）
- [ ] 文档 / 结构调整
- [ ] 只动构建脚本或测试

## 自检清单

- [ ] 只改了 `v3_optimized.js`（唯一源码），并执行过 `node scripts/build-userscript.mjs`
- [ ] `node tests/verify-sync.mjs` 通过（油猴版 = 元数据 + 源码）
- [ ] 三个测试套件通过（`node tests/test-*.mjs`）
- [ ] 没有引入 `preventDefault` / `stopPropagation` / `mouseout` 劫持 / 新增网络请求 / `localStorage`
- [ ] 新增的定时器走 `_schedule()`，新增的监听能在 `destroy()` 里按引用摘除
- [ ] 新增开关默认保守（默认关闭或默认不改变现有行为）
- [ ] 涉及修复的，用 `F编号（本地修复）` 注释标注，并在 `docs/patches/` 下补一份文档
- [ ] 同步更新了 `README.md` 的文档索引与 `CHANGELOG.md`

## 验证记录

<!-- 贴关键日志、诊断报告片段或测试输出；真机验证过的话写明操作步骤 -->
