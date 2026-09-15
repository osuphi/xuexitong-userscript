// 针对 F17（本地修复）的回归测试：调音量不再被当成"用户主动暂停"。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const sourcePath = resolve(import.meta.dirname, '..', 'v3_optimized.js');
const source = readFileSync(sourcePath, 'utf8');

let failures = 0;
const check = (name, cond, detail) => {
    if (cond) { console.log(`  ✓ ${name}`); } else { failures++; console.log(`  ✗ ${name}${detail ? '  → ' + detail : ''}`); }
};

// ---------- 1) 抽出 _isVolumeControlEvent 单独验证判定逻辑 ----------
const marker = '_isVolumeControlEvent(ev) {';
const startAt = source.indexOf(marker);
const endAt = startAt < 0 ? -1 : source.indexOf('\n            },', startAt);
if (startAt < 0 || endAt < 0) {
    console.error('✗ 源码里找不到 _isVolumeControlEvent');
    process.exit(1);
}
const method = source.slice(startAt, endAt + '\n            },'.length);
const sandbox = { String, Number, RegExp, console };
// 注意：runInNewContext 返回的是"完成值"，这里是一个函数，需要再调用一次
const holder = vm.runInNewContext(`(function () { return ({ ${method} }); })`, sandbox, { filename: 'volume-predicate.js' })();
const isVolume = holder._isVolumeControlEvent.bind(holder);

const node = (props) => Object.assign({ nodeType: 1, tagName: 'DIV', id: '', className: '', parentElement: null }, props);

console.log('1) _isVolumeControlEvent：音量/静音控件识别');
check('音量滑杆 input[type=range]', isVolume({ target: node({ tagName: 'INPUT', type: 'range' }) }) === true);
check('vjs 音量条 .vjs-volume-bar', isVolume({ target: node({ className: 'vjs-volume-bar vjs-slider' }) }) === true);
check('静音按钮 #muteBtn', isVolume({ target: node({ id: 'muteBtn' }) }) === true);
check('嵌套在音量面板里的 span（向上找 4 层）', isVolume({ target: node({ tagName: 'SPAN', className: '', parentElement: node({ className: 'vjs-volume-panel' }) }) }) === true);
check('中文类名「音量」', isVolume({ target: node({ className: 'player-音量控制' }) }) === true);

console.log('2) _isVolumeControlEvent：正常交互不被误判');
check('点视频画面（video 元素）', isVolume({ target: node({ tagName: 'VIDEO', className: 'vjs-tech' }) }) === false);
check('点播放/暂停按钮 .vjs-play-control', isVolume({ target: node({ className: 'vjs-play-control vjs-control' }) }) === false);
check('点进度条 .vjs-progress-control', isVolume({ target: node({ className: 'vjs-progress-control' }) }) === false);
check('点目录树 .posCatalog_name', isVolume({ target: node({ className: 'posCatalog_name', parentElement: node({ className: 'posCatalog_select' }) }) }) === false);
check('target 为空时不报错', isVolume({ target: null }) === false && isVolume(null) === false);
check('className 是 SVGAnimatedString 这类对象时不报错', isVolume({ target: node({ className: { baseVal: 'x' } }) }) === false);

// ---------- 3) 静态约束：修复必须真的接进主流程 ----------
console.log('3) 静态检查：修复已接入主流程');
check('交互监听会先调 _isVolumeControlEvent 再决定是否记账',
    /const handler = \(ev\) => \{[^]*?_isVolumeControlEvent\(ev\)[^]*?this\._lastUserInteractionTs = Date\.now\(\);/.test(source));
check('音量交互记到 _lastVolumeInteractionTs', /this\._lastVolumeInteractionTs = Date\.now\(\);/.test(source));
check('_handleVideoPause 只依据"暂停意图"判定，且不读音量时间戳',
    /_handleVideoPause\(e\) \{[\s\S]{0,600}?_isUserPauseIntent\(now\)[\s\S]{0,300}?_userPaused = true;/.test(source)
    && !/_handleVideoPause\(e\) \{[\s\S]{0,900}?_lastVolumeInteractionTs/.test(source));
check('已删除每秒一次的误导性日志', source.indexOf('检测到视频暂停且进度停滞') < 0);
check('用户暂停时走节流提示 _noteUserPausedStall',
    /if \(this\._userPaused\) \{[^]*?_noteUserPausedStall\(\)/.test(source));
check('节流提示有 60 秒节流窗口', /_noteUserPausedStall\(\) \{[\s\S]{0,400}60000/.test(source));
check('重新播放会复位提示节流', /this\._userPaused = false;\s*\n\s*this\._userPausedNoticeTs = 0;/.test(source));
check('面板状态行会显示当前恢复策略', source.indexOf('恢复策略: ') >= 0);
// 与上游对抗测试一致：静态扫描前先去掉行注释（注释里出现这些词是允许的，代码里不行）
const codeOnly = source.replace(/^\s*\/\/.*$/gm, '');
check('去注释后没有 preventDefault / stopPropagation',
    !/\.preventDefault\s*\(/.test(codeOnly) && !/\.stopPropagation\s*\(/.test(codeOnly));

// ---------- 4) F19：点恢复播放后马上被暂停，不该算用户意图 ----------
console.log('4) F19：区分"用户点开播"与"用户按暂停"');
const helperStart = source.indexOf('_wasJustUserResumed(now) {');
const helperEnd = source.indexOf('_isVolumeControlEvent(ev) {');
if (helperStart < 0 || helperEnd < 0 || helperEnd < helperStart) {
    console.error('✗ 找不到 F19 辅助函数');
    process.exit(1);
}
const helpers = source.slice(helperStart, helperEnd);
const app = vm.runInNewContext(`(function () { return ({ ${helpers} }); })`, sandbox, { filename: 'intent-helpers.js' })();
app.configs = { userPauseWindowMs: 2500, userIntentMatchMs: 800, userResumeGraceMs: 3000 };
const setState = (tInt, tPlay) => { app._lastUserInteractionTs = tInt; app._lastUserPlayTs = tPlay; };

setState(10000, 10050);   // 场景 A：点恢复播放（交互 10000，play 10050）
check('A) 刚点开播 0.4 秒后的暂停 → 不算用户意图', app._isUserPauseIntent(10450) === false);
check('A) 同一时刻 pauseGuard 会判定为"刚恢复"并拦截', app._wasJustUserResumed(10450) === true);

setState(40000, 11000);   // 场景 B：视频已播 30 秒，用户点暂停
check('B) 正常点暂停 → 算用户意图', app._isUserPauseIntent(40200) === true);
check('B) 不是"刚恢复"', app._wasJustUserResumed(40200) === false);

setState(11950, 11050);   // 场景 C：点恢复播放后 1 秒又想暂停（产生了更新的交互）
check('C) 恢复后 1 秒再点一次暂停 → 仍算用户意图', app._isUserPauseIntent(12000) === true);

setState(10000, 10050);   // 场景 D：超出交互窗口
check('D) 超出交互窗口 → 不算用户意图', app._isUserPauseIntent(13000) === false);

setState(0, 0);           // 场景 E：从未交互
check('E) 没有任何交互 → 不算用户意图', app._isUserPauseIntent(99999) === false);

setState(50000, 0);       // 场景 F：有交互但没有"用户触发的 play"记录
check('F) 只有交互、无 play 记录 → 算用户意图', app._isUserPauseIntent(51000) === true);

console.log('5) 静态检查：F19 已接入三处');
check('pauseGuard 会拦截"刚恢复后"的暂停', /self\._wasJustUserResumed\(now\)/.test(source));
check('_handleVideoPause 使用 _isUserPauseIntent', /_handleVideoPause\(e\) \{[\s\S]{0,500}?_isUserPauseIntent\(now\)/.test(source));
check('_handleVideoPlay 记录用户触发的 play', /this\._userPausedNoticeTs = 0;[\s\S]{0,600}?this\._lastUserPlayTs = nowPlay;/.test(source));
check('新增配置项存在', /userIntentMatchMs: 800/.test(source) && /userResumeGraceMs: 3000/.test(source));

// ---------- 6) F20：默认「始终自动恢复」，不再把用户暂停当最终决定 ----------
console.log('6) F20：respectUserPause 默认关闭 + 次数上限支持"不限"');
check('配置项 respectUserPause 默认 false', /respectUserPause: false,/.test(source));
check('_userPaused 只在 respectUserPause === true 时才置位',
    /if \(userIntent && this\.configs\.respectUserPause === true\) \{[\s\S]{0,200}?this\._userPaused = true;/.test(source));
check('默认路径会明确提示"始终自动恢复"', source.indexOf('但当前配置为「始终自动恢复」') >= 0);
check('三处次数上限都改走 _resumeCap()', (source.match(/this\._resumeCap\(\)/g) || []).length === 3);

{
    const capStart = source.indexOf('_resumeCap() {');
    const capEnd = source.indexOf('\n            },', capStart);
    if (capStart < 0 || capEnd < 0) {
        console.error('✗ 找不到 _resumeCap');
        process.exit(1);
    }
    const capHolder = vm.runInNewContext(
        `(function () { return ({ ${source.slice(capStart, capEnd + 15)} }); })`,
        sandbox,
        { filename: 'resume-cap.js' },
    )();
    const capOf = (value) => {
        const holder = Object.create(capHolder);
        holder.configs = { resumeMaxAttemptsPerUnit: value };
        return holder._resumeCap();
    };
    check('默认 5 次', capOf(5) === 5);
    check('设为 0 → 不限次数（Infinity）', capOf(0) === Infinity);
    check('缺省 → 保守默认 5', capOf(undefined) === 5);
    check('负数/非法值 → 保守默认 5', capOf(-1) === 5 && capOf('abc') === 5);
    check('可以调大，例如 50', capOf(50) === 50);
}

console.log('');
if (failures) { console.log(`✗ ${failures} 项失败`); process.exit(1); }
console.log('✓ 全部通过');
