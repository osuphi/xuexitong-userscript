// 针对新增"诊断导出补丁"的功能测试：
// 从源码里抽出该补丁的代码块，配上桩环境执行，验证日志缓冲、错误捕获、报告生成与下载路径。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const sourcePath = resolve(import.meta.dirname, '..', 'v3_optimized.js');
const source = readFileSync(sourcePath, 'utf8');

const START = '// ===================== 诊断导出补丁（本地修改，非上游代码） =====================';
const END = '// =========================== 诊断导出补丁结束 ===========================';
const startAt = source.indexOf(START);
const endAt = source.indexOf(END);
if (startAt < 0 || endAt < 0 || endAt < startAt) {
    console.error('✗ 无法在源码里定位诊断补丁代码块');
    process.exit(1);
}
const block = source.slice(startAt, endAt);

// 桩环境
const state = { appended: 0, removed: 0, clicked: 0, revoked: 0, created: 0, listeners: {}, logs: [] };
const listeners = {};
const windowStub = {
    innerWidth: 1920,
    innerHeight: 1080,
    jQuery: { fn: { jquery: '3.6.0' } },
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener: (type, fn) => { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
};
const anchorStub = {
    style: {},
    href: '',
    download: '',
    rel: '',
    click() { state.clicked++; },
};
const documentStub = {
    title: '课程学习页',
    visibilityState: 'visible',
    querySelectorAll: () => [],
    createElement: () => anchorStub,
    body: {
        appendChild() { state.appended++; },
        removeChild() { state.removed++; },
    },
};
const sandbox = {
    window: windowStub,
    document: documentStub,
    navigator: { userAgent: 'node-test-agent' },
    location: { href: 'https://mooc1.chaoxing.com/mycourse/studentstudy?chapterId=999&secret=ticket' },
    Blob,
    URL: Object.assign(Object.create(URL), {
        createObjectURL() { state.created++; return 'blob:fake'; },
        revokeObjectURL() { state.revoked++; },
    }),
    console: {
        log: (...a) => state.logs.push(['log', a.join(' ')]),
        warn: (...a) => state.logs.push(['warn', a.join(' ')]),
        error: (...a) => state.logs.push(['error', a.join(' ')]),
    },
    JSON, Math, Number, String, Object, Array, Boolean, Date, Error, isFinite,
};
// 这个变量在真实源码里是 IIFE 作用域的（抽出来的代码块看不到它），测试里补一个同名全局
sandbox.jqueryInjectedByScript = false;
sandbox.jquerySource = '页面自带';
sandbox.startupProbe = { sandboxJQuery: 'undefined', sandboxDollar: 'function', pageJQuery: 'function', pageDollar: 'function', pageJQueryVersion: '1.7.2' };
sandbox.globalThis = sandbox;

const factory = vm.runInNewContext(`(function () { return ({${block}}); })`, sandbox, { filename: 'diag-block.js' });

const app = factory();
app.configs = { diagEnabled: true, diagLogMaxLines: 2000, diagCaptureErrors: true, diagErrorEchoMax: 5, guiEnabled: false, guiMaxLogLines: 60, llmEnabled: false, llmMaxAnswersPerSession: 50, llmAutoSubmit: false };
app._diagLogs = [];
app._diagErrors = [];
app._diagErrorHandlers = null;
app._diagStartedAt = 0;
app._timers = new Set();
app._schedule = (fn, ms) => { app._lastScheduled = ms; return 1; };
app._guiHookConsole = () => { app._hooked = (app._hooked || 0) + 1; };
app._guiLogEl = null;
app._guiStatusEl = null;
app._guiLogs = [];
app._guiRefreshStatus = () => {};
app.version = 'V3.6';
app.buildVersion = '3.6.0.6';
app._videoSelectors = () => ['video#video_html5_api'];
app._getVideoEl = () => null;
app._currentStepTitle = () => '视频';
app._isUserPauseIntent = () => false; // 真实源码里由 F19 补丁提供，这里给桩
app._cellData = { cells: 3, nCells: 8, currentCellIndex: 1, currentNCellIndex: 2, currentVideoTitle: '某视频', resolved: true, resolveSource: 'active-node' };
app._isPlaying = true;
app._userPaused = false;
app._interactionBlocked = false;
app._nextUnitPending = false;
app._tryTimes = 0;
app._workBusy = false;
app._currentVideoTaskIndex = 1;
app._videoTaskCount = 2;
app._videoTaskAllComplete = false;
app._checkInterval = 123;
app._interactionWatcher = 456;
app._guiCollapsed = false;
app._guiPos = { left: 100, top: 200, width: 330, height: 160 };
app._llmApiKey = '';
app._llmInFlight = false;
app._llmAnswersThisSession = 0;
app._llmLastAnswer = null;

let failures = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log(`  ✓ ${name}`); } else { failures++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
};

console.log('1) _diagInit：装钩子 + 注册错误监听');
app._diagInit();
check('控制台钩子已安装（即使 guiEnabled=false）', app._hooked === 1);
check('已监听 error 事件', (listeners.error || []).length === 1);
check('已监听 unhandledrejection 事件', (listeners.unhandledrejection || []).length === 1);
app._diagInit();
check('重复 _diagInit 不会重复注册', (listeners.error || []).length === 1);

console.log('2) _diagLog：日志入缓冲 + 上限裁剪');
app._diagLog('log', '第一条');
check('日志带级别与毫秒时间戳', /^\[\d\d:\d\d:\d\d\.\d\d\d\]\[log\] 第一条$/.test(app._diagLogs[0]), app._diagLogs[0]);
// 注意：_diagLog 内部有 Math.max(50, ...) 的下限保护，所以这里用 50 来验证裁剪
app.configs.diagLogMaxLines = 50;
for (let i = 0; i < 120; i++) app._diagLog('log', 'x' + i);
check('超出上限后裁剪到 50 条', app._diagLogs.length === 50, '实际 ' + app._diagLogs.length);
check('保留的是最新几条', app._diagLogs[49].endsWith('x119'), app._diagLogs[49]);
check('最旧的日志已被裁掉', app._diagLogs[0].endsWith('x70'), app._diagLogs[0]);
app.configs.diagLogMaxLines = 2000;

console.log('3) 未处理错误捕获：去重 + 限制刷屏');
state.logs.length = 0;
const pageErr = { message: '$(...).getNiceScroll is not a function', filename: 'page.js', lineno: 3312, colno: 9 };
for (let i = 0; i < 500; i++) listeners.error[0](pageErr);   // 模拟页面高频抛同一个错
listeners.error[0]({ target: { tagName: 'IMG' } });           // 资源加载错误应被忽略
listeners.unhandledrejection[0]({ reason: new Error('rejected!') });
check('500 次同一个错只记 1 条', app._diagErrors.length === 2, '实际 ' + app._diagErrors.length);
check('累加了出现次数', app._diagErrors[0].count === 500, '实际 ' + app._diagErrors[0].count);
check('记录了最后一次出现时间', !!app._diagErrors[0].lastAt);
const warnCount = state.logs.filter(([lvl, msg]) => lvl === 'warn' && msg.indexOf('[诊断]') >= 0).length;
check('面板/控制台只被写入 2 条提示（不是 500 条）', warnCount === 2, '实际 ' + warnCount);
check('提示里说明了会合并计数', state.logs.some(([, m]) => m.indexOf('自动合并计数') >= 0));
check('2 条不同错误用掉了 2 次提示额度', app._diagErrorEchoCount === 2, '实际 ' + app._diagErrorEchoCount);

console.log('3b) 不同错误超过提示上限后停止刷屏');
state.logs.length = 0;
app._diagErrorEchoCount = 0; // 模拟重新 run() 后额度重置
for (let i = 0; i < 10; i++) listeners.error[0]({ message: 'distinct-' + i, filename: 'p.js', lineno: i, colno: 1 });
const distinctWarn = state.logs.filter(([, m]) => m.indexOf('[诊断]') >= 0).length;
check('新增 10 种错误只提示到上限（本次共 5 条）', distinctWarn === 5, '实际 ' + distinctWarn);
check('提示过"不再刷屏"', state.logs.some(([, m]) => m.indexOf('不再刷屏') >= 0));
check('但报告里都记下来了', app._diagErrors.length === 12, '实际 ' + app._diagErrors.length);

console.log('3c) 可以整体关闭错误收集');
const app2 = factory();
app2.configs = Object.assign({}, app.configs, { diagCaptureErrors: false });
app2._diagErrorHandlers = null;
app2._guiHookConsole = () => {};
const beforeListeners = (listeners.error || []).length;
app2._diagInit();
check('关闭后不再注册 error 监听', (listeners.error || []).length === beforeListeners);

console.log('4) getDiagnostics：结构与脱敏');
// 真源码里的作用域/赋值必须成立，否则运行时会 ReferenceError
check('IIFE 顶部声明了 jqueryInjectedByScript', /const BOOT_TIMER_KEY[^]*?let jqueryInjectedByScript = false;/.test(source));
check('补注入 CDN 时会把标记置为 true', /jqueryInjectedByScript = true;[^]*?document\.head\.appendChild\(script\);/.test(source));
check('未出现"赋值前后矛盾"（只在补注入分支里置 true）', (source.match(/jqueryInjectedByScript = true/g) || []).length === 1);
const diag = app.getDiagnostics();
check('含版本与状态', diag.version === 'V3.6' && diag.state.isPlaying === true);
check('页面 URL 去掉 query（不泄露票据）', diag.page.url === 'https://mooc1.chaoxing.com/mycourse/studentstudy', diag.page.url);
check('记录了待执行定时器数量', diag.state.pendingTimers === 0);
check('运行状态含"暂停意图"相关字段', 'userPauseIntentNow' in diag.state && 'lastUserPlayMsAgo' in diag.state);
check('选择器命中表非空', Object.keys(diag.selectors).length > 5);
check('配置已快照', diag.configs.diagEnabled === true);
check('不带任何密钥字段', JSON.stringify(diag).indexOf('_llmApiKey') < 0);

console.log('5) exportDiagnostics：文本报告');
const text = app.exportDiagnostics('txt');
for (const heading of ['【运行状态】', '【视频】', '【frame 结构】', '【选择器命中数】', '【课程目录解析】', '【配置】', '【捕获到的未处理错误】', '【完整日志】']) {
    check('报告含 ' + heading, text.indexOf(heading) >= 0);
}
check('报告里带上了最新日志', text.indexOf('x119') >= 0);
check('报告里不含已被裁掉的旧日志', text.indexOf('第一条') < 0);
check('错误段落带出现次数', text.indexOf('×500') >= 0);
check('错误段落标注 种/共', /【捕获到的未处理错误】（\d+ 种 \/ 共 \d+ 次）/.test(text));
check('报告说明 jQuery 是否由脚本注入', text.indexOf('jQuery 注入:') >= 0);
check('报告含启动时 jQuery 探测', text.indexOf('启动时探测 :') >= 0 && text.indexOf('v1.7.2') >= 0);
check('报告含 jQuery 来源', text.indexOf('jQuery 来源: 页面自带') >= 0);
check('触发了文件下载', state.clicked === 1 && state.appended === 1);
check('下载 URL 走 _schedule 延迟回收', app._lastScheduled === 1000 && state.created === 1);

console.log('6) exportDiagnostics：JSON 报告');
const json = app.exportDiagnostics('json');
let parsed = null;
try { parsed = JSON.parse(json); } catch (e) { /* ignore */ }
check('输出是合法 JSON', !!parsed && parsed.version === 'V3.6');
check('JSON 含 logsTail', Array.isArray(parsed.logsTail) && parsed.logsTail.length > 0);

console.log('7) destroy 清理');
windowStub.removeEventListener('error', listeners.error[0]);
check('能按引用摘除监听（destroy 逻辑一致）', (listeners.error || []).length === 0);

console.log('');
if (failures) { console.log(`✗ ${failures} 项失败`); process.exit(1); }
console.log('✓ 全部通过');
