// Generated from runtime/alpha3/compat/session-controller/src/card-png-intake.ts; edit the TypeScript source.
import { createHash } from 'node:crypto';
// Intake only distinguishes card metadata from ordinary imagery. The existing
// card importer remains the sole owner of parsing, projection and activation.
const LIMITS = { bytes: 20_000_000, jsonBytes: 5_000_000, chunks: 4096, pixels: 16_777_216 };
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export class CardPngIntakeError extends Error {
    code = 'CARD_PNG_INVALID';
}
function fail(reason) { throw new CardPngIntakeError(`角色卡 PNG：${reason}`); }
function crc(bytes) {
    let value = 0xffffffff;
    for (const byte of bytes) {
        value ^= byte;
        for (let bit = 0; bit < 8; bit++)
            value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    }
    return (value ^ 0xffffffff) >>> 0;
}
function canonicalBase64(value, limit) {
    if (!value || value.length % 4 !== 0 || value.length > Math.ceil(limit / 3) * 4)
        fail('编码无效或大小超限');
    const bytes = Buffer.from(value, 'base64');
    if (bytes.length > limit || bytes.toString('base64') !== value)
        fail('编码无效或大小超限');
    return bytes;
}
function validateMetadata(bytes, key) {
    let value;
    try {
        value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    }
    catch {
        fail('卡片元数据不是有效 UTF-8 JSON');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
        fail('卡片元数据必须是对象');
    const document = value;
    const version = document.spec === undefined ? 1 : document.spec === 'chara_card_v2' ? 2
        : document.spec === 'chara_card_v3' ? 3 : 0;
    if (!version || version > 1 && !String(document.spec_version ?? '').startsWith(`${version}.`)
        || key === 'ccv3' && version !== 3)
        fail('不支持或不匹配的卡片版本');
    const data = version === 1 ? document : document.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)
        || typeof data.name !== 'string'
        || !data.name.trim())
        fail('卡片元数据缺少名称');
}
/** Read the complete original PNG without resizing, re-encoding or evaluating its content. */
export function classifyCardPng(data) {
    const bytes = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    if (bytes.length < 8 || bytes.length > LIMITS.bytes || !bytes.subarray(0, 8).equals(SIGNATURE))
        fail('签名无效或大小超限');
    const cards = new Map();
    const frames = [];
    let invalid;
    const reject = (reason) => { invalid ??= reason; };
    let offset = 8, chunks = 0, image = false, ended = false;
    while (offset < bytes.length) {
        if (++chunks > LIMITS.chunks)
            fail('无法在限制内检查 PNG 元数据');
        if (offset + 12 > bytes.length) {
            if (!ended)
                fail('数据块边界无效，无法完整检查 PNG 元数据');
            reject('结束块或尾随字节无效');
            break;
        }
        const size = bytes.readUInt32BE(offset), end = offset + 12 + size;
        if (end > bytes.length) {
            if (!ended)
                fail('数据块长度越界，无法完整检查 PNG 元数据');
            reject('结束块或尾随字节无效');
            break;
        }
        const type = bytes.toString('latin1', offset + 4, offset + 8);
        const payload = bytes.subarray(offset + 8, end - 4);
        frames.push({ start: offset, end });
        if (!/^[A-Za-z]{4}$/.test(type))
            reject('数据块类型无效');
        if (chunks === 1) {
            if (type !== 'IHDR' || size !== 13)
                reject('缺少有效图像头');
            else {
                const width = payload.readUInt32BE(0), height = payload.readUInt32BE(4);
                if (!width || !height || width * height > LIMITS.pixels)
                    reject('图像尺寸超限');
            }
        }
        else if (type === 'IHDR')
            reject('重复图像头');
        if (type === 'IDAT')
            image = true;
        if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
            const zero = payload.indexOf(0), key = zero > 0 ? payload.toString('latin1', 0, zero) : '';
            if (key === 'chara' || key === 'ccv3') {
                // The maintained importer accepts standard tEXt only. Never silently
                // treat an unsupported card encoding as ordinary vision input.
                if (type !== 'tEXt')
                    reject('卡片元数据编码暂不支持，请提供标准 PNG 或原 JSON');
                if (cards.has(key))
                    reject('重复卡片元数据');
                cards.set(key, payload.subarray(zero + 1));
            }
        }
        offset = end;
        if (type === 'IEND') {
            if (size || offset !== bytes.length)
                reject('结束块或尾随字节无效');
            ended = true;
        }
    }
    // Fully inspect framed metadata before delegating ordinary imagery. A bad
    // earlier CRC must never hide a later card key and fall back to vision.
    if (!cards.size)
        return 'ordinary-image';
    if (!image || !ended)
        reject('缺少图像数据或结束块');
    if (invalid)
        fail(invalid);
    for (const { start, end } of frames) {
        if (crc(bytes.subarray(start + 4, end - 4)) !== bytes.readUInt32BE(end - 4))
            fail('数据块校验失败');
    }
    for (const [key, payload] of cards)
        cards.set(key, canonicalBase64(payload.toString('latin1'), LIMITS.jsonBytes));
    const key = cards.has('ccv3') ? 'ccv3' : 'chara';
    validateMetadata(cards.get(key), key);
    return 'card-png';
}
/** Keep one submitted attachment at one position, including mixed image/file messages. */
export function prepareCardPngIntake(content) {
    const originals = new Map();
    let hasImage = false;
    content.forEach((part, index) => {
        if (part.type !== 'image')
            return;
        if (part.mediaType !== 'image/png') {
            hasImage = true;
            return;
        }
        const data = canonicalBase64(part.data, LIMITS.bytes);
        if (classifyCardPng(data) === 'ordinary-image') {
            hasImage = true;
            return;
        }
        // Display names are sanitized by the public file store. The extension is
        // required by the importer, never inferred from a provider filesystem path.
        const name = part.name?.toLowerCase().endsWith('.png') ? part.name : '角色卡.png';
        originals.set(index, { data, name, sha256: createHash('sha256').update(data).digest('hex') });
    });
    return { hasImage, async admit(store) {
            for (const original of originals.values())
                await store.validateImage({ ...original, mediaType: 'image/png' });
            const next = [...content];
            for (const [index, original] of originals) {
                const file = await store.saveFile({ data: original.data, name: original.name });
                if (String(file.attachmentId) !== `sha256:${original.sha256}` || file.bytes !== original.data.length
                    || !file.name.toLowerCase().endsWith('.png'))
                    fail('原件存储回执与完整字节不一致');
                next[index] = { type: 'file', attachment: file };
            }
            return next;
        } };
}
