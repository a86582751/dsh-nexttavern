#!/usr/bin/env node
/**
 * Static documentation site builder for the public dsh-NextTavern repository.
 *
 * The site is generated, not hand-written: page bodies are extracted from the
 * already-public Markdown under `release/public/`, wrapped in a shared shell
 * and written to the public checkout's `docs/` folder together with the theme
 * assets, an offline search index and optimised screenshots.
 *
 * The same file runs in two places:
 *   - the maintainer repository, where the Markdown lives in `release/public/`
 *     and the output defaults to `artifacts/public-site-preview`;
 *   - the public repository (as `site/build.mjs`), where the Markdown sits at
 *     the repository root and the Pages workflow builds into `artifacts/site`.
 *
 * Usage:
 *   node site/build.mjs --out <dir> [--no-optimize] [--check]
 *
 * `--check` renders everything into a temporary directory and reports link and
 * anchor problems without touching the real output.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { site, sourceRoot } from './site.config.mjs';

import type { SitePage, PageSource } from './site.config.mjs';

interface Media { url: string; width?: number; height?: number }
interface Heading { id: string; text: string; level: number }
interface RenderContext {
  registerHeading(text: string, level: number): string;
  resolveImage(src: string): Media;
  resolveLink(href: string, label: string): { url: string; title?: string };
}
interface HeroArt extends Media { file: string; theme: string; alt: string; bytes: Buffer }
interface SearchEntry { p: string; a: string; t: string; h: string; x: string }

const here = path.dirname(fileURLToPath(import.meta.url));
// Maintainer layout: <root>/release/public/site, sources in <root>/release/public.
// Public layout: <repo>/site, sources at the repository root.
const sourcesDir = path.resolve(here, '..');
const maintainer = path.basename(sourcesDir) === path.basename(sourceRoot)
  && path.basename(path.dirname(sourcesDir)) === 'release';
const repoRoot = maintainer ? path.resolve(sourcesDir, '..', '..') : sourcesDir;
const publicRoot = sourcesDir;
const themeRoot = path.join(here, 'theme');

const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf('--' + name);
  return at === -1 ? null : args[at + 1] ?? true;
};
const flag = (name: string) => args.includes('--' + name);
const checkOnly = flag('check');
const optimize = !flag('no-optimize');
const outArg = option('out');
const testTemp = path.join(repoRoot, 'artifacts/test-temp');
if (checkOnly) fs.mkdirSync(testTemp, { recursive: true });
const outDir = checkOnly
  ? fs.mkdtempSync(path.join(testTemp, 'nexttavern-docs-'))
  : path.resolve(repoRoot, outArg && outArg !== true
    ? String(outArg)
    : maintainer ? 'artifacts/public-site-preview' : 'artifacts/site');
if (checkOnly) {
  // Also clean a temporary check when source parsing fails before rendering.
  process.on('exit', () => fs.rmSync(outDir, { recursive: true, force: true }));
}

const warnings: string[] = [];
const problems: string[] = [];
const mediaRecords = new Map<string, Media>();
const droppedAnchors = new Map<string, string[]>();

/* ------------------------------------------------------------------ utils */

const readText = (file: string) => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const writeText = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
};
const copyFile = (from: string, to: string) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};
const escapeHtml = (text: unknown) => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Local build date; the footer should not flip a day early for UTC+8. */
function buildDate() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join('-');
}

/**
 * Heading anchors follow GitHub's rules closely enough for the cross-links
 * already used inside the public documents: lowercase, keep letters/numbers
 * (including CJK), drop other punctuation, spaces become dashes.
 */
function slugify(text: string) {
  return String(text)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function toPlainText(markdown: string) {
  return String(markdown)
    .replace(/```[^\n]*\n[\s\S]*?```/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/^\s*\|?[\s:|-]{4,}\|?\s*$/gm, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~|>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* -------------------------------------------------------------- markdown */

const RAW_HTML_BLOCK = /^(?:<\/?(details|summary|div|span|p|br|img|figure|figcaption|video|source|sup|sub|kbd|mark|table|thead|tbody|tr|td|th|ul|ol|li|blockquote|hr|strong|em|a)\b[^>]*>)(?:<\/[a-z]+>)?\s*$/i;
const RAW_HTML_ANY = /^<(?:\/?[a-zA-Z][\w-]*|!--)/;
const FENCE = /^(```|~~~)\s*([^\s`~]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const QUOTE = /^\s*> ?(.*)$/;

function renderInline(text: string, context: RenderContext): string {
  const tokens: string[] = [];
  let working = String(text);

  // Inline code first so its content is never treated as markup.
  working = working.replace(/`([^`]+)`/g, (match, code) => {
    tokens.push('<code>' + escapeHtml(code) + '</code>');
    return '\u0000' + (tokens.length - 1) + '\u0000';
  });

  working = escapeHtml(working);

  working = working.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (match, alt, src, title) => {
      const resolved = context.resolveImage(src);
      const attrs = 'loading="lazy" decoding="async" alt="' + escapeHtml(alt) + '" src="' + escapeHtml(resolved.url) + '"';
      const size = resolved.width && resolved.height
        ? ' width="' + resolved.width + '" height="' + resolved.height + '"'
        : '';
      const caption = title || alt;
      return '<img ' + attrs + size + ' data-caption="' + escapeHtml(caption) + '">';
    });

  working = working.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (match, label, href) => {
    const resolved = context.resolveLink(href, label);
    const external = /^https?:\/\//.test(resolved.url);
    const cls = external ? ' class="external" target="_blank" rel="noopener noreferrer"' : '';
    const title = resolved.title ? ' title="' + escapeHtml(resolved.title) + '"' : '';
    return '<a href="' + escapeHtml(resolved.url) + '"' + cls + title + '>' + label + '</a>';
  });

  working = working.replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g,
    (match, url) => '<a class="external" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(url) + '</a>');

  working = working
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(（])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');

  working = working.replace(/\u0000(\d+)\u0000/g, (match, index) => tokens[Number(index)]!);
  return working;
}

function parseTableRow(line: string) {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map(cell => cell.trim());
}

function renderBlocks(lines: string[], context: RenderContext, depth = 0): string {
  const html = [];
  let index = 0;
  const level = depth ?? 0;

  while (index < lines.length) {
    const line = lines[index]!;

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(FENCE);
    if (fence) {
      const close = fence[1];
      const language = fence[2] || '';
      const body = [];
      index += 1;
      while (index < lines.length && !new RegExp('^' + close + '\\s*$').test(lines[index]!)) {
        body.push(lines[index]!);
        index += 1;
      }
      index += 1;
      const figure = language === 'mermaid' ? ' mermaid-figure' : '';
      html.push(
        '<div class="code-block' + figure + '">' +
        '<div class="code-head"><span>' + escapeHtml(language || 'text') + '</span>' +
        '<button class="copy-button" type="button" data-copy>复制</button></div>' +
        '<pre><code' + (language ? ' class="language-' + escapeHtml(language) + '"' : '') + '>' +
        escapeHtml(body.join('\n')) + '</code></pre>' +
        (language === 'mermaid'
          ? '<figcaption>Mermaid 流程图源码：复制到支持 Mermaid 的编辑器即可渲染。</figcaption>'
          : '') +
        '</div>'
      );
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      const text = heading[2]!.trim();
      const id = context.registerHeading(text, heading[1]!.length);
      const tag = 'h' + heading[1]!.length;
      html.push('<' + tag + ' id="' + escapeHtml(id) + '"><span class="anchor"></span>' +
        renderInline(text, context) + '</' + tag + '>');
      index += 1;
      continue;
    }

    if (HR.test(line)) {
      html.push('<hr>');
      index += 1;
      continue;
    }

    if (RAW_HTML_BLOCK.test(line) || (RAW_HTML_ANY.test(line) && !line.includes('|'))) {
      html.push(line.trim());
      index += 1;
      continue;
    }

    if (/^\s*\|/.test(line) && index + 1 < lines.length && TABLE_DIVIDER.test(lines[index + 1]!)) {
      const head = parseTableRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && /^\s*\|/.test(lines[index]!) && lines[index]!.trim()) {
        rows.push(parseTableRow(lines[index]!));
        index += 1;
      }
      const headHtml = head
        .map(cell => '<th>' + renderInline(cell, context) + '</th>')
        .join('');
      const bodyHtml = rows
        .map(row => '<tr>' + row.map(cell => '<td>' + renderInline(cell, context) + '</td>').join('') + '</tr>')
        .join('');
      html.push('<div class="table-wrap"><table><thead><tr>' + headHtml +
        '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>');
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const first = line.match(LIST_ITEM)!;
      const baseIndent = first[1]!.length;
      const ordered = /^\d/.test(first[2]!);
      const items: { body: string[] }[] = [];
      let current: { body: string[] } | null = null;
      while (index < lines.length) {
        const candidate = lines[index]!;
        if (!candidate.trim()) {
          const following = lines[index + 1]!;
          if (following && (LIST_ITEM.test(following) || /^\s{2,}\S/.test(following))) {
            if (current) current.body.push('');
            index += 1;
            continue;
          }
          break;
        }
        const item = candidate.match(LIST_ITEM);
        if (item && item[1]!.length <= baseIndent) {
          current = { body: [item[3]!] };
          items.push(current);
          index += 1;
          continue;
        }
        const indent = candidate.match(/^(\s*)/)![1]!.length;
        if (current && indent > baseIndent) {
          const strip = Math.min(indent, baseIndent + 2);
          current.body.push(candidate.slice(strip));
          index += 1;
          continue;
        }
        if (current && indent === 0 && !LIST_ITEM.test(candidate)) {
          current.body.push(candidate);
          index += 1;
          continue;
        }
        break;
      }
      const tag = ordered ? 'ol' : 'ul';
      const itemsHtml = items
        .map(item => '<li>' + renderBlocks(item.body, context, level + 1) + '</li>')
        .join('');
      html.push('<' + tag + '>' + itemsHtml + '</' + tag + '>');
      continue;
    }

    if (QUOTE.test(line)) {
      const body = [];
      while (index < lines.length && (QUOTE.test(lines[index]!) || !lines[index]!.trim())) {
        if (!lines[index]!.trim() && !QUOTE.test(lines[index + 1]! || '')) break;
        body.push(lines[index]!.replace(/^\s*> ?/, ''));
        index += 1;
      }
      html.push('<blockquote>' + renderBlocks(body, context, level + 1) + '</blockquote>');
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index]!.trim() &&
      !FENCE.test(lines[index]!) &&
      !HEADING.test(lines[index]!) &&
      !HR.test(lines[index]!) &&
      !LIST_ITEM.test(lines[index]!) &&
      !QUOTE.test(lines[index]!) &&
      !(RAW_HTML_ANY.test(lines[index]!) && !lines[index]!.includes('|')) &&
      !/^\s*\|/.test(lines[index]!)
    ) {
      paragraph.push(lines[index]!.trim());
      index += 1;
    }
    html.push('<p>' + paragraph.map(part => renderInline(part, context)).join(' ') + '</p>');
  }

  return html.join('\n');
}

/* ----------------------------------------------------------- page sources */

function pageSources(page: SitePage): PageSource[] {
  if (page.sources) return page.sources;
  return [{ file: page.file, sections: page.sections }];
}

const fileCache = new Map<string, string>();

function readSource(file: string): string {
  if (!fileCache.has(file)) {
    const full = path.join(publicRoot, file);
    if (!fs.existsSync(full)) throw new Error('Missing public document: ' + file);
    fileCache.set(file, readText(full));
  }
  return fileCache.get(file)!;
}

/** Drops a leading H1 and a leading banner image from a document. */
function stripDocumentHeader(markdown: string) {
  const lines = markdown.split('\n');
  let index = 0;
  while (index < lines.length && !lines[index]!.trim()) index += 1;
  if (index < lines.length && /^!\[[^\]]*\]\([^)]*\)\s*$/.test(lines[index]!)) index += 1;
  while (index < lines.length && !lines[index]!.trim()) index += 1;
  if (index < lines.length && /^#\s+/.test(lines[index]!)) index += 1;
  return lines.slice(index).join('\n').trim();
}

/**
 * Extracts whole H2 sections by exact heading text. Missing headings fail the
 * build so navigation cannot quietly point at content that no longer exists.
 */
function extractSections(markdown: string, headings: string[]) {
  const lines = markdown.split('\n');
  const chunks = [];
  for (const wanted of headings) {
    const start = lines.findIndex(line => {
      const match = line.match(HEADING);
      return match && match[1]!.length === 2 && match[2]!.trim() === wanted;
    });
    if (start === -1) throw new Error('Section not found in public document: ' + wanted);
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      const match = lines[index]!.match(HEADING);
      if (match && match[1]!.length <= 2) {
        end = index;
        break;
      }
    }
    chunks.push(lines.slice(start, end).join('\n').trim());
  }
  return chunks.join('\n\n');
}

function bodyFor(page: SitePage) {
  const parts = [];
  let index = 0;
  for (const source of pageSources(page)) {
    const markdown = readSource(source.file);
    const first = index === 0;
    index += 1;
    if (!source.sections || !source.sections.length) {
      parts.push(stripDocumentHeader(markdown));
      continue;
    }
    let chunk = extractSections(markdown, source.sections);
    // A page that mirrors one document section already shows that name as its
    // H1; dropping the repeated H2 keeps the outline and the TOC clean.
    if (first) {
      const lines = chunk.split('\n');
      const at = lines.findIndex(line => line.trim());
      const heading = at === -1 ? null : lines[at]!.match(HEADING);
      const mirrorsTitle = heading && slugify(heading[2]!) === slugify(page.title);
      if (heading && heading[1]!.length === 2 && (mirrorsTitle || page.dropHeading === true)) {
        // Keep the anchor addressable even though the visible heading is gone.
        droppedAnchors.set(page.id, [...(droppedAnchors.get(page.id) ?? []), slugify(heading[2]!)]);
        lines[at] = '<span id="' + slugify(heading[2]!) + '"></span>';
        chunk = lines.slice(at).join('\n').trim();
      }
    }
    parts.push(chunk);
  }
  return parts.join('\n\n');
}

/** Intrinsic WebP size, so the hero art keeps its box before it decodes. */
function webpSize(buffer: Buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
  const fourcc = buffer.toString('ascii', 12, 16);
  if (fourcc === 'VP8X') {
    return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
  }
  if (fourcc === 'VP8 ') {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (fourcc === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

/**
 * Committed concept illustrations are copied verbatim. Their provenance lives
 * in art/README.md; theme switching selects a matching hero without a carousel.
 */
const artRoot = path.join(here, 'art');
const heroArt: HeroArt[] = [];
for (const item of site.hero.art ?? []) {
  const file = path.join(artRoot, item.file);
  if (!fs.existsSync(file)) {
    problems.push('Hero art missing: site/art/' + item.file);
    continue;
  }
  const bytes = fs.readFileSync(file);
  const size = webpSize(bytes);
  heroArt.push({ ...item, url: 'assets/art/' + item.file, bytes, ...(size ?? {}) });
}

/**
 * The lockup is the amber skin's own keeper art, not a text monogram: her head
 * on the site's amber plate (`art/brand-mark.webp`) next to the "Next Tavern"
 * sign she leans on (`art/brand-word.webp`). The tab icon is the same head,
 * bled to the edges, in `art/favicon.png`. All three are committed bytes and
 * are written as-is, so the published brand cannot drift from the skin.
 */
const brandAsset = (file: string) => {
  const source = path.join(artRoot, file);
  if (!fs.existsSync(source)) {
    problems.push('Brand asset missing: site/art/' + file);
    return { url: 'assets/art/' + file, bytes: null };
  }
  return { url: 'assets/art/' + file, bytes: fs.readFileSync(source) };
};

const brandMark = brandAsset(site.brandMark.mark);
const brandWord = brandAsset(site.brandMark.word);
const favicon = brandAsset('favicon.png');

/**
 * The head is decorative; the wooden sign spells the name, so it carries the
 * alternate text and the link keeps a readable name in every reader.
 */
function brandMarkTag() {
  return '<span class="brand-mark"><img src="' + brandMark.url + '" alt="" aria-hidden="true" decoding="async"></span>' +
    '<span class="brand-name">Next<span>Tavern</span><small>故事在此，继续发生</small></span>';
}

/* --------------------------------------------------------------- media */

const MEDIA_EXT = /\.(png|jpe?g|webp|gif|avif)$/i;

function toolPath(name: string) {
  try {
    const probe = process.platform === 'win32' ? 'where' : 'which';
    const found = execFileSync(probe, [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)[0];
    return found || null;
  } catch (error) {
    // Some images ship without `which`; running the tool itself is the
    // authoritative check and also proves it starts on this machine.
    try {
      execFileSync(name, ['-version'], { stdio: ['ignore', 'ignore', 'ignore'] });
      return name;
    } catch {
      return null;
    }
  }
}

// ffmpeg keeps the screenshots small and is fast enough to run on every build;
// without it the originals are copied so the site still builds offline.
const ffmpeg = optimize ? toolPath('ffmpeg') : null;
const ffprobe = ffmpeg ? toolPath('ffprobe') : null;

function optimizeImage(source: string, target: string, maxWidth: number) {
  const png = target.replace(/\.webp$/i, '') + '.png';
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (ffmpeg) {
    try {
      execFileSync(ffmpeg, [
        '-y', '-loglevel', 'error', '-i', source,
        '-vf', 'scale=min(' + maxWidth + '\\,iw):-2',
        '-c:v', 'libwebp', '-quality', '82', '-compression_level', '4',
        target
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      return true;
    } catch (error) {
      warnings.push('ffmpeg could not convert ' + source + ': copying the original instead');
    }
  }
  copyFile(source, png);
  return false;
}

function imageSize(file: string) {
  if (!ffprobe) return null;
  try {
    const output = execFileSync(ffprobe, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file
    ], { encoding: 'utf8' });
    const [width, height] = output.trim().split(',').map(Number);
    return Number.isFinite(width) && Number.isFinite(height) ? { width: width!, height: height! } : null;
  } catch (error) {
    return null;
  }
}

/**
 * Copies every referenced image into `assets/media/` once, downscaled, and
 * remembers the final URL plus intrinsic size so pages avoid layout shifts.
 */
function prepareMedia(sourcePaths: string[]) {
  const unique = [...new Set(sourcePaths)].filter(src => MEDIA_EXT.test(src));
  for (const src of unique) {
    const name = src.replace(/^.*\//, '').replace(MEDIA_EXT, '');
    const webp = 'assets/media/' + name + '.webp';
    const source = path.join(publicRoot, src);
    if (!fs.existsSync(source)) {
      problems.push('Referenced image is missing: ' + src);
      continue;
    }
    const target = path.join(outDir, webp);
    const converted = optimizeImage(source, target, src.startsWith('images/') ? 2000 : 1600);
    const finalUrl = converted ? webp : webp.replace(/\.webp$/, '.png');
    const size = imageSize(path.join(outDir, finalUrl));
    mediaRecords.set(src, { url: finalUrl, ...(size ?? {}) });
  }
}

/* ---------------------------------------------------------- link targets */

const pageById = new Map(site.groups.flatMap(group => group.pages.map(page => [page.id, page])));
const allPages = site.groups.flatMap(group => group.pages);

const FILE_TARGETS: Record<string, string> = {
  'README.md': 'index.html',
  'INSTALL-WINDOWS.md': 'install-windows.html',
  'INSTALL-LINUX.md': 'install-linux.html',
  'PUBLIC-ACCESS.md': 'public-access.html',
  'ARCHITECTURE.md': 'architecture.html',
  'SCREENSHOTS.md': 'screenshots.html',
  'CHANGELOG.md': 'changelog.html',
  'CONTRIBUTING.md': 'development.html'
};

const pageHeadingSlugs = new Map<string, Set<string>>();

function headingSlugsFor(page: SitePage): Set<string> {
  if (pageHeadingSlugs.has(page.id)) return pageHeadingSlugs.get(page.id)!;
  const body = bodyFor(page);
  const slugs = new Set(droppedAnchors.get(page.id) ?? []);
  const lines = body.split('\n');
  let inFence = false;
  for (const line of lines) {
    if (FENCE.test(line)) inFence = !inFence;
    if (inFence) continue;
    const match = line.match(HEADING);
    if (!match) continue;
    slugs.add(slugify(match[2]!));
  }
  pageHeadingSlugs.set(page.id, slugs);
  return slugs;
}

const anchorOwners = new Map<string, string>();
for (const page of allPages) {
  for (const slug of headingSlugsFor(page)) {
    if (!anchorOwners.has(slug)) anchorOwners.set(slug, page.id + '#' + slug);
  }
}

/* ------------------------------------------------------------ rendering */

function contextFor(page: SitePage, headings: Heading[]): RenderContext {
  return {
    registerHeading(text, level) {
      const id = slugify(text);
      headings.push({ id, text: toPlainText(text), level });
      return id;
    },
    resolveImage(src) {
      const record = mediaRecords.get(src);
      if (record) return record;
      if (/^https?:/.test(src)) return { url: src };
      problems.push('Image is not registered for copying: ' + src);
      return { url: src };
    },
    resolveLink(href, label) {
      if (/^[a-z]+:/i.test(href) && !/^https?:/i.test(href)) return { url: href };
      if (/^https?:/i.test(href)) return { url: href };
      if (href.startsWith('#')) {
        const slug = slugify(decodeURIComponent(href.slice(1)));
        return { url: anchorUrl(page.id, slug) };
      }
      const [file = '', hash] = href.split('#');
      if (hash) {
        const owner = anchorOwners.get(slugify(decodeURIComponent(hash)));
        if (owner) {
          const [ownerPage, ownerSlug] = owner.split('#');
          return { url: ownerPage === page.id ? '#' + ownerSlug : ownerPage + '.html#' + ownerSlug };
        }
      }
      const target = FILE_TARGETS[file];
      if (target) return { url: target + (hash ? '#' + slugify(decodeURIComponent(hash)) : '') };
      if (/\.md$/i.test(file)) {
        warnings.push('Document link mapped to GitHub: ' + file + ' (' + page.id + ', "' + label + '")');
        return { url: site.repoUrl + '/blob/main/' + file + (hash ? '#' + hash : '') };
      }
      if (file === 'LICENSE') return { url: site.licenseUrl };
      if (MEDIA_EXT.test(file)) {
        const record = mediaRecords.get(file);
        return { url: record ? record.url : file };
      }
      if (file.includes('/') || /\.[a-z0-9]{1,5}$/i.test(file)) {
        // Anything else relative is a repository file the reader can open on
        // GitHub (examples, tools, notices); keep the site itself self-contained.
        return { url: site.repoUrl + '/blob/main/' + file + (hash ? '#' + hash : '') };
      }
      warnings.push('Unmapped link target: ' + href + ' (' + page.id + ')');
      return { url: href };
    }
  };
}

/** Resolves an in-document anchor, preferring the current page's own headings. */
function anchorUrl(pageId: string, slug: string) {
  if ((pageHeadingSlugs.get(pageId) ?? new Set()).has(slug)) return '#' + slug;
  const owner = anchorOwners.get(slug);
  if (owner) {
    const [ownerPage, ownerSlug] = owner.split('#');
    return ownerPage === pageId ? '#' + ownerSlug : ownerPage + '.html#' + ownerSlug;
  }
  warnings.push('Anchor has no target on any page: #' + slug);
  return '#' + slug;
}

/* ------------------------------------------------------------- templates */

const NAV_ICONS: Record<string, string> = {
  cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="15" rx="2.5"/><path d="M8 3h9a2.5 2.5 0 0 1 2.5 2.5V17"/></svg>',
  memory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.5a3 3 0 0 0-3 3v.4A3 3 0 0 0 7 13a3 3 0 0 0 2 2.8v.7a3 3 0 0 0 6 0v-.7A3 3 0 0 0 17 13a3 3 0 0 0-2-5.1v-.4a3 3 0 0 0-3-3Z"/><path d="M12 4.5v15"/></svg>',
  palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1.3 0 2-.8 2-1.8 0-1.6-1.6-1.7-1.6-3 0-1.2 1-2.2 2.4-2.2H17a4 4 0 0 0 4-4C21 6 17 3 12 3Z"/><circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="11" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5Z"/><path d="M4 5.5v15"/></svg>',
  agents: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="3"/><circle cx="17" cy="15" r="2.4"/><path d="M4 19c.6-2.6 2.6-4 5-4s4.4 1.4 5 4"/><path d="M14.5 9.5 18 7"/></svg>',
  branch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="9" r="2.2"/><path d="M6 7.2v9.6M8.2 6.4h5.3A2.3 2.3 0 0 1 15.8 9"/></svg>',
  export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m7.5 7.5 4.5-4.5 4.5 4.5"/><path d="M4 14v5.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V14"/></svg>',
  skin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M12 8H5.2M12 16H5.2M12 12h6.8"/></svg>',
  install: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"/><path d="m7.5 10 4.5 4 4.5-4"/><path d="M4 17.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5"/></svg>',
  windows: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 5.6 11 4.6v6.7H4Zm8.2-1.2L20 3.2v8.1h-7.8ZM4 12.7h7v6.7L4 18.4Zm8.2 0H20v8.1l-7.8-1.2Z"/></svg>',
  linux: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c-2.4 0-3.6 1.9-3.6 4.4 0 1.6-.5 2.5-1.4 4-1 1.6-1.7 2.7-1.7 4.2 0 2.3 2.2 3.4 6.7 3.4s6.7-1.1 6.7-3.4c0-1.5-.7-2.6-1.7-4.2-.9-1.5-1.4-2.4-1.4-4C15.6 4.9 14.4 3 12 3Z"/><path d="M10 7.5h4"/><circle cx="10.4" cy="6" r=".5" fill="currentColor"/><circle cx="13.6" cy="6" r=".5" fill="currentColor"/></svg>',
  terminal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7.5 10 2.5 2-2.5 2M13 14h4"/></svg>'
};

function icon(name: string) {
  return NAV_ICONS[name] ?? NAV_ICONS.install;
}

const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>';

function header(activeId: string) {
  return [
    '<header class="topbar">',
    '  <button class="icon-button menu-toggle" type="button" data-nav-toggle aria-label="打开目录" aria-expanded="false">',
    '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    '  </button>',
    '  <a class="brand" href="index.html">' + brandMarkTag() +
    '</a>',
    '  <nav class="topbar-links" aria-label="主导航"><a href="index.html#chapters">故事的可能</a><a href="quickstart.html">使用手册</a><a href="screenshots.html">界面一瞥</a></nav>',
    '  <span class="chip hide-md"><span class="dot"></span>最新发行 <b>v' + escapeHtml(site.releaseVersion) + '</b></span>',
    '  <span class="spacer"></span>',
    '  <div class="topbar-actions">',
    '    <button class="search-button" type="button" data-search-open aria-label="搜索文档">' + SEARCH_ICON +
    '<span>搜索文档</span><kbd>Ctrl K</kbd></button>',
    '    <button class="icon-button theme-toggle" type="button" data-theme-toggle aria-label="切换深浅色">',
    '      <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></svg>',
    '      <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>',
    '    </button>',
    '    <a class="icon-button" href="' + site.repoUrl + '" target="_blank" rel="noopener noreferrer" aria-label="GitHub 仓库">',
    '      <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>',
    '    </a>',
    '  </div>',
    '</header>'
  ].join('\n');
}

function sidebar(activeId: string) {
  const groups = site.groups.map(group => {
    const links = group.pages.map(page => {
      const current = page.id === activeId ? ' aria-current="page"' : '';
      return '<a href="' + page.id + '.html"' + current + '>' + escapeHtml(page.nav ?? page.title) + '</a>';
    }).join('');
    const containsActive = group.pages.some(page => page.id === activeId);
    return [
      '<div class="nav-group" data-collapsed="' + (containsActive ? 'false' : 'false') + '">',
      '  <button class="nav-group-label" type="button" data-group-toggle aria-expanded="true">' + escapeHtml(group.label),
      '    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
      '  </button>',
      '  <nav class="nav-links" aria-label="' + escapeHtml(group.label) + '">' + links + '</nav>',
      '</div>'
    ].join('\n');
  }).join('\n');
  return [
    '<aside class="sidebar" id="sidebar" aria-label="文档目录">',
    '  <p class="sidebar-title">文档目录</p>',
    groups,
    '  <div class="sidebar-footer">',
    '    <p>当前发行 <b>' + escapeHtml(site.releaseVersion) + '</b>，GitHub 与 npm latest 同步。<br>0.3 开发中，尚未发布。</p>',
    '    <p><a href="' + site.repoUrl + '" target="_blank" rel="noopener noreferrer">GitHub 仓库 ↗</a></p>',
    '  </div>',
    '</aside>'
  ].join('\n');
}

function searchOverlay() {
  return [
    '<div class="overlay" data-search data-open="false" role="dialog" aria-modal="true" aria-label="搜索文档">',
    '  <div class="search-panel">',
    '    <div class="search-field">' + SEARCH_ICON,
    '      <input type="search" placeholder="搜索功能、设置或命令…" aria-label="搜索文档" autocomplete="off" spellcheck="false">',
    '      <button class="icon-button" type="button" data-search-close aria-label="关闭搜索">✕</button>',
    '    </div>',
    '    <ul class="search-results"></ul>',
    '    <p class="search-empty" hidden>没有匹配的结果，换个关键词试试。</p>',
    '    <div class="search-hints"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Esc</kbd> 关闭</span></div>',
    '  </div>',
    '</div>',
    '<div class="lightbox" data-lightbox data-open="false" role="dialog" aria-modal="true" aria-label="查看截图">',
    '  <button type="button" data-lightbox-close aria-label="关闭">✕</button>',
    '  <img alt="">',
    '  <figcaption></figcaption>',
    '</div>'
  ].join('\n');
}

function footer() {
  const columns = site.footer.columns.map(column => [
    '<div>',
    '  <h4>' + escapeHtml(column.label) + '</h4>',
    '  <ul>' + column.links.map(link =>
      '<li><a href="' + escapeHtml(link.href) + '">' + escapeHtml(link.label) + '</a></li>').join('') + '</ul>',
    '</div>'
  ].join('\n')).join('\n');
  return [
    '<footer class="site-footer">',
    '  <div class="footer-inner">',
    '    <div class="footer-brand">',
    '      <a class="brand" href="index.html">' + brandMarkTag() +
    '</a>',
    '      <p>' + escapeHtml(site.footer.blurb) + '</p>',
    '      <p class="footer-note">文档站内容与仓库文档同源生成；截图由维护者提供，不代表默认安装外观。</p>',
    '    </div>',
    columns,
    '  </div>',
    '  <div class="footer-base">',
    '    <span>© ' + new Date().getUTCFullYear() + ' ' + escapeHtml(site.productName) + ' · 文档以 <a href="' + site.licenseUrl + '">' + escapeHtml(site.licenseName) + '</a> 分发</span>',
    '    <span>构建于 ' + buildDate() + ' · <a href="' + site.repoUrl + '/tree/main/site">本站源码</a></span>',
    '  </div>',
    '</footer>'
  ].join('\n');
}

function shell({ id, title, description, body, classes }: { id: string; title: string; description: string; body: (canonical: string) => string; classes?: string }) {
  const fullTitle = id === 'index' ? title : title + ' · ' + site.title;
  const canonical = id === 'index' ? 'index.html' : id + '.html';
  return [
    '<!doctype html>',
    '<html lang="' + (site.lang || 'zh-CN') + '" data-theme="light">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + escapeHtml(fullTitle) + '</title>',
    '<meta name="description" content="' + escapeHtml(description) + '">',
    '<meta name="keywords" content="' + escapeHtml((site.keywords ?? []).join(',')) + '">',
    '<meta name="theme-color" content="#f5efdf">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="' + escapeHtml(fullTitle) + '">',
    '<meta property="og:description" content="' + escapeHtml(description) + '">',
    '<link rel="icon" type="image/png" sizes="180x180" href="' + favicon.url + '">',
    '<link rel="apple-touch-icon" href="' + favicon.url + '">',
    '<link rel="stylesheet" href="assets/site.css">',
    '<script>(function(){try{var t=localStorage.getItem("nexttavern-docs-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();</script>',
    '</head>',
    '<body class="' + (classes ?? '') + '">',
    '<a class="skip-link" href="#content">跳到正文</a>',
    header(id),
    body(canonical),
    footer(),
    '<div class="sidebar-scrim" data-nav-scrim></div>',
    searchOverlay(),
    '<script src="assets/site.js" defer></script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

/* --------------------------------------------------------- content pages */

const searchIndex: SearchEntry[] = [];

function renderPage(page: SitePage, position: number) {
  const headings: Heading[] = [];
  const context = contextFor(page, headings);
  const markdown = bodyFor(page);
  const html = renderBlocks(markdown.split('\n'), context);

  const sections: { heading: string; anchor: string; text: string[] }[] = [];
  let currentSection: { heading: string; anchor: string; text: string[] } = { heading: page.title, anchor: '', text: [] };
  for (const line of markdown.split('\n')) {
    const heading = line.match(HEADING);
    if (heading) {
      if (currentSection.text.length || currentSection.anchor) sections.push(currentSection);
      currentSection = {
        heading: toPlainText(heading[2]!),
        anchor: headings.find(entry => entry.text === toPlainText(heading[2]!))?.id ?? '',
        text: []
      };
      continue;
    }
    currentSection.text.push(line);
  }
  sections.push(currentSection);

  const described = sections
    .map(section => ({
      p: page.id + '.html',
      a: section.anchor,
      t: page.title,
      h: section.heading,
      x: toPlainText(section.text.join(' ')).slice(0, 420)
    }))
    .filter(entry => entry.x.length > 0 || entry.a);
  searchIndex.push(...described);

  const toc = headings.filter(heading => heading.level >= 2 && heading.level <= 3);
  const previous = allPages[position - 1];
  const next = allPages[position + 1];
  const group = site.groups.find(item => item.pages.some(item2 => item2.id === page.id));

  const bodyHtml = [
    '<div class="layout">',
    sidebar(page.id),
    '  <main id="content">',
    '    <article class="article"' + (page.lang ? ' lang="' + page.lang + '"' : '') + '>',
    '      <nav class="breadcrumbs" aria-label="面包屑"><a href="index.html">文档首页</a><span>/</span><span>' +
      escapeHtml(group ? group.label : '') + '</span><span>/</span><span>' + escapeHtml(page.title) + '</span></nav>',
    '      <h1>' + escapeHtml(page.title) + '</h1>',
    page.summary ? '      <p class="lede">' + escapeHtml(page.summary) + '</p>' : '',
    html,
    '    </article>',
    '    <nav class="pager" aria-label="翻页">',
    previous ? '<a href="' + previous.id + '.html"><span>上一页</span><b>' + escapeHtml(previous.title) + '</b></a>' : '<span></span>',
    next ? '<a class="next" href="' + next.id + '.html"><span>下一页</span><b>' + escapeHtml(next.title) + '</b></a>' : '<span></span>',
    '    </nav>',
    '  </main>',
    '  <aside class="toc" aria-label="本页目录">',
    '    <p class="toc-label">本页目录</p>',
    '    <nav>' + toc.map(entry =>
      '<a href="#' + entry.id + '" data-depth="' + entry.level + '">' + escapeHtml(entry.text) + '</a>').join('') + '</nav>',
    '    <a class="back-top" href="#content">回到顶部 ↑</a>',
    '  </aside>',
    '</div>'
  ].filter(line => line !== '').join('\n');

  const description = page.description
    ?? described.map(entry => entry.x).join(' ').slice(0, 150)
    ?? site.description;

  return shell({
    id: page.id,
    title: page.title,
    description: description || site.description,
    body: () => bodyHtml
  });
}

/* ------------------------------------------------------------- landing */

function landingPage() {
  const hero = site.hero;
  const [heroFirst, heroSecond] = hero.title.split('，');
  const tabs = site.quickInstall.tabs.map((tab, index) =>
    '<button type="button" role="tab" id="tab-' + tab.id + '" aria-selected="' + (index === 0) +
    '" tabindex="' + (index === 0 ? '0' : '-1') + '" aria-controls="install-' + tab.id + '">' +
    icon(tab.id === 'windows' ? 'windows' : tab.id === 'linux' ? 'linux' : 'terminal') +
    escapeHtml(tab.label) + '</button>').join('\n');
  const panels = site.quickInstall.tabs.map((tab, index) => [
    '<div class="install-body" id="install-' + tab.id + '" role="tabpanel" aria-labelledby="tab-' + tab.id +
      '"' + (index === 0 ? '' : ' hidden') + '>',
    '<p>' + escapeHtml(tab.note) + '</p>',
    '<div class="code-block"><div class="code-head"><span>' + escapeHtml(tab.label) + '</span>' +
      '<button class="copy-button" type="button" data-copy>复制</button></div>' +
      '<pre><code>' + escapeHtml(tab.code) + '</code></pre></div>',
    '<a class="text-link" href="' + tab.primary.href + '">' + escapeHtml(tab.primary.label) + ' <span>↗</span></a>',
    '</div>'
  ].join('\n')).join('\n');

  const image = (file: string, cls: string, eager = false) => {
    const art = heroArt.find(item => item.file === file);
    return '<img class="' + cls + '" src="assets/art/' + file + '" alt="' + escapeHtml(art?.alt ?? '') +
      '" width="' + (art?.width ?? 1536) + '" height="' + (art?.height ?? 1024) +
      '" decoding="async" ' + (eager ? 'fetchpriority="high"' : 'loading="lazy"') + '>';
  };

  const chapters = [
    {
      number: '01', kicker: 'MEMORY · 留住来时的路', title: '伏笔有迹可循，\n故事才有回响。',
      text: '昨日的约定、旅途的线索、人物之间微妙的变化，不必全靠一段聊天窗口承载。固定设定、近期正文与可检索的历史，各有自己的位置。',
      points: ['固定设定与近期正文分层保留', '导演笔记记录进展，可追溯原文', '关键词、语义与混合历史召回'],
      file: 'memory-atlas.webp', href: 'memory.html', label: '翻阅记忆系统', note: 'FIELD NOTES / 记忆档案'
    },
    {
      number: '02', kicker: 'WORLDLINES · 另一条可能', title: '每一个「如果」，\n都值得另起一页。',
      text: '换一句回答，重走一个路口。重新生成和修改后发送，在同一对话里留下不同世界线；也能把一条分支带进新的对话，保留它的来处。',
      points: ['在同一对话中切换与续写世界线', '显式分支到新对话，保留来源', '选择一条世界线，整理成小说稿'],
      file: 'worldline-atlas.webp', href: 'worldlines.html', label: '探索世界线', note: 'ROUTE MAP / 旅程分岔'
    },
    {
      number: '03', kicker: 'CHARACTERS · 各自鲜活', title: '他们有自己的心事，\n也有自己的下一步。',
      text: '让主要角色各自推演，再由主代理协调故事。配合角色卡、世界书和独立的模型路由，给人物留出自己的视角，也让你继续掌握方向。',
      points: ['导入 PNG 与 JSON 角色卡和内嵌世界书', '主要角色独立推演，主代理协调', '正文、记忆、读卡等任务分别配置模型'],
      file: 'character-atlas.webp', href: 'character-cluster.html', label: '认识角色集群', note: 'TRAVEL COMPANIONS / 同行的人'
    }
  ].map(chapter => [
    '<article class="chapter chapter-' + chapter.number + '">',
    '<figure class="chapter-art">' + image(chapter.file, 'concept-art') +
      '<figcaption>' + chapter.note + '</figcaption><span class="paper-pin" aria-hidden="true"></span></figure>',
    '<div class="chapter-copy"><span class="chapter-number" aria-hidden="true">' + chapter.number + '</span>',
    '<p class="eyebrow">' + chapter.kicker + '</p>',
    '<h3>' + chapter.title.split('\n').map(escapeHtml).join('<br>') + '</h3>',
    '<p>' + chapter.text + '</p>',
    '<ul class="chapter-points">' + chapter.points.map(point => '<li>' + point + '</li>').join('') + '</ul>',
    '<a class="text-link" href="' + chapter.href + '">' + chapter.label + ' <span>↗</span></a></div>',
    '</article>'
  ].join('\n')).join('\n');

  const extraFeatures = site.features.filter(feature =>
    !['memory', 'branch', 'agents', 'install'].includes(feature.icon)).map(feature => [
      '<a class="field-entry" href="' + feature.href + '"><span class="field-icon">' + icon(feature.icon) + '</span>',
      '<span><b>' + escapeHtml(feature.title) + '</b><span>' +
      feature.text.replace(/`([^`]+)`/g, '$1') + '</span></span><span class="entry-arrow">↗</span></a>'
    ].join('')).join('\n');

  const docMap = site.groups.map((group, index) => [
    '<section class="map-column"><p class="eyebrow">CHAPTER / ' + String(index + 1).padStart(2, '0') + '</p>',
    '<h3>' + escapeHtml(group.label) + '</h3><ul>' + group.pages.slice(0, 5).map(page =>
      '<li><a href="' + page.id + '.html">' + escapeHtml(page.nav ?? page.title) + '<span>↗</span></a></li>').join('') +
      '</ul></section>'
  ].join('\n')).join('\n');

  const body = () => [
    '<main id="content" class="journal-home">',
    '<section class="journal-hero">',
    '<div class="hero-copy"><p class="eyebrow">' + escapeHtml(hero.eyebrow) + '</p>',
    '<h1>' + escapeHtml(heroFirst) + '，<br><span>' + escapeHtml(heroSecond) + '</span><i aria-hidden="true">。</i></h1>',
    '<p class="hero-lead">' + escapeHtml(hero.lead) + '</p>',
    '<div class="cta-row"><a class="button primary" href="' + hero.primary.href + '">' +
      escapeHtml(hero.primary.label) + ' <span>↗</span></a><a class="text-link" href="' + hero.secondary.href + '">' +
      escapeHtml(hero.secondary.label) + ' <span>→</span></a></div>',
    '<p class="hero-footnote"><span class="status-dot"></span> 开源 · 本地运行 · 由你选择模型</p></div>',
    '<figure class="hero-postcard"><span class="postcard-stamp" aria-hidden="true">NEXT<br>TAVERN<br>✦</span>',
    '<div class="hero-picture">' + image('journal-day.webp', 'art-day', true) +
      image('journal-night.webp', 'art-night', true) + '</div>',
    '<figcaption><span>POSTCARD № 001</span>' + escapeHtml(hero.artCaption) + '</figcaption>',
    '<span class="tape tape-one" aria-hidden="true"></span><span class="tape tape-two" aria-hidden="true"></span>',
    '</figure><span class="hero-coordinate" aria-hidden="true">A NEW CHAPTER AWAITS · EST. 2026</span></section>',
    '<div class="edition-strip"><div><span class="edition-label">旅人告示</span><a href="changelog.html">最新发行 <b>v' +
      escapeHtml(site.releaseVersion) + '</b> <span>↗</span></a></div><p>GitHub 与 npm latest 已同步 · 0.3 开发中，尚未发布</p></div>',
    '<section class="journal-section chapters-section" id="chapters"><div class="section-heading">',
    '<p class="eyebrow">THE STORY KEEPS UNFOLDING</p><h2>不止是对话。<br>是一段可以走下去的故事。</h2>',
    '<p>NextTavern 把原生 Agent Loop 带进长篇角色扮演。<br>让世界有来处，让选择有去向，让人物有自己的声音。</p></div>',
    chapters, '</section>',
    '<section class="journal-section field-section"><div class="section-heading compact">',
    '<p class="eyebrow">PACK YOUR JOURNEY</p><h2>也为你的旅途，备好这些。</h2>',
    '<p>从一张角色卡，到一部可以带走的小说。</p></div><div class="field-list">' + extraFeatures + '</div>',
    '<a class="text-link field-all" href="capabilities.html">查看完整能力与支持范围 <span>↗</span></a></section>',
    '<section class="journal-section install-section" id="install"><div class="install-intro">',
    '<p class="eyebrow">BEGIN YOUR NEXT CHAPTER</p><h2>旅程的第一步，<br>从这里开始。</h2>',
    '<p>选一个安装方式，准备好模型 API，再带上你喜欢的角色卡。</p>',
    '<a class="text-link" href="quickstart.html">第一次来？跟着快速开始 <span>↗</span></a>',
    '<div class="installation-note"><b>当前发行 v' + escapeHtml(site.releaseVersion) + '</b><p>' +
      escapeHtml(site.quickInstall.lead) + '</p></div></div>',
    '<div class="install-panel"><div class="install-tabs" data-install-tabs role="tablist" aria-label="安装方式">' +
      tabs + '</div>' + panels + '</div></section>',
    '<section class="journal-section map-section" id="guide"><div class="section-heading compact">',
    '<p class="eyebrow">THE TRAVELER’S HANDBOOK</p><h2>一本手册，随时翻阅。</h2>',
    '<p>按你现在想做的事，找到下一页。</p></div><div class="doc-map">' + docMap + '</div></section>',
    '<section class="journal-section screenshot-invitation"><span class="viewfinder" aria-hidden="true">' + icon('skin') + '</span>',
    '<div><p class="eyebrow">A GLIMPSE INSIDE</p><h2>故事之外，看看酒馆的模样。</h2>',
    '<p>游玩、记忆、世界线与日夜主题的实机截图，收在单独一册。</p></div>',
    '<a class="button ghost" href="screenshots.html">翻开截图集 <span>↗</span></a></section>',
    '<p class="closing-line">故事未完。我们，下一页见。<span>✦</span></p></main>',
    '<div class="home-mobile-nav">' + sidebar('index') + '</div>'
  ].join('\n');

  return shell({
    id: 'index', title: site.productName + ' · ' + hero.title,
    description: site.description, body, classes: 'page-home'
  });
}

/* ------------------------------------------------------------------ run */

function collectImageSources() {
  const sources = new Set<string>();

  for (const page of allPages) {
    const markdown = bodyFor(page);
    for (const match of markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      sources.add(match[1]!);
    }
  }
  return [...sources];
}

function writeAssets() {
  copyFile(path.join(themeRoot, 'site.css'), path.join(outDir, 'assets/site.css'));
  copyFile(path.join(themeRoot, 'site.js'), path.join(outDir, 'assets/site.js'));
  // The hero art is committed at its display size; it is written as-is so the
  // repository copy and the published bytes stay identical.
  for (const item of heroArt) {
    const file = path.join(outDir, item.url);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, item.bytes);
  }
  // Brand bytes: the lockup art and the tab icon, again copied verbatim.
  for (const asset of [brandMark, brandWord, favicon]) {
    if (!asset.bytes) continue;
    const file = path.join(outDir, asset.url);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, asset.bytes);
  }
  writeText(path.join(outDir, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  writeText(path.join(outDir, '.nojekyll'), '');
}

function checkLinks() {
  const pages = fs.readdirSync(outDir).filter(file => file.endsWith('.html'));
  const ids = new Map<string, Set<string>>();
  for (const file of pages) {
    const html = readText(path.join(outDir, file));
    ids.set(file, new Set([...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]!)));
  }
  for (const file of pages) {
    const html = readText(path.join(outDir, file));
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1]!;
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [target, fragment] = href.split('#');
      const targetFile = target || file;
      if (target && !ids.has(target) && !fs.existsSync(path.join(outDir, target))) {
        problems.push('Broken internal link in ' + file + ' → ' + href);
        continue;
      }
      if (fragment && ids.has(targetFile) && !ids.get(targetFile)!.has(fragment)) {
        problems.push('Missing anchor in ' + targetFile + ' ← ' + file + ' → ' + href);
      }
    }
    for (const match of html.matchAll(/src="([^"]+)"/g)) {
      const src = match[1]!;
      if (/^https?:/.test(src)) continue;
      if (!fs.existsSync(path.join(outDir, src))) {
        problems.push('Broken asset reference in ' + file + ' → ' + src);
      }
    }
  }
}

function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const media = collectImageSources();
  prepareMedia(media);
  writeAssets();

  writeText(path.join(outDir, 'index.html'), landingPage());
  allPages.forEach((page, index) => {
    writeText(path.join(outDir, page.id + '.html'), renderPage(page, index));
  });

  const index = [
    {
      p: 'index.html',
      a: '',
      t: site.title,
      h: site.productName,
      x: [site.description, site.hero.lead].join(' ').slice(0, 420)
    },
    ...searchIndex
  ];
  writeText(path.join(outDir, 'assets/search.json'), JSON.stringify(index));

  checkLinks();

  if (warnings.length) {
    console.log('Warnings:');
    for (const warning of warnings) console.log('  - ' + warning);
  }
  if (problems.length) {
    console.error('Build problems:');
    for (const problem of problems) console.error('  - ' + problem);
  }

  const files: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(outDir);
  const bytes = files.reduce((total, file) => total + fs.statSync(file).size, 0);
  console.log(
    'Docs site written to ' + outDir + '\n' +
    '  pages: ' + (allPages.length + 1) + ', files: ' + files.length + ', size: ' + (bytes / 1048576).toFixed(2) + ' MiB' +
    (ffmpeg ? ' (ffmpeg)' : ' (images copied as PNG)')
  );

  if (problems.length) process.exitCode = 1;
}

main();


