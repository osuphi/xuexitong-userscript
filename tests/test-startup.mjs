// 针对 F18（本地修复）的功能测试：jQuery 获取策略。
// 从源码里抽出启动块，配桩执行，验证四种场景下的取用/注入/还原行为。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const sourcePath = resolve(import.meta.dirname, '..', 'v3_optimized.js');
const source = readFileSync(sourcePath, 'utf8');

const startAt = source.indexOf('let $ = null;');
const endAt = source.indexOf('function waitForCoursePage()');
if (startAt < 0 || endAt < 0 || endAt < startAt) {
    console.error('✗ 无法定位启动块');
    process.exit(1);
}
const block = source.slice(startAt, endAt);

let failures = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log(`  ✓ ${name}`); } else { failures++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
};

// 造一个"能通过 isUsableJQuery"的假 jQuery
const makeJQ = (version) => {
    const jq = function () { return { fake: true }; };
    jq.fn = { jquery: version, on: function () {}, off: function () {} };
    return jq;
};

function runStartup({ sandboxJQ, pageJQ, hasUnsafeWindow = true, injectResult }) {
    const state = { appended: 0, scriptEl: null, waitCalls: 0, waitCallsBeforeLoad: 0, logs: [] };
    const sandboxWindow = { jQuery: sandboxJQ, $: sandboxJQ };
    const pageWindow = { jQuery: pageJQ, $: pageJQ };
    const sandbox = {
        window: sandboxWindow,
        document: {
            createElement() { state.scriptEl = { set src(v) { this._src = v; }, get src() { return this._src; } }; return state.scriptEl; },
            head: { appendChild() { state.appended++; } },
        },
        console: { log: (...a) => state.logs.push(a.join(' ')), error: (...a) => state.logs.push('ERR ' + a.join(' ')) },
        waitForCoursePage: () => { state.waitCalls++; },
        jqueryInjectedByScript: false,
        String, Object, Boolean,
    };
    if (hasUnsafeWindow) sandbox.unsafeWindow = pageWindow;
    sandbox.globalThis = sandbox;

    // 用 getter 返回，这样 onload 之后再读也能拿到最新值
    const code = `(function () { ${block} return {
        get dollar() { return $; },
        get source() { return jquerySource; },
        get injected() { return jqueryInjectedByScript; }
    }; })()`;
    const result = vm.runInNewContext(code, sandbox, { filename: 'startup-block.js' });

    // 模拟注入的 CDN 脚本执行完成：把实例挂到沙箱窗口上，再触发 onload
    state.waitCallsBeforeLoad = state.waitCalls;
    if (state.scriptEl && typeof state.scriptEl.onload === 'function') {
        sandboxWindow.jQuery = injectResult;
        sandboxWindow.$ = injectResult;
        state.scriptEl.onload();
    }
    return { state, sandboxWindow, pageWindow, result };
}

console.log('1) 页面自带 jQuery（油猴沙箱场景：沙箱看不到、页面有 v1.7.2）');
{
    const pageJQ = makeJQ('1.7.2');
    const { state, result, pageWindow } = runStartup({ sandboxJQ: undefined, pageJQ });
    check('不注入任何脚本', state.appended === 0);
    check('直接进入主流程', state.waitCalls === 1);
    check('$ 取到页面实例', result.dollar === pageJQ);
    check('来源标记为「页面自带」', result.source === '页面自带');
    check('未标记为注入', result.injected === false);
    check('页面全局未被改动', pageWindow.jQuery === pageJQ && pageWindow.$ === pageJQ);
}

console.log('2) 控制台直贴场景（没有 unsafeWindow，window 就是页面窗口）');
{
    const pageJQ = makeJQ('1.12.4');
    const { state, result } = runStartup({ sandboxJQ: pageJQ, pageJQ, hasUnsafeWindow: false });
    check('不注入', state.appended === 0 && result.dollar === pageJQ);
    check('进入主流程', state.waitCalls === 1);
}

console.log('3) 页面确实没有 jQuery 才注入，并把页面全局还原');
{
    const injected = makeJQ('3.6.0');
    const { state, result, pageWindow } = runStartup({ sandboxJQ: undefined, pageJQ: undefined, injectResult: injected });
    check('创建并插入 script', state.appended === 1);
    check('onload 之前不进入主流程', state.waitCallsBeforeLoad === 0);
    check('onload 之后进入主流程一次', state.waitCalls === 1, '实际 ' + state.waitCalls);
    check('$ 取到注入的实例', result.dollar === injected);
    check('来源标记为「本脚本注入的 CDN 版」', result.source === '本脚本注入的 CDN 版');
    check('页面全局被还原成 undefined', pageWindow.jQuery === undefined && pageWindow.$ === undefined);
    check('日志里说明了来源与版本', state.logs.some((l) => l.indexOf('jQuery 来源：本脚本注入的 CDN 版，版本 3.6.0') >= 0));
}

console.log('4) 页面 jQuery 太老（没有 .on/.off）→ 仍走注入');
{
    const ancient = function () { return {}; };
    ancient.fn = { jquery: '1.2.6' };
    const injected = makeJQ('3.6.0');
    const { state, result, pageWindow } = runStartup({ sandboxJQ: undefined, pageJQ: ancient, injectResult: injected });
    check('识别为不可用并注入', state.appended === 1 && result.dollar === injected);
    check('页面原有的老 jQuery 被还原回去', pageWindow.jQuery === ancient);
}

console.log('5) 静态检查：源码层面不再"只认沙箱 window.jQuery"');
check('启动块优先使用 pageWin（unsafeWindow 桥）', /const pageWin = \(typeof unsafeWindow !== 'undefined' && unsafeWindow\) \? unsafeWindow : window;/.test(source));
check('候选顺序包含页面窗口', /const candidates = \[window\.jQuery, window\.\$, pageWin\.jQuery, pageWin\.\$\];/.test(source));
check('只有一条注入路径（jqueryInjectedByScript = true）', (source.match(/jqueryInjectedByScript = true;/g) || []).length === 1);
check('注入后还原页面全局', /pageWin\.\$ = savedDollar;[\s\S]{0,80}pageWin\.jQuery = savedJQuery;/.test(source));
check('脚本使用 IIFE 作用域的 $（不再依赖全局）', (source.match(/(const|let|var)\s+\$\s*=/g) || []).length === 1);

console.log('6) 版本号解析：油猴读元数据，控制台直贴回退到源码常量');
{
    const chunkStart = source.indexOf('const readBuildVersion = () => {');
    const chunkEnd = source.indexOf('const BUILD_VERSION =');
    if (chunkStart < 0 || chunkEnd < 0 || chunkEnd < chunkStart) {
        console.error('✗ 找不到 readBuildVersion');
        process.exit(1);
    }
    const chunk = source.slice(chunkStart, chunkEnd);
    const sandbox = { String };
    const readBuildVersion = vm.runInNewContext(`(function () { ${chunk} return readBuildVersion; })`, sandbox, { filename: 'build-version.js' })();

    delete sandbox.GM_info;
    check('没有 GM_info（控制台直贴版）→ 空字符串', readBuildVersion() === '');

    sandbox.GM_info = { script: { version: '3.6.0.6' } };
    check('油猴元数据 → 取到完整构建号', readBuildVersion() === '3.6.0.6');

    sandbox.GM_info = { script: { version: 3.6 } };
    check('非字符串也能转成字符串', readBuildVersion() === '3.6');

    sandbox.GM_info = {};
    check('GM_info 存在但没有 script → 空字符串', readBuildVersion() === '');

    sandbox.GM_info = { script: { version: '' } };
    check('版本为空 → 空字符串（回退到常量）', readBuildVersion() === '');

    Object.defineProperty(sandbox, 'GM_info', { configurable: true, get() { throw new Error('boom'); } });
    check('读取 GM_info 抛异常时不炸', readBuildVersion() === '');
}

console.log('7) 静态检查：构建号已经显示到面板与报告');
check('app 对象暴露 buildVersion', /version: VERSION,\s*\n\s*buildVersion: BUILD_VERSION,/.test(source));
check('面板标题优先用构建号', /学习通脚本监控 ' \+ \(this\.buildVersion \|\| this\.version\)/.test(source));
check('启动横幅带构建号', /this\.version\}\$\{this\.buildVersion \? ' \/ 构建 ' \+ this\.buildVersion : ''\} 启动/.test(source));
check('诊断对象含 buildVersion', /version: this\.version,\s*\n\s*buildVersion: this\.buildVersion \|\| '',/.test(source));
check('报告版本行含 buildVersion', /add\('脚本版本   : ' \+ diag\.version \+ \(diag\.buildVersion/.test(source));

console.log('');
if (failures) { console.log(`✗ ${failures} 项失败`); process.exit(1); }
console.log('✓ 全部通过');
