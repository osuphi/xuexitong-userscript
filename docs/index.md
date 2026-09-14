# 文档索引

按你的目的选入口：

| 我想…… | 去看 |
| --- | --- |
| 知道这脚本是干什么的、怎么装 | [README](../README.md) |
| **动手改代码** | [AGENTS.md](../AGENTS.md)（硬性规则 + 命令清单）→ [architecture.md](architecture.md)（架构、状态字段表、调试、发版） |
| 查某个症状该看哪个字段 | [architecture.md](architecture.md) 第 9 节「调试手册」 |
| 了解某个本地补丁改了什么、怎么回滚 | [patches/](patches/) 下对应文档 |
| 提 bug / 提 PR | [.github/ISSUE_TEMPLATE](../.github/ISSUE_TEMPLATE/bug_report.md)、[.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md) |
| 看历史改动 | [CHANGELOG.md](../CHANGELOG.md) |
| 了解安全与隐私边界 | [SECURITY.md](../SECURITY.md) |

## 本仓库的补丁

| 编号 | 内容 | 文档 |
| --- | --- | --- |
| — | GUI 监控面板可拖动 | [patches/gui-drag.md](patches/gui-drag.md) |
| — | 一键导出诊断报告（含日志去重、启动探测等字段） | [patches/diagnostics.md](patches/diagnostics.md) |
| F17 / F19 | 暂停被误判为"用户主动暂停"（调音量、点恢复播放） | [patches/pause-misjudge.md](patches/pause-misjudge.md) |
| F18 | 启动 jQuery 策略：不再注入 CDN 版顶掉页面插件 | [patches/jquery-bootstrap.md](patches/jquery-bootstrap.md) |

上游历史修复（F1–F16）的索引见 [architecture.md](architecture.md) 第 12 节。

## 三个测试套件

| 文件 | 覆盖 |
| --- | --- |
| [`tests/test-startup.mjs`](../tests/test-startup.mjs) | jQuery 获取策略、版本号解析（共 34 项） |
| [`tests/test-pause-fix.mjs`](../tests/test-pause-fix.mjs) | 音量控件识别、**用户意图判定矩阵**（共 33 项） |
| [`tests/test-diag.mjs`](../tests/test-diag.mjs) | 诊断：缓冲裁剪、错误去重、URL 脱敏、报告结构（共 50 项） |

另有 [`tests/verify-sync.mjs`](../tests/verify-sync.mjs) 校验「油猴版 = 元数据 + 源码」。
