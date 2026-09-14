# 启动 jQuery 获取策略修复（F18）

修复「脚本往页面里补注入 jQuery，顶掉页面自己的实例，导致页面插件报 `$(...).getNiceScroll is not a function`」。返回 [README](../../README.md)。

## 现象

用油猴版时，页面控制台持续刷 `TypeError: $(...).getNiceScroll is not a function`（实测 108 秒内 720 次），课程目录的滚动条等页面功能异常。

## 根因

油猴在 `@grant` 下会把脚本放进沙箱，**沙箱里的 `window` 看不到页面定义的 jQuery**。而启动逻辑判断的是沙箱的 `window.jQuery`：

```js
if (typeof window.jQuery === 'undefined') { /* 注入 CDN jQuery 3.6.0 */ }
```

于是即使用户页面上明明有 jQuery，脚本也会判定"没有"，往页面注入一份 CDN 版。注入的脚本在页面上下文执行，会执行 `window.jQuery = window.$ = jQuery`，**把页面原有的 jQuery 1.7.2 顶掉**；页面的插件（nicescroll 等）是挂在 1.7.2 实例上的，换成新实例后自然"不是函数"。

诊断报告里的两行是直接证据：

```
jQuery     : missing
jQuery 注入: 是（页面原本没有 jQuery，由本脚本补注入）
启动时探测 : 沙箱 jQuery=undefined / 页面 jQuery=function（v1.7.2） / 页面 $=function
```

同一瞬间：沙箱看不到，页面却有 v1.7.2 —— 说明页面本来就有，是我们多注入了一份。

> 附带说明：控制台直贴版没有沙箱，`window` 就是页面窗口，所以这个问题**只影响油猴版**。

## 修复内容

启动改为三级策略：

1. **先看页面窗口**：`const pageWin = unsafeWindow || window`，候选顺序 `window.jQuery → window.$ → pageWin.jQuery → pageWin.$`；
2. **页面有可用 jQuery 就直接用**，不注入、不覆盖任何全局；
3. **两个窗口都没有（或版本太老、没有 `.on`/`.off`）才注入**，并且注入完成后**立刻把页面原有的 `$`/`jQuery` 还原回去**，页面自己的代码与插件继续用它原来的实例。

同时把 `$` 变成 IIFE 作用域内的变量（源码里只有一处 `let $` 声明），脚本不再依赖全局 `$` 是否可见；诊断报告新增 `jQuery 来源`（`页面自带` / `本脚本注入的 CDN 版`）。

用到的 jQuery API 已逐个核对：`.find` `.children` `.each` `.map` `.get` `.toArray` `.attr` `.text` `.val` `.filter` `.first` `.on` `.off` `.click` 与 `:visible` 选择器在 jQuery 1.7.2 中均可用，因此"用页面自带的"不会引入兼容问题。

## 验证

新增 `test-startup.mjs`（23 项断言），从源码抽出启动块配桩执行，覆盖四种场景：

| 场景 | 期望 |
| --- | --- |
| 沙箱看不到、页面有 v1.7.2 | 不注入；`$` 用页面实例；页面全局不变 |
| 控制台直贴（无 `unsafeWindow`） | 不注入，正常启动 |
| 页面确实没有 jQuery | 注入；`onload` 前不启动；之后 `$` 取到注入实例；**页面全局还原为原值** |
| 页面 jQuery 太老（无 `.on`） | 判定不可用 → 走注入，并把老实例还原回去 |

另外 `test-diag.mjs`（40 项）、`test-pause-fix.mjs`（21 项）继续全绿；`node --check`、两入口逐字节同步、上游 17 类禁止写法扫描（0 命中）、裸 `setTimeout` 仍为 2 处。

## 风险与回退

- 主要行为变化：脚本从"自带 jQuery 3.6.0"变成"优先用页面的 1.7.2"。若某天出现 jQuery 相关的异常，可直接把 `pickJQuery()` 的候选顺序改成只认沙箱注入的实例来退回原行为。
- 已保留注入分支：页面确实没有 jQuery 时行为与原来一致，只是多了一步"还原页面全局"。
