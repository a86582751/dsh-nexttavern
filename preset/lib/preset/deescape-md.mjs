#!/usr/bin/env node
// Generated from runtime/alpha3/src/preset/deescape-md.mts; edit the TypeScript source.
// deescape-md.mjs — 去掉 anydoc 的防御性 markdown 转义残留。
//
// anydoc（@firecrawl/anydoc）把 docx 里的 Markdown 标记按「字面文本」做
// 防御性转义。这里只解除明确的结构化 Markdown、常见 HTML 标签和完整
// {{template}}；其它反斜杠（LaTeX、正则、JSON/CSS/JS、Windows 路径等）不动。
// 读卡导入器同时保存 rawSource 与 normalizedSource，便于审计和重放。
//
// 用法：node deescape-md.mjs <已落盘的 .md 文件>
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
const file = process.argv[2];
if (!file) {
    console.error('usage: node deescape-md.mjs <file.md>');
    process.exit(1);
}
let text = readFileSync(file, 'utf8');
const before = text;
text = text
    .replace(/^\uFEFF/, '')
    // 标题、引用、列表、有序列表（仅行首的语法位置）。
    .replace(/^([ \t]*)\\(#{1,6})(?=\s)/gm, '$1$2')
    .replace(/^([ \t]*)\\(>+)/gm, '$1$2')
    .replace(/^([ \t]*)\\([-*+])(?=\s)/gm, '$1$2')
    .replace(/^([ \t]*)\\(\d+[.)])(?=\s)/gm, '$1$2')
    // 分隔线：保留原有标记长度与尾随空格。
    .replace(/^([ \t]*)\\([-*_])\2{2,}\s*$/gm, (match, indent) => `${indent}${match.slice(indent.length + 1)}`)
    .replace(/^([ \t]*)\\(`{3,}|~{3,})/gm, '$1$2')
    // 常见 HTML 标签可位于行内；未知/自定义的 `\<not-a-tag\>` 保守不动。
    .replace(/\\(<\/?(?:a|abbr|article|aside|audio|b|blockquote|body|br|button|canvas|caption|circle|code|col|colgroup|data|datalist|dd|defs|del|details|dialog|div|dl|dt|em|fieldset|figcaption|figure|footer|form|g|h[1-6]|head|header|hr|html|i|iframe|img|input|ins|kbd|label|legend|li|line|linearGradient|link|main|map|mark|menu|meta|meter|nav|noscript|object|ol|optgroup|option|output|p|path|picture|polygon|polyline|pre|progress|q|rect|rp|rt|ruby|s|samp|script|section|select|slot|small|source|span|stop|strong|style|sub|summary|sup|svg|symbol|table|tbody|td|template|text|textarea|tfoot|th|thead|time|title|tr|track|u|ul|use|var|video|wbr)(?=[\s/>]|\\>)[^>\r\n]*?(?:\\)?>)/gi, (_match, tag) => tag.replace(/\\>$/, '>'))
    // 只恢复完整链接/图片和明显的表格行，孤立 `\[`/`\|` 仍保留。
    .replace(/^([ \t]*)(\\!)?\\(\[[^\r\n\]]*(?:\\)?\]\([^\r\n]*\))/gm, (_match, indent, image, link) => `${indent}${image ? '!' : ''}${link.replace(/\\\]/, ']')}`)
    .replace(/^([ \t]*)(\\\|[^\r\n]*\\\|[^\r\n]*)$/gm, (_match, indent, row) => `${indent}${row.replace(/\\\|/g, '|')}`)
    .replace(/\\\{\\\{([^{}\r\n]{1,200})\\\}\\\}/g, '{{$1}}');
// Atomic replacement prevents a crash from leaving a partially written source
// that a later import would mistakenly treat as authoritative.
const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
try {
    writeFileSync(temporary, text, 'utf8');
    renameSync(temporary, file);
}
catch (error) {
    // Keep the original file untouched when rename fails; leave the temporary
    // artifact for the operator to inspect during recovery.
    throw error;
}
console.log(`[deescape-md] ${file}: ${before.length - text.length} chars un-escaped (${before.length} -> ${text.length})`);
