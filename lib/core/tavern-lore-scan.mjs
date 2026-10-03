// Generated from runtime/alpha3/src/core/tavern-lore-scan.mts; edit the TypeScript source.
/** Fixed WI scan-buffer state. Capture supplies message strings; this class
 * owns only deterministic depth skew and rendered activation feedback. */
import { refuse } from './tavern-lore-match.mjs';
export class TavernLoreScanBufferV1 {
    snapshot;
    skew = 0;
    recursive = [];
    recursiveBytes = 0;
    activatedText = '';
    injected = [];
    injectedBytes = 0;
    constructor(snapshot) {
        this.snapshot = snapshot;
    }
    get depth() { return this.snapshot.settings.scanDepth + this.skew; }
    get hasRecurse() { return this.recursive.length > 0; }
    get budgetBaseText() { return this.activatedText; }
    advance() {
        this.skew++;
        if (this.depth > 1001)
            refuse('LORE_SCAN_DEPTH_LIMIT');
    }
    inject(text) {
        if (!text)
            return;
        this.injectedBytes += Buffer.byteLength(text, 'utf8');
        if (this.injectedBytes > 2_000_000)
            refuse('LORE_INJECTED_SCAN_TEXT_LIMIT');
        this.injected.push(text);
    }
    feedback(text) {
        if (!text)
            return;
        this.recursiveBytes += Buffer.byteLength(text, 'utf8');
        if (this.recursiveBytes > 2_000_000)
            refuse('LORE_RECURSIVE_TEXT_LIMIT');
        this.recursive.push(text);
        this.activatedText = `${text}\n${this.activatedText}`;
        if (Buffer.byteLength(this.activatedText, 'utf8') > 2_000_000)
            refuse('LORE_BUDGET_TEXT_LIMIT');
    }
    text(semantic, state) {
        const requested = semantic.scanDepth ?? this.depth;
        if (!Number.isSafeInteger(requested) || requested < 0)
            refuse('LORE_SCAN_DEPTH_UNSUPPORTED');
        // Fixed source returns before globals/recursion when depth<=startDepth(0).
        if (requested === 0)
            return '';
        const depth = Math.min(1000, requested);
        const parts = this.snapshot.visibleMessages.slice(0, depth).map(row => row.scanText.trim());
        parts.push(...this.injected);
        const fields = [['matchPersonaDescription', 'personaDescription'], ['matchCharacterDescription', 'characterDescription'],
            ['matchCharacterPersonality', 'characterPersonality'], ['matchCharacterDepthPrompt', 'characterDepthPrompt'],
            ['matchScenario', 'scenario'], ['matchCreatorNotes', 'creatorNotes']];
        for (const [flag, key] of fields)
            if (semantic[flag] && this.snapshot.globalScanData[key])
                parts.push(this.snapshot.globalScanData[key]);
        if (state !== 'minimum-activations')
            parts.push(...this.recursive);
        const text = '\u0001' + parts.join('\n\u0001');
        if (text.length > 32768)
            refuse('LORE_SCAN_TEXT_LIMIT');
        return text;
    }
}
/** Fixed WI transitions: recursion, min-activation depth advance, then open
 * delayed levels. A configured max-step limit is checked by the loop owner. */
export function nextLoreScanStateV1(input) {
    const { snapshot, buffer, state, overflowed } = input, settings = snapshot.settings;
    let next = null;
    if (settings.recursiveScanning && !overflowed && input.recursingEntries > 0)
        next = 'recursion';
    if (settings.recursiveScanning && !overflowed && state === 'minimum-activations' && buffer.hasRecurse)
        next = 'recursion';
    if (!next && !overflowed && settings.minimumActivations > input.activatedCount) {
        const overMax = settings.minimumActivationDepthMax > 0 && buffer.depth > settings.minimumActivationDepthMax
            || buffer.depth > snapshot.visibleMessages.length;
        if (!overMax) {
            buffer.advance();
            next = 'minimum-activations';
        }
    }
    let advanceDelay = false;
    if (!next && input.remainingDelayLevels > 0) {
        next = 'recursion';
        advanceDelay = true;
    }
    return { state: next, advanceDelay };
}
