#!/usr/bin/env node
// 校验 v3_optimized.user.js 是「油猴元数据块 + v3_optimized.js」的精确拼接。
// 改了源码却忘记重新构建时，这一步会把问题拦下来。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'v3_optimized.js'), 'utf8').replace(/^\uFEFF/, '');
const userscript = readFileSync(resolve(root, 'v3_optimized.user.js'), 'utf8');

const fail = (message) => {
    console.error('✗ ' + message);
    process.exit(1);
};

if (!userscript.endsWith(source)) {
    fail('v3_optimized.user.js 的结尾与 v3_optimized.js 不一致 —— 先跑 node scripts/build-userscript.mjs');
}
const metadata = userscript.slice(0, userscript.length - source.length);
if (!/^\/\/ ==UserScript==/.test(metadata)) fail('油猴版开头缺少元数据块');
if (!/@version/.test(metadata)) fail('元数据块里缺少 @version');
for (const key of ['@name', '@namespace', '@match', '@grant']) {
    if (!metadata.includes(key)) fail(`元数据块里缺少 ${key}`);
}

const version = (metadata.match(/@version\s+(\S+)/) || [])[1];
const upstream = (source.match(/const VERSION = '([^']+)'/) || [])[1];
console.log(`✓ 油猴版与源码同步：@version=${version}，源码常量 VERSION=${upstream || '未找到'}，元数据 ${metadata.length} 字节`);
