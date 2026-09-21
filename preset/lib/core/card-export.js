// Generated from runtime/alpha3/src/core/card-export.ts; edit the TypeScript source.
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, lstatSync, realpathSync, openSync, writeFileSync, closeSync, readFileSync, constants, fsyncSync, linkSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fenceCardContent } from './tavern-card.js';
import { exportSnapshot, renderOrganizedExport, stableJson, safeHeading, sourceLines, } from './card-export-projection.js';
export { exportSnapshot, renderOrganizedExport, stableJson };
const hash = (value) => createHash('sha256').update(value).digest('hex');
const recordOf = (value) => value !== null && typeof value === 'object' ? value : {};
function writeExport(cwd, id, markdown) {
    if (!/^[a-f0-9-]{36}$/.test(id))
        throw new Error('导出标识无效');
    const root = realpathSync(resolve(cwd)), directory = join(root, '.dsh-card-exports');
    try {
        mkdirSync(directory);
    }
    catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
            throw error;
    }
    if (lstatSync(directory).isSymbolicLink() || realpathSync(directory) !== directory)
        throw new Error('导出目录不能是符号链接');
    const file = join(directory, `${id}.md`);
    let fd;
    let directoryFd;
    let temporary;
    try {
        if (process.platform === 'linux')
            directoryFd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
        const accessDirectory = directoryFd === undefined ? directory : `/proc/self/fd/${directoryFd}`;
        if (realpathSync(accessDirectory) !== directory)
            throw new Error('导出目录在写入前改变');
        const target = join(accessDirectory, `${id}.md`);
        temporary = join(accessDirectory, `${id}.${randomUUID()}.tmp`);
        fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
        writeFileSync(fd, markdown, 'utf8');
        fsyncSync(fd);
        closeSync(fd);
        fd = undefined;
        try {
            linkSync(temporary, target);
        }
        catch (error) {
            if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
                throw error;
            if (lstatSync(target).isSymbolicLink() || hash(readFileSync(target)) !== hash(markdown))
                throw new Error('导出文件已存在且内容不同，拒绝覆盖');
        }
        if (realpathSync(directory) !== directory || realpathSync(accessDirectory) !== directory)
            throw new Error('导出目录在写入期间改变');
        if (directoryFd !== undefined)
            fsyncSync(directoryFd);
    }
    finally {
        if (fd !== undefined)
            closeSync(fd);
        if (temporary)
            try {
                unlinkSync(temporary);
            }
            catch { }
        ;
        if (directoryFd !== undefined)
            closeSync(directoryFd);
    }
    return file;
}
export function registerCardExport(ctx, options) {
    const { simpleTool, sessionOf, table, collect, lock, onCompleted, workflowOf, workflowGeneration, beforeBegin, assertWorkflow, classificationGuide = '' } = options;
    const key = (session, id) => `${session.id}__export-${id}`;
    const get = (session, id) => {
        if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
            throw new Error('export_id 无效');
        const value = table.get(key(session, id)), record = value;
        assertWorkflow?.(session, record);
        if (record?.schemaVersion !== 1 || record.branchId !== session.id)
            throw new Error('当前分支没有该导出');
        if (record.sourceHash !== hash(stableJson(record.material)))
            throw new Error('导出快照损坏');
        const expected = exportSnapshot(session.id, record.material);
        if (record.text !== expected.text || JSON.stringify(record.units) !== JSON.stringify(expected.units))
            throw new Error('导出正文或来源映射损坏');
        return record;
    };
    const tool = (name, description, properties, required, run) => {
        ctx.effect(() => ctx.tools.register(simpleTool(name, description, { type: 'object', properties, required, additionalProperties: false }, async (args, exec) => {
            const session = await sessionOf(exec);
            if (name === 'rp_card_export_begin' && beforeBegin) {
                const diverted = await beforeBegin(session, exec);
                if (diverted)
                    return diverted;
            }
            try {
                return await lock(session.id, 'export', () => run(session, args));
            }
            catch (error) {
                const failure = recordOf(error);
                return { ok: false, error: failure.code ? '导出文件写入失败，请检查工作区权限' : String(failure.message) };
            }
        })), `roleplay: tool ${name}`);
    };
    tool('rp_card_export_begin', '开始逆向组卡：冻结当前分支已编辑的全部设定。必须由 LLM 分页全文审阅，再组织统一 Markdown 章节；不能摘要、漏项或用旧原件覆盖新设定。', {}, [], async (session) => {
        const workflowId = workflowOf?.(session);
        let prior;
        if (workflowId)
            for (const [, value] of table.entries()) {
                const candidate = value;
                if (candidate?.workflowId === workflowId && candidate.exportId) {
                    prior = candidate;
                    break;
                }
            }
        if (prior)
            return { ok: true, exportId: prior.exportId, sourceHash: prior.sourceHash, totalChars: prior.text.length, nextCursor: prior.nextCursor, reviewComplete: prior.reviewComplete, sources: prior.units.map(({ id, label, text, sha256 }) => ({ id, label, chars: text.length, sha256 })), resumed: true };
        const material = await collect(session), snapshot = exportSnapshot(session.id, material), id = randomUUID();
        const value = { ...snapshot, exportId: id, workflowId, workflowGeneration: workflowGeneration?.(session), material, nextCursor: 0, reviewComplete: false, status: 'reviewing', createdAt: Date.now() };
        await table.put(key(session, id), value);
        return { ok: true, exportId: id, sourceHash: snapshot.sourceHash, totalChars: snapshot.text.length, nextCursor: 0, sources: snapshot.units.map(({ id: sourceId, label, text, sha256 }) => ({ id: sourceId, label, chars: text.length, sha256 })) };
    });
    tool('rp_card_export_chunk', '连续审阅导出快照；按 nextCursor 读到 null。全文读完后，可传 source_id/start_line/max_lines 回看单个来源的带行号原文，用于按创作语义拆分混合内容。', { export_id: { type: 'string' }, cursor: { type: 'integer' }, source_id: { type: 'string' }, start_line: { type: 'integer', minimum: 1 }, max_lines: { type: 'integer', minimum: 1, maximum: 200 } }, ['export_id'], async (session, args) => {
        const value = get(session, args.export_id), cursor = args.cursor;
        if (args.source_id !== undefined) {
            if (!value.reviewComplete)
                throw new Error('拆分来源前必须连续审阅完整快照');
            const unit = value.units.find(item => item.id === args.source_id);
            if (!unit)
                throw new Error('来源不存在');
            const lines = sourceLines(unit.text), start = args.start_line ?? 1, max = Math.min(200, Math.max(1, Number(args.max_lines ?? 100)));
            if (!Number.isSafeInteger(start) || start < 1 || start > lines.length || !Number.isSafeInteger(max))
                throw new Error('来源行号无效');
            let end = start - 1, size = 0;
            while (end < lines.length && end < start + max - 1 && size + lines[end].length < 16000) {
                size += lines[end].length;
                end++;
            }
            if (end < start)
                throw new Error('此来源单行超过带行号预览上限；请使用已审阅快照，将完整 source_id 归入合适章节');
            return { ok: true, sourceId: unit.id, sha256: unit.sha256, lineCount: lines.length, startLine: start, endLine: end, nextLine: end < lines.length ? end + 1 : null, text: fenceCardContent(lines.slice(start - 1, end).map((line, index) => `${start + index}: ${line}`).join(''), 'source') };
        }
        if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor >= value.text.length)
            throw new Error('导出 cursor 无效');
        if (!value.reviewComplete && cursor !== value.nextCursor && cursor !== value.lastCursor)
            throw new Error('导出审阅不能跳页');
        const end = Math.min(value.text.length, cursor + 16000), text = value.text.slice(cursor, end), next = { ...value, lastCursor: cursor, nextCursor: end === value.text.length ? null : end, reviewComplete: end === value.text.length || value.reviewComplete };
        if (cursor === value.nextCursor)
            await table.put(key(session, args.export_id), next);
        return { ok: true, text: fenceCardContent(text, 'source'), nextCursor: cursor === value.nextCursor ? next.nextCursor : value.nextCursor, sourceHash: value.sourceHash, reviewComplete: next.reviewComplete };
    });
    tool('rp_card_export_finalize', '提交 LLM 完整审阅后的章节结构。按内容语义重组，用户新增镜头语言归入叙事规则，不照搬存储栏目。完整来源用 source_ids；混合来源先 chunk(source_id) 读行号，再用 source_parts 按行拆到不同章节。每项每行必须恰好覆盖一次；后端原样物化，不接受摘要替换。\n' + classificationGuide, {
        export_id: { type: 'string' }, expected_sha256: { type: 'string' }, title: { type: 'string' },
        sections: { type: 'array', items: { type: 'object', properties: {
                    heading: { type: 'string' }, source_ids: { type: 'array', items: { type: 'string' } },
                    source_parts: { type: 'array', items: { type: 'object', properties: { source_id: { type: 'string' }, start_line: { type: 'integer' }, end_line: { type: 'integer' } }, required: ['source_id', 'start_line', 'end_line'], additionalProperties: false } },
                }, required: ['heading'], additionalProperties: false } },
    }, ['export_id', 'expected_sha256', 'title', 'sections'], async (session, args) => {
        const value = get(session, args.export_id);
        if (!value.reviewComplete || value.nextCursor !== null)
            throw new Error('导出前必须完整审阅');
        if (args.expected_sha256 !== value.sourceHash)
            throw new Error('导出来源哈希不匹配');
        if (!['committing', 'completed'].includes(value.status) && hash(stableJson(await collect(session))) !== value.sourceHash)
            throw new Error('设定在导出期间已修改，请重新开始以保留最新编辑');
        const markdown = renderOrganizedExport(value, args.title, args.sections), resultHash = hash(markdown);
        if (value.resultHash && value.resultHash !== resultHash)
            throw new Error('已完成导出不能被不同章节方案覆盖，请重新开始');
        if (value.status !== 'completed')
            await table.put(key(session, value.exportId), { ...value, status: 'committing', resultHash, sections: args.sections, title: args.title, preparedAt: value.preparedAt ?? Date.now() });
        assertWorkflow?.(session, value);
        const file = writeExport(session.header.cwd, value.exportId, markdown);
        await table.put(key(session, value.exportId), { ...value, status: 'completed', resultHash, file, title: args.title, sections: args.sections, completedAt: value.completedAt ?? Date.now() });
        assertWorkflow?.(session, value);
        const resource = await onCompleted?.(session, { ...value, title: args.title, file, resultHash }, markdown), filename = resource?.name ?? `${safeHeading(args.title).replace(/[\x00-\x1f<>:"/\\|?*]/g, '-').slice(0, 90)}.md`;
        return { ok: true, exportId: value.exportId, file, filename, resourceId: resource?.id, ...(resource?.id ? { downloadUrl: `/api/roleplay/download?sessionId=${encodeURIComponent(session.id)}&resourceId=${encodeURIComponent(resource.id)}` } : {}), displayInstruction: '向玩家展示 filename 和下载链接；内部 file/UUID 仅用于归档，不作为文件名回复。文件已存入酒馆资源库，可按名称查找。', sha256: resultHash, sourceHash: value.sourceHash, coverage: 1, bytes: Buffer.byteLength(markdown), sourceCount: value.units.length };
    });
}
