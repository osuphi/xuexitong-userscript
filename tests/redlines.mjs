#!/usr/bin/env node
// 红线静态扫描：这几条改动很容易违反，但一旦违反后果严重（页面被污染、被风控、监听泄漏）。
// 扫描前会去掉行注释 —— 注释里提到这些词是允许的（上游对抗测试也是这么做的）。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const code = readFileSync(resolve(root, 'v3_optimized.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');

const ALLOWED_URLS = [
    'https://code.jquery.com/jquery-3.6.0.min.js',
    'https://opencode.ai/zen/go/v1/chat/completions',
];

const problems = [];
const forbidden = [
    [/\.preventDefault\s*\(/, 'preventDefault（不许劫持页面事件）'],
    [/\.stopPropagation\s*\(/, 'stopPropagation（不许劫持页面事件）'],
    [/\bmouseout\b/, 'mouseout（不许在页面级劫持暂停）'],
    [/\bmouseleave\b/, 'mouseleave（不许在页面级劫持暂停）'],
    [/\bdocument\.cookie\b/, 'document.cookie'],
    [/\blocalStorage\b/, 'localStorage（设置一律不落盘）'],
    [/\bfetch\s*\(/, 'fetch()（不新增网络请求）'],
    [/\bXMLHttpRequest\b/, 'XMLHttpRequest（不新增网络请求）'],
    [/\bsendBeacon\b/, 'sendBeacon（不新增网络请求）'],
];
for (const [re, label] of forbidden) {
    if (re.test(code)) problems.push(label);
}

const timers = (code.match(/setTimeout\(/g) || []).length;
if (timers !== 2) {
    problems.push(`裸 setTimeout ${timers} 处（应为 2：_schedule 与 _withTimeout 内部各一处；其它延时请走 this._schedule()）`);
}

const urls = Array.from(new Set(code.match(/https?:\/\/[^\s)>'"]+/g) || []))
    .map((url) => url.replace(/['"`;,)]+$/, ''))
    .sort();
const extraUrls = urls.filter((url) => !ALLOWED_URLS.includes(url));
if (extraUrls.length) problems.push('出现未声明的外部 URL：' + extraUrls.join(', '));

if (problems.length) {
    console.error('✗ 红线扫描未通过：');
    for (const problem of problems) console.error('  - ' + problem);
    process.exit(1);
}
console.log(`✓ 红线扫描通过：${forbidden.length} 类禁止写法 0 命中；裸 setTimeout 2 处；外部 URL 仅 ${urls.length} 个（jQuery CDN + LLM 端点）`);
