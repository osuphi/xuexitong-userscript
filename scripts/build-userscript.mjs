import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 单一源码约定：repo/v3_optimized.js 是唯一实现，本脚本只负责拼接油猴元数据块。
const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'v3_optimized.js'), 'utf8').replace(/^\uFEFF/, '');
const metadata = `// ==UserScript==
// @name         学习通自动刷课脚本 V3.6
// @namespace    local.codex.xuexitong
// @version      3.6.0.8
// @description  自动播放、自动切换下一小节；互动题弹窗只提示人工处理、末尾测验直接跳过；含 GUI 面板与诊断导出；沿用 V3.4 导航/播放/风控修复（详见 README）
// @author       Codex
// @match        *://mooc1.chaoxing.com/mycourse/studentstudy*
// @match        *://*.chaoxing.com/mycourse/studentstudy*
// @match        *://*.chaoxing.com/mooc2-ans/mycourse/studentstudy*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
//   说明：脚本已不含任何网络调用，保留这条 @grant 只是为了让脚本继续运行在油猴沙箱里；
//   若去掉全部 @grant，油猴会改为注入页面上下文，可能撞上页面 CSP 或覆盖页面全局变量。
// ==/UserScript==

`;

writeFileSync(resolve(root, 'v3_optimized.user.js'), `${metadata}${source}`, 'utf8');
console.log('generated v3_optimized.user.js from v3_optimized.js');
