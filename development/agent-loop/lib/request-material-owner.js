// Generated from runtime/alpha3/compat/agent-loop/src/request-material-owner.ts; edit the TypeScript source.
/** Typed extension of the one existing Native v2 input owner. Serializable
 * material is data; the active registration and actual v2 work remain the
 * only dispatch permission. */
import { types as utilTypes } from 'node:util';
import { deepFreeze } from '@deepseek-ai/dsh-util-values';
import { nativeInputSha256 } from './input-admission.js';
/** One actual owner is captured and bound. JSON packets cannot create this
 * registration; the Agent/factory verify their live constructor identity. */
export function nativeOpeningMaterialOwnerRegistrationV1(value) {
    const row = object(value, ['schemaVersion', 'sectionNames', 'prepare', 'transform', 'check', 'closing']);
    if (row['schemaVersion'] !== 1 || ['prepare', 'transform', 'check', 'closing'].some(key => typeof row[key] !== 'function'))
        return fail();
    const sectionNames = array(row['sectionNames'], NATIVE_REQUEST_OWNER_BOUNDS.sections).map(identity);
    if (!sectionNames.length || new Set(sectionNames).size !== sectionNames.length)
        return fail();
    return Object.freeze({ schemaVersion: 1, sectionNames: Object.freeze(sectionNames),
        prepare: row['prepare'].bind(value),
        transform: row['transform'].bind(value),
        check: row['check'].bind(value),
        closing: row['closing'].bind(value) });
}
export function nativeOpeningClosingAcknowledgementV1(value, receiptSha256) {
    if (value === null || typeof value !== 'object' || utilTypes.isProxy(value))
        return fail();
    const kind = Object.getOwnPropertyDescriptor(value, 'kind');
    if (!kind || !Object.hasOwn(kind, 'value'))
        return fail();
    if (kind.value === 'settled') {
        const row = object(value, ['kind', 'receiptSha256', 'ownerReceiptSha256']);
        if (row['receiptSha256'] !== receiptSha256)
            return fail();
        return Object.freeze({ kind: 'settled', receiptSha256, ownerReceiptSha256: sha(row['ownerReceiptSha256']) });
    }
    if (kind.value !== 'blocked' && kind.value !== 'unknown')
        return fail();
    const row = object(value, ['kind', 'receiptSha256', 'code']);
    if (row['receiptSha256'] !== receiptSha256 || typeof row['code'] !== 'string' || !/^[A-Z][A-Z0-9_]{0,95}$/.test(row['code']))
        return fail();
    return Object.freeze({ kind: kind.value, receiptSha256, code: row['code'] });
}
export const NATIVE_REQUEST_OWNER_BOUNDS = Object.freeze({ sections: 32, sectionChars: 1_048_576,
    sectionBytes: 4_194_304, insertions: 128, textChars: 65_536, renderedBytes: 1_048_576 });
function fail() { throw Error('REQUEST_MATERIAL_OWNER_DATA_INVALID'); }
const object = (value, fields) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || utilTypes.isProxy(value))
        return fail();
    const prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value);
    if (prototype !== Object.prototype && prototype !== null || keys.length !== fields.length
        || keys.some(key => typeof key !== 'string' || !fields.includes(key)))
        return fail();
    const row = {};
    for (const field of fields) {
        const descriptor = Object.getOwnPropertyDescriptor(value, field);
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
            return fail();
        row[field] = descriptor.value;
    }
    return row;
};
const array = (value, max) => {
    if (!Array.isArray(value) || utilTypes.isProxy(value) || value.length > max
        || Reflect.ownKeys(value).length !== value.length + 1)
        return fail();
    const result = [];
    for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)
            return fail();
        result.push(descriptor.value);
    }
    return result;
};
const identity = (value) => {
    if (typeof value !== 'string' || !value.length || value.length > 256 || value !== value.trim()
        || /[\u0000-\u001f\u007f-\u009f]/.test(value))
        return fail();
    return value;
};
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : fail();
const count = (value, max = 4096) => typeof value === 'number' && Number.isSafeInteger(value)
    && value >= 0 && value <= max && !Object.is(value, -0) ? value : fail();
const ref = (value) => {
    const row = object(value, ['key', 'sha256']);
    return { key: identity(row['key']), sha256: sha(row['sha256']) };
};
const text = (value, max) => typeof value === 'string' && value.length <= max ? value : fail();
/** Capture callbacks once at registration. A later property mutation cannot
 * substitute another material owner under an already captured v2 work. */
export function nativeRequestMaterialOwnerRegistrationV1(value) {
    const ownsPrepare = value !== null && typeof value === 'object' && !utilTypes.isProxy(value) && Object.hasOwn(value, 'prepare');
    const row = object(value, ['schemaVersion', 'sectionNames', 'transform', 'check', ...ownsPrepare ? ['prepare'] : []]);
    if (row['schemaVersion'] !== 1 || typeof row['transform'] !== 'function' || typeof row['check'] !== 'function')
        return fail();
    if (ownsPrepare && typeof row['prepare'] !== 'function')
        return fail();
    const sectionNames = array(row['sectionNames'], NATIVE_REQUEST_OWNER_BOUNDS.sections).map(identity);
    if (!sectionNames.length || new Set(sectionNames).size !== sectionNames.length)
        return fail();
    return Object.freeze({ schemaVersion: 1, sectionNames: Object.freeze(sectionNames),
        ...ownsPrepare ? { prepare: row['prepare'].bind(value) } : {},
        transform: row['transform'].bind(value),
        check: row['check'].bind(value) });
}
export function nativeRequestMaterialPrepareDecisionV1(value) {
    if (value === null || typeof value !== 'object' || utilTypes.isProxy(value))
        return fail();
    const descriptor = Object.getOwnPropertyDescriptor(value, 'kind');
    if (!descriptor || !Object.hasOwn(descriptor, 'value'))
        return fail();
    if (descriptor.value === 'prepared' || descriptor.value === 'unchanged') {
        object(value, ['kind']);
        return Object.freeze({ kind: descriptor.value });
    }
    if (descriptor.value !== 'blocked')
        return fail();
    const row = object(value, ['kind', 'code']), code = row['code'];
    if (typeof code !== 'string' || !/^[A-Z][A-Z0-9_]{0,95}$/.test(code))
        return fail();
    return Object.freeze({ kind: 'blocked', code });
}
export function nativeRequestMaterialOwnerCheckV1(value) {
    if (value === null || typeof value !== 'object' || utilTypes.isProxy(value))
        return fail();
    const descriptor = Object.getOwnPropertyDescriptor(value, 'kind');
    if (!descriptor || !Object.hasOwn(descriptor, 'value'))
        return fail();
    if (descriptor.value === 'allow') {
        object(value, ['kind']);
        return Object.freeze({ kind: 'allow' });
    }
    if (descriptor.value !== 'blocked')
        return fail();
    const row = object(value, ['kind', 'code']), code = row['code'];
    if (typeof code !== 'string' || !/^[A-Z][A-Z0-9_]{0,95}$/.test(code))
        return fail();
    return Object.freeze({ kind: 'blocked', code });
}
/** Only detached exact data crosses from the callback to Native's planner.
 * The original return object is never used as a capability or live row cache. */
export function nativeRequestMaterialDecisionV1(value) {
    if (value === null || typeof value !== 'object' || utilTypes.isProxy(value))
        return fail();
    const kindDescriptor = Object.getOwnPropertyDescriptor(value, 'kind');
    if (!kindDescriptor || !Object.hasOwn(kindDescriptor, 'value'))
        return fail();
    const kind = kindDescriptor.value;
    if (kind === 'unchanged') {
        object(value, ['kind']);
        return Object.freeze({ kind });
    }
    if (kind === 'blocked') {
        const row = object(value, ['kind', 'code']), code = row['code'];
        if (typeof code !== 'string' || !/^[A-Z][A-Z0-9_]{0,95}$/.test(code))
            return fail();
        return Object.freeze({ kind, code });
    }
    if (kind !== 'transform')
        return fail();
    const hasAnchors = Object.hasOwn(value, 'anchoredInsertions');
    const row = object(value, ['kind', 'schemaVersion', 'encoding', 'snapshot', 'plan', 'captureSha256',
        'expectedAssemblySha256', 'expectedSelectedBaseSha256', 'requiredSections', 'sections', 'insertions',
        ...hasAnchors ? ['anchoredInsertions'] : []]);
    if (row['schemaVersion'] !== 1 || row['encoding'] !== 'native-request-material-owner-transform-v1')
        return fail();
    const requiredSections = array(row['requiredSections'], NATIVE_REQUEST_OWNER_BOUNDS.sections).map(item => {
        const section = object(item, ['name', 'sha256']);
        return { name: identity(section['name']), sha256: sha(section['sha256']) };
    });
    let sectionBytes = 0;
    const sections = array(row['sections'], NATIVE_REQUEST_OWNER_BOUNDS.sections).map(item => {
        const section = object(item, ['name', 'expectedSectionSha256', 'replacementText', 'interpolate']);
        if (section['interpolate'] !== false)
            return fail();
        const replacementText = text(section['replacementText'], NATIVE_REQUEST_OWNER_BOUNDS.sectionChars);
        sectionBytes += Buffer.byteLength(replacementText, 'utf8');
        if (sectionBytes > NATIVE_REQUEST_OWNER_BOUNDS.sectionBytes)
            return fail();
        return { name: identity(section['name']), expectedSectionSha256: sha(section['expectedSectionSha256']),
            replacementText, interpolate: false };
    });
    let renderedBytes = 0;
    const insertions = array(row['insertions'], NATIVE_REQUEST_OWNER_BOUNDS.insertions).map((item) => {
        const insertion = object(item, ['contributionRef', 'sourceSha256', 'renderedText', 'renderedSha256',
            'requestedRole', 'requestedDepth', 'stableOrder']), role = insertion['requestedRole'];
        if (role !== 'system' && role !== 'user' && role !== 'assistant')
            return fail();
        const renderedText = text(insertion['renderedText'], NATIVE_REQUEST_OWNER_BOUNDS.textChars);
        // SDK serializers may drop blank assistant text or replace lone UTF-16
        // surrogates. Refuse before Native commits rather than changing author text.
        if (!renderedText.trim() || !renderedText.isWellFormed())
            return fail();
        renderedBytes += Buffer.byteLength(renderedText, 'utf8');
        if (renderedBytes > NATIVE_REQUEST_OWNER_BOUNDS.renderedBytes)
            return fail();
        return { contributionRef: identity(insertion['contributionRef']), sourceSha256: sha(insertion['sourceSha256']),
            renderedText, renderedSha256: sha(insertion['renderedSha256']), requestedRole: role,
            requestedDepth: count(insertion['requestedDepth']), stableOrder: count(insertion['stableOrder'], Number.MAX_SAFE_INTEGER) };
    });
    const anchoredInsertions = hasAnchors ? array(row['anchoredInsertions'], NATIVE_REQUEST_OWNER_BOUNDS.insertions)
        .map((item) => {
        const insertion = object(item, ['contributionRef', 'sourceSha256', 'renderedText', 'renderedSha256',
            'requestedRole', 'stableOrder', 'anchor']), role = insertion['requestedRole'];
        if (role !== 'system' && role !== 'user' && role !== 'assistant')
            return fail();
        const renderedText = text(insertion['renderedText'], NATIVE_REQUEST_OWNER_BOUNDS.textChars);
        if (!renderedText.trim() || !renderedText.isWellFormed())
            return fail();
        renderedBytes += Buffer.byteLength(renderedText, 'utf8');
        if (renderedBytes > NATIVE_REQUEST_OWNER_BOUNDS.renderedBytes)
            return fail();
        const anchor = object(insertion['anchor'], ['schemaVersion', 'encoding', 'side', 'target']);
        if (anchor['schemaVersion'] !== 1 || anchor['encoding'] !== 'native-selected-message-anchor-v1'
            || anchor['side'] !== 'before' && anchor['side'] !== 'after')
            return fail();
        const target = object(anchor['target'], ['id', 'role', 'messageSha256']);
        if (target['role'] !== 'user')
            return fail();
        return { contributionRef: identity(insertion['contributionRef']), sourceSha256: sha(insertion['sourceSha256']),
            renderedText, renderedSha256: sha(insertion['renderedSha256']), requestedRole: role,
            stableOrder: count(insertion['stableOrder'], Number.MAX_SAFE_INTEGER),
            anchor: { schemaVersion: 1, encoding: 'native-selected-message-anchor-v1', side: anchor['side'],
                target: { id: identity(target['id']), role: 'user', messageSha256: sha(target['messageSha256']) } } };
    }) : undefined;
    if (insertions.length + (anchoredInsertions?.length ?? 0) > NATIVE_REQUEST_OWNER_BOUNDS.insertions)
        return fail();
    if (new Set(requiredSections.map(item => item.name)).size !== requiredSections.length
        || new Set(sections.map(item => item.name)).size !== sections.length)
        return fail();
    return deepFreeze({ kind: 'transform', schemaVersion: 1, encoding: 'native-request-material-owner-transform-v1',
        snapshot: ref(row['snapshot']), plan: ref(row['plan']), captureSha256: sha(row['captureSha256']),
        expectedAssemblySha256: sha(row['expectedAssemblySha256']), expectedSelectedBaseSha256: sha(row['expectedSelectedBaseSha256']),
        requiredSections, sections, insertions, ...anchoredInsertions ? { anchoredInsertions } : {} });
}
/** Internal, data-only resolver called once on the actual Session preview.
 * The caller retains registration/claim/selected/current checks. This cannot
 * register a selection or recreate a live owner from stored anchor JSON. */
export function resolveNativeOwnedMaterialAnchorsV1(plan, selected, preview, protectedPrefixLength) {
    const insertions = [...plan.insertions];
    const resolutions = [];
    for (const intent of plan.anchoredInsertions ?? []) {
        const target = intent.anchor.target;
        const candidates = selected.messages.filter(row => row.id === target.id && row.role === target.role
            && row.messageSha256 === target.messageSha256);
        if (candidates.length !== 1)
            throw Error('REQUEST_MATERIAL_ANCHOR_SELECTED_UNPROVEN');
        const captured = candidates[0];
        const matches = preview.messageNodes.map((node, index) => ({ node, index })).filter(({ node }) => node.message.id === target.id && node.message.role === target.role
            && nativeInputSha256(node.message) === target.messageSha256);
        if (matches.length !== 1)
            throw Error('REQUEST_MATERIAL_ANCHOR_PREVIEW_UNPROVEN');
        const { node, index } = matches[0];
        if (captured.origin === 'surface') {
            if (captured.eventSeq !== Number(node.seq))
                throw Error('REQUEST_MATERIAL_ANCHOR_SURFACE_CHANGED');
        }
        else {
            const events = preview.events.filter(event => event.type === 'user/message' && Number(event.seq) === Number(node.seq)
                && nativeInputSha256(event.data) === target.messageSha256);
            if (events.length !== 1)
                throw Error('REQUEST_MATERIAL_ANCHOR_PENDING_UNPROVEN');
        }
        const baseIndex = index + (intent.anchor.side === 'after' ? 1 : 0);
        if (baseIndex < protectedPrefixLength)
            throw Error('REQUEST_MATERIAL_ANCHOR_PREFIX_PROTECTED');
        const { anchor: _anchor, ...data } = intent;
        insertions.push({ ...data, requestedDepth: preview.messages.length - baseIndex });
        resolutions.push({ contributionRef: intent.contributionRef, baseIndex });
    }
    return { insertions, resolutions };
}
/** Replacing a whole surviving owned section preserves its full preimage;
 * prose substrings and marker text cannot grant a lost slot permission. */
export function applyNativeOwnedSectionsV1(assembly, decision, sectionNames) {
    if (nativeInputSha256(assembly) !== decision.expectedAssemblySha256)
        throw Error('REQUEST_MATERIAL_ASSEMBLY_CHANGED');
    const required = new Map(decision.requiredSections.map(item => [item.name, item.sha256]));
    for (const [name, expected] of required) {
        const matches = assembly.sections.filter(section => section.name === name);
        if (!sectionNames.includes(name) || matches.length !== 1 || nativeInputSha256(matches[0]) !== expected) {
            throw Error('REQUEST_MATERIAL_SECTION_SUPPRESSED_OR_CHANGED');
        }
    }
    const edits = new Map(decision.sections.map(item => [item.name, item]));
    for (const edit of edits.values()) {
        if (!sectionNames.includes(edit.name) || required.get(edit.name) !== edit.expectedSectionSha256) {
            throw Error('REQUEST_MATERIAL_SECTION_PRECONDITION_MISSING');
        }
    }
    return deepFreeze({ ...assembly, sections: assembly.sections.map(section => {
            const edit = edits.get(section.name);
            return edit ? { ...section, text: edit.replacementText, interpolate: false } : section;
        }) });
}
