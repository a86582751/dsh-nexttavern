// Generated from runtime/alpha3/src/ui/reader-native-library-globals.ts; edit the TypeScript source.
import * as YAML from 'yaml';
import * as z from 'zod';
import { Hash, hash } from 'fast-sha256';
import { appendStableJson } from '../core/roleplay-record-json.js';
import { createTavernPromptTextKernelV1, createTavernPromptMacroPrimitivesV1 } from '../core/tavern-prompt-text-kernel.mjs';
import { TAVERN_PROMPT_CARD_ORDER_V1, TAVERN_PROMPT_POST_ORDER_V1, TAVERN_PROMPT_INSTRUCT_ORDER_V1 } from '../core/tavern-prompt-transform-types.mjs';
const encoder = new TextEncoder();
const primitives = createTavernPromptMacroPrimitivesV1(text => hash(encoder.encode(text)));
const recordSha256 = (value) => {
    if (value === undefined)
        return 'missing';
    const digest = new Hash(), fragments = [];
    let length = 0;
    const flush = () => {
        if (!length)
            return;
        digest.update(encoder.encode(fragments.join('')));
        fragments.length = 0;
        length = 0;
    };
    appendStableJson(value, fragment => {
        // Match the record owner's fragment boundaries, including UTF-8 handling.
        if (fragment.length >= 65536) {
            flush();
            digest.update(encoder.encode(fragment));
            return;
        }
        if (length + fragment.length > 65536)
            flush();
        fragments.push(fragment);
        length += fragment.length;
    });
    flush();
    return Array.from(digest.digest(), byte => byte.toString(16).padStart(2, '0')).join('');
};
const promptTextKernel = createTavernPromptTextKernelV1({ recordSha256, stringifyYaml: YAML.stringify,
    literal: primitives.literal, createRandom: primitives.createRandom, cardOrder: TAVERN_PROMPT_CARD_ORDER_V1,
    postOrder: TAVERN_PROMPT_POST_ORDER_V1, instructOrder: TAVERN_PROMPT_INSTRUCT_ORDER_V1 });
/** Bundled as a standalone browser IIFE, once in each isolated realm. */
Object.assign(globalThis, { YAML, z, __nextTavernPromptTextKernelV1: promptTextKernel });
