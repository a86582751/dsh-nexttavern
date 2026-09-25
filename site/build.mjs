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
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { site, sourceRoot } from './site.config.mjs';

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
const option = name => {
  const at = args.indexOf('--' + name);
  return at === -1 ? null : args[at + 1] ?? true;
};
const flag = name => args.includes('--' + name);
const checkOnly = flag('check');
const optimize = !flag('no-optimize');
const outArg = option('out');
const outDir = checkOnly
  ? fs.mkdtempSync(path.join(os.tmpdir(), 'nexttavern-docs-'))
  : path.resolve(repoRoot, outArg && outArg !== true
    ? String(outArg)
    : maintainer ? 'artifacts/public-site-preview' : 'artifacts/site');

const warnings = [];
const problems = [];
const mediaRecords = new Map();
const droppedAnchors = new Map();

/* ------------------------------------------------------------------ utils */

const readText = file => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const writeText = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
};
const copyFile = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};
const escapeHtml = text => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Local build date; the footer should not flip a day early for UTC+8. */
function buildDate() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join('-');
}

/**
 * Heading anchors follow GitHub's rules closely enough for the cross-links
 * already used inside the public documents: lowercase, keep letters/numbers
 * (including CJK), drop other punctuation, spaces become dashes.
 */
function slugify(text) {
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

function toPlainText(markdown) {
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

function renderInline(text, context) {
  const tokens = [];
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

  working = working.replace(/\u0000(\d+)\u0000/g, (match, index) => tokens[Number(index)]);
  return working;
}

function parseTableRow(line) {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map(cell => cell.trim());
}

function renderBlocks(lines, context, depth) {
  const html = [];
  let index = 0;
  const level = depth ?? 0;

  while (index < lines.length) {
    const line = lines[index];

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
      while (index < lines.length && !new RegExp('^' + close + '\\s*$').test(lines[index])) {
        body.push(lines[index]);
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
      const text = heading[2].trim();
      const id = context.registerHeading(text, heading[1].length);
      const tag = 'h' + heading[1].length;
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

    if (/^\s*\|/.test(line) && index + 1 < lines.length && TABLE_DIVIDER.test(lines[index + 1])) {
      const head = parseTableRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && /^\s*\|/.test(lines[index]) && lines[index].trim()) {
        rows.push(parseTableRow(lines[index]));
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
      const first = line.match(LIST_ITEM);
      const baseIndent = first[1].length;
      const ordered = /^\d/.test(first[2]);
      const items = [];
      let current = null;
      while (index < lines.length) {
        const candidate = lines[index];
        if (!candidate.trim()) {
          const following = lines[index + 1];
          if (following && (LIST_ITEM.test(following) || /^\s{2,}\S/.test(following))) {
            if (current) current.body.push('');
            index += 1;
            continue;
          }
          break;
        }
        const item = candidate.match(LIST_ITEM);
        if (item && item[1].length <= baseIndent) {
          current = { body: [item[3]] };
          items.push(current);
          index += 1;
          continue;
        }
        const indent = candidate.match(/^(\s*)/)[1].length;
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
      while (index < lines.length && (QUOTE.test(lines[index]) || !lines[index].trim())) {
        if (!lines[index].trim() && !QUOTE.test(lines[index + 1] || '')) break;
        body.push(lines[index].replace(/^\s*> ?/, ''));
        index += 1;
      }
      html.push('<blockquote>' + renderBlocks(body, context, level + 1) + '</blockquote>');
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !FENCE.test(lines[index]) &&
      !HEADING.test(lines[index]) &&
      !HR.test(lines[index]) &&
      !LIST_ITEM.test(lines[index]) &&
      !QUOTE.test(lines[index]) &&
      !(RAW_HTML_ANY.test(lines[index]) && !lines[index].includes('|')) &&
      !/^\s*\|/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    html.push('<p>' + paragraph.map(part => renderInline(part, context)).join(' ') + '</p>');
  }

  return html.join('\n');
}

/* ----------------------------------------------------------- page sources */

function pageSources(page) {
  if (page.sources) return page.sources;
  return [{ file: page.file, sections: page.sections }];
}

const fileCache = new Map();

function readSource(file) {
  if (!fileCache.has(file)) {
    const full = path.join(publicRoot, file);
    if (!fs.existsSync(full)) throw new Error('Missing public document: ' + file);
    fileCache.set(file, readText(full));
  }
  return fileCache.get(file);
}

/** Drops a leading H1 and a leading banner image from a document. */
function stripDocumentHeader(markdown) {
  const lines = markdown.split('\n');
  let index = 0;
  while (index < lines.length && !lines[index].trim()) index += 1;
  if (index < lines.length && /^!\[[^\]]*\]\([^)]*\)\s*$/.test(lines[index])) index += 1;
  while (index < lines.length && !lines[index].trim()) index += 1;
  if (index < lines.length && /^#\s+/.test(lines[index])) index += 1;
  return lines.slice(index).join('\n').trim();
}

/**
 * Extracts whole H2 sections by exact heading text. Missing headings fail the
 * build so navigation cannot quietly point at content that no longer exists.
 */
function extractSections(markdown, headings) {
  const lines = markdown.split('\n');
  const chunks = [];
  for (const wanted of headings) {
    const start = lines.findIndex(line => {
      const match = line.match(HEADING);
      return match && match[1].length === 2 && match[2].trim() === wanted;
    });
    if (start === -1) throw new Error('Section not found in public document: ' + wanted);
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      const match = lines[index].match(HEADING);
      if (match && match[1].length <= 2) {
        end = index;
        break;
      }
    }
    chunks.push(lines.slice(start, end).join('\n').trim());
  }
  return chunks.join('\n\n');
}

function bodyFor(page) {
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
      const heading = at === -1 ? null : lines[at].match(HEADING);
      const mirrorsTitle = heading && slugify(heading[2]) === slugify(page.title);
      if (heading && heading[1].length === 2 && (mirrorsTitle || page.dropHeading === true)) {
        // Keep the anchor addressable even though the visible heading is gone.
        droppedAnchors.set(page.id, [...(droppedAnchors.get(page.id) ?? []), slugify(heading[2])]);
        lines[at] = '<span id="' + slugify(heading[2]) + '"></span>';
        chunk = lines.slice(at).join('\n').trim();
      }
    }
    parts.push(chunk);
  }
  return parts.join('\n\n');
}

/* --------------------------------------------------------------- media */

const MEDIA_EXT = /\.(png|jpe?g|webp|gif|avif)$/i;

function toolPath(name) {
  try {
    const probe = process.platform === 'win32' ? 'where' : 'which';
    const found = execFileSync(probe, [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)[0];
    return found || null;
  } catch (error) {
    return null;
  }
}

// ffmpeg keeps the screenshots small and is fast enough to run on every build;
// without it the originals are copied so the site still builds offline.
const ffmpeg = optimize ? toolPath('ffmpeg') : null;
const ffprobe = ffmpeg ? toolPath('ffprobe') : null;

function optimizeImage(source, target, maxWidth) {
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

function imageSize(file) {
  if (!ffprobe) return null;
  try {
    const output = execFileSync(ffprobe, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file
    ], { encoding: 'utf8' });
    const [width, height] = output.trim().split(',').map(Number);
    return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : null;
  } catch (error) {
    return null;
  }
}

/**
 * Copies every referenced image into `assets/media/` once, downscaled, and
 * remembers the final URL plus intrinsic size so pages avoid layout shifts.
 */
function prepareMedia(sourcePaths) {
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

const FILE_TARGETS = {
  'README.md': 'index.html',
  'INSTALL-WINDOWS.md': 'install-windows.html',
  'INSTALL-LINUX.md': 'install-linux.html',
  'PUBLIC-ACCESS.md': 'public-access.html',
  'ARCHITECTURE.md': 'architecture.html',
  'SCREENSHOTS.md': 'screenshots.html',
  'CHANGELOG.md': 'changelog.html',
  'CONTRIBUTING.md': 'development.html'
};

const pageHeadingSlugs = new Map();

function headingSlugsFor(page) {
  if (pageHeadingSlugs.has(page.id)) return pageHeadingSlugs.get(page.id);
  const body = bodyFor(page);
  const slugs = new Set(droppedAnchors.get(page.id) ?? []);
  const lines = body.split('\n');
  let inFence = false;
  for (const line of lines) {
    if (FENCE.test(line)) inFence = !inFence;
    if (inFence) continue;
    const match = line.match(HEADING);
    if (!match) continue;
    slugs.add(slugify(match[2]));
  }
  pageHeadingSlugs.set(page.id, slugs);
  return slugs;
}

const anchorOwners = new Map();
for (const page of allPages) {
  for (const slug of headingSlugsFor(page)) {
    if (!anchorOwners.has(slug)) anchorOwners.set(slug, page.id + '#' + slug);
  }
}

/* ------------------------------------------------------------ rendering */

function contextFor(page, headings) {
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
      const [file, hash] = href.split('#');
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
function anchorUrl(pageId, slug) {
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

const NAV_ICONS = {
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

function icon(name) {
  return NAV_ICONS[name] ?? NAV_ICONS.install;
}

const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>';

function header(activeId) {
  return [
    '<header class="topbar">',
    '  <button class="icon-button menu-toggle" type="button" data-nav-toggle aria-label="打开目录" aria-expanded="false">',
    '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    '  </button>',
    '  <a class="brand" href="index.html"><span class="brand-mark">' + escapeHtml(site.brandMark) + '</span>' +
    '<span>' + escapeHtml(site.productName) + ' <small>文档</small></span></a>',
    '  <span class="chip hide-md"><span class="dot"></span>最新发布 <b>v' + escapeHtml(site.releaseVersion) + '</b></span>',
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

function sidebar(activeId) {
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
    '    <p>当前展示 <b>' + escapeHtml(site.releaseVersion) + '</b> 正式发布；<br>' + escapeHtml(site.developmentLine) + '，代码持续同步到 main。</p>',
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
    '      <a class="brand" href="index.html"><span class="brand-mark">' + escapeHtml(site.brandMark) + '</span>' +
    '<span>' + escapeHtml(site.productName) + '</span></a>',
    '      <p>' + escapeHtml(site.footer.blurb) + '</p>',
    '      <p class="footer-note">文档站内容与仓库文档同源生成；截图由维护者提供，不代表默认安装外观。</p>',
    '    </div>',
    columns,
    '  </div>',
    '  <div class="footer-base">',
    '    <span>© ' + new Date().getUTCFullYear() + ' ' + escapeHtml(site.productName) + ' · 文档以 <a href="' + site.licenseUrl + '">' + escapeHtml(site.licenseName) + '</a> 分发</span>',
    '    <span>构建于 ' + buildDate() + ' · <a href="' + site.repoUrl + '/tree/main/docs">本站源码</a></span>',
    '  </div>',
    '</footer>'
  ].join('\n');
}

function shell({ id, title, description, body, classes }) {
  const fullTitle = id === 'index' ? title : title + ' · ' + site.title;
  const canonical = id === 'index' ? 'index.html' : id + '.html';
  return [
    '<!doctype html>',
    '<html lang="' + (site.lang || 'zh-CN') + '" data-theme="dark">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>' + escapeHtml(fullTitle) + '</title>',
    '<meta name="description" content="' + escapeHtml(description) + '">',
    '<meta name="keywords" content="' + escapeHtml((site.keywords ?? []).join(',')) + '">',
    '<meta name="theme-color" content="#080b12">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="' + escapeHtml(fullTitle) + '">',
    '<meta property="og:description" content="' + escapeHtml(description) + '">',
    '<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">',
    '<link rel="stylesheet" href="assets/site.css">',
    '<script>(function(){try{var t=localStorage.getItem("nexttavern-docs-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();</script>',
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

const searchIndex = [];

function renderPage(page, position) {
  const headings = [];
  const context = contextFor(page, headings);
  const markdown = bodyFor(page);
  const html = renderBlocks(markdown.split('\n'), context);

  const sections = [];
  let currentSection = { heading: page.title, anchor: '', text: [] };
  for (const line of markdown.split('\n')) {
    const heading = line.match(HEADING);
    if (heading) {
      if (currentSection.text.length || currentSection.anchor) sections.push(currentSection);
      currentSection = {
        heading: toPlainText(heading[2]),
        anchor: headings.find(entry => entry.text === toPlainText(heading[2]))?.id ?? '',
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
  const cover = mediaRecords.get(hero.image.src) ?? { url: hero.image.src };
  const tabs = site.quickInstall.tabs.map((tab, index) => {
    const selected = index === 0;
    return [
      '<button type="button" role="tab" aria-selected="' + selected + '" aria-controls="install-' + tab.id + '">',
      icon(tab.id === 'windows' ? 'windows' : tab.id === 'linux' ? 'linux' : 'terminal'),
      escapeHtml(tab.label),
      '</button>'
    ].join('');
  }).join('\n');
  const panels = site.quickInstall.tabs.map((tab, index) => {
    const code = tab.code.split('\n').map(line => escapeHtml(line)).join('\n');
    return [
      '<div class="install-body" id="install-' + tab.id + '" role="tabpanel"' + (index === 0 ? '' : ' hidden') + '>',
      '  <p>' + escapeHtml(tab.note) + '</p>',
      '  <div class="code-block"><div class="code-head"><span>' + escapeHtml(tab.label) + '</span>' +
      '<button class="copy-button" type="button" data-copy>复制</button></div>' +
      '<pre><code>' + code + '</code></pre></div>',
      '  <a class="link" href="' + tab.primary.href + '">' + escapeHtml(tab.primary.label) + ' →</a>',
      '</div>'
    ].join('\n');
  }).join('\n');

  const features = site.features.map(feature => [
    '<article class="feature-card">',
    '  <span class="feature-icon">' + icon(feature.icon) + '</span>',
    '  <h3><a href="' + feature.href + '">' + escapeHtml(feature.title) + '</a></h3>',
    '  <p>' + feature.text.replace(/`([^`]+)`/g, '<code>$1</code>') + '</p>',
    '</article>'
  ].join('\n')).join('\n');

  const shots = site.showcase.items.map(item => {
    const media = mediaRecords.get(item.src);
    if (!media) {
      problems.push('Showcase image missing: ' + item.src);
      return '';
    }
    return [
      '<figure class="shot" data-shot>',
      '  <img loading="lazy" decoding="async" src="' + media.url + '" alt="' + escapeHtml(item.title) + '"' +
      (media.width ? ' width="' + media.width + '" height="' + media.height + '"' : '') +
      ' data-full="' + media.url + '" data-caption="' + escapeHtml(item.title + ' · ' + item.caption) + '">',
      '  <figcaption><b>' + escapeHtml(item.title) + '</b><span>' + escapeHtml(item.caption) + '</span></figcaption>',
      '</figure>'
    ].join('\n');
  }).join('\n');

  const docMap = site.groups.map((group, index) => [
    '<section>',
    '  <h3><span class="index">' + String(index + 1).padStart(2, '0') + '</span>' + escapeHtml(group.label) + '</h3>',
    '  <ul>' + group.pages.slice(0, 5).map(page =>
      '<li><a href="' + page.id + '.html">' + escapeHtml(page.nav ?? page.title) + '</a></li>').join('') + '</ul>',
    '</section>'
  ].join('\n')).join('\n');

  const body = () => [
    '<section class="hero" id="content">',
    '  <div class="hero-inner">',
    '    <div>',
    '      <span class="eyebrow">' + escapeHtml(hero.eyebrow) + '</span>',
    '      <h1>' + hero.title.split('\n').map((line, index) =>
      index === 0 ? escapeHtml(line) : '<em>' + escapeHtml(line) + '</em>').join('<br>') + '</h1>',
    '      <p class="lead">' + escapeHtml(hero.lead) + '</p>',
    '      <div class="cta-row">',
    '        <a class="button primary" href="' + hero.primary.href + '">' + escapeHtml(hero.primary.label) + ' →</a>',
    '        <a class="button ghost" href="' + hero.secondary.href + '">' + escapeHtml(hero.secondary.label) + '</a>',
    '      </div>',
    '      <div class="hero-facts">' + hero.facts.map(fact =>
      '<div><span>' + escapeHtml(fact.label) + '</span><b>' + escapeHtml(fact.value) + '</b></div>').join('') + '</div>',
    '    </div>',
    '    <figure class="hero-shot">',
    '      <img src="' + cover.url + '" alt="' + escapeHtml(hero.image.alt) + '"' +
    (cover.width ? ' width="' + cover.width + '" height="' + cover.height + '"' : '') + ' fetchpriority="high">',
    '      <figcaption>' + escapeHtml(hero.image.alt) + '</figcaption>',
    '    </figure>',
    '  </div>',
    '</section>',
    '<div class="section">',
    '  <div class="notice">' + icon('branch'),
    '    <p><b>' + escapeHtml(site.developmentLine) + '。</b>代码持续同步到 main；' + escapeHtml(site.releaseVersion) +
    ' 仍是当前正式发布，安装链接与下载都指向它。升级前请在旧环境导出角色卡或小说。</p>',
    '  </div>',
    '</div>',
    '<section class="section">',
    '  <div class="section-head"><div><h2>' + escapeHtml(site.quickInstall.title) + '</h2><p>' +
    escapeHtml(site.quickInstall.lead) + '</p></div><a href="manual-install.html">手动安装 →</a></div>',
    '  <div class="install-panel">',
    '    <div class="install-tabs" data-install-tabs role="tablist" aria-label="安装方式">' + tabs + '</div>',
    panels,
    '  </div>',
    '</section>',
    '<section class="section">',
    '  <div class="section-head"><div><h2>能力一览</h2><p>从角色卡导入到长篇记忆、世界线与导出，覆盖一次完整的长篇角色扮演。</p></div>' +
    '<a href="capabilities.html">全部能力 →</a></div>',
    '  <div class="feature-grid">' + features + '</div>',
    '</section>',
    '<section class="section">',
    '  <div class="section-head"><div><h2>' + escapeHtml(site.showcase.title) + '</h2><p>' +
    escapeHtml(site.showcase.lead) + '</p></div><a href="' + site.showcase.link.href + '">' +
    escapeHtml(site.showcase.link.label) + ' →</a></div>',
    '  <div class="shot-grid">' + shots + '</div>',
    '</section>',
    '<section class="section">',
    '  <div class="section-head"><div><h2>文档地图</h2><p>按目标找入口：安装、功能、进阶与参考各自独立成章。</p></div></div>',
    '  <div class="doc-map">' + docMap + '</div>',
    '</section>'
  ].join('\n');

  return shell({
    id: 'index',
    title: site.title + ' · ' + site.productName,
    description: site.description,
    body
  });
}

/* ------------------------------------------------------------------ run */

function collectImageSources() {
  const sources = new Set([site.hero.image.src]);
  site.showcase.items.forEach(item => sources.add(item.src));
  for (const page of allPages) {
    const markdown = bodyFor(page);
    for (const match of markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      sources.add(match[1]);
    }
  }
  return [...sources];
}

function writeAssets() {
  copyFile(path.join(themeRoot, 'site.css'), path.join(outDir, 'assets/site.css'));
  copyFile(path.join(themeRoot, 'site.js'), path.join(outDir, 'assets/site.js'));
  const favicon = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="#ffc775"/><stop offset=".55" stop-color="#f0a137"/><stop offset="1" stop-color="#c9752a"/>',
    '</linearGradient></defs>',
    '<rect width="64" height="64" rx="16" fill="url(#g)"/>',
    '<text x="32" y="42" font-family="Segoe UI, sans-serif" font-size="26" font-weight="700" fill="#201405" text-anchor="middle">NT</text>',
    '</svg>'
  ].join('');
  writeText(path.join(outDir, 'assets/favicon.svg'), favicon);
  writeText(path.join(outDir, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  writeText(path.join(outDir, '.nojekyll'), '');
}

function checkLinks() {
  const pages = fs.readdirSync(outDir).filter(file => file.endsWith('.html'));
  const ids = new Map();
  for (const file of pages) {
    const html = readText(path.join(outDir, file));
    ids.set(file, new Set([...html.matchAll(/id="([^"]+)"/g)].map(match => match[1])));
  }
  for (const file of pages) {
    const html = readText(path.join(outDir, file));
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      if (/^(https?:|mailto:)/.test(href)) continue;
      const [target, fragment] = href.split('#');
      const targetFile = target || file;
      if (target && !ids.has(target) && !fs.existsSync(path.join(outDir, target))) {
        problems.push('Broken internal link in ' + file + ' → ' + href);
        continue;
      }
      if (fragment && ids.has(targetFile) && !ids.get(targetFile).has(fragment)) {
        problems.push('Missing anchor in ' + targetFile + ' ← ' + file + ' → ' + href);
      }
    }
    for (const match of html.matchAll(/src="([^"]+)"/g)) {
      const src = match[1];
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

  const files = [];
  const walk = directory => {
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

  if (checkOnly) fs.rmSync(outDir, { recursive: true, force: true });
  if (problems.length) process.exitCode = 1;
}

main();
