// Generated from runtime/alpha3/compat/anydoc/src/normalize-markdown.ts; edit the TypeScript source.
/**
 * Remove the defensive Markdown escapes emitted by some DOCX converters.
 *
 * Fenced and inline code remain byte-for-byte unchanged. Markdown punctuation
 * outside code is normalized with the historical read-document replay.
 */
export function dshNormalizeMarkdown(markdown) {
    const text = String(markdown ?? '').replace(/\r\n?/g, '\n');
    const lines = text.split('\n');
    const backtick = String.fromCharCode(96);
    let fenceChar = '';
    let fenceLength = 0;
    return lines.map((originalLine) => {
        const fence = originalLine.match(/^(\s*)(\\?)(`{3,}|~{3,})(.*)$/);
        if (fence !== null) {
            const marker = fence[3];
            const char = marker[0];
            if (fenceChar === '') {
                fenceChar = char;
                fenceLength = marker.length;
            }
            else if (fenceChar === char && marker.length >= fenceLength) {
                fenceChar = '';
                fenceLength = 0;
            }
            return `${fence[1]}${marker}${fence[4]}`;
        }
        if (fenceChar !== '')
            return originalLine;
        const line = originalLine.replace(/^(\s*)\\(\d+\.)(?=\s|$)/, '$1$2');
        let output = '';
        let index = 0;
        let inlineLength = 0;
        while (index < line.length) {
            const char = line[index];
            const next = line[index + 1];
            const slashEscaped = char === '\\' && next === backtick && !isEscaped(line, index);
            const isDelimiter = char === backtick || slashEscaped;
            if (isDelimiter) {
                const markerStart = slashEscaped ? index + 1 : index;
                let run = 1;
                while (line[markerStart + run] === backtick)
                    run += 1;
                if (inlineLength === 0) {
                    output += backtick.repeat(run);
                    inlineLength = run;
                    index = markerStart + run;
                    continue;
                }
                if (run === inlineLength) {
                    output += backtick.repeat(run);
                    inlineLength = 0;
                    index = markerStart + run;
                    continue;
                }
            }
            if (inlineLength !== 0) {
                output += char;
                index += 1;
                continue;
            }
            if (char === '\\' && next !== undefined && !isEscaped(line, index)) {
                const atLineStart = /^\s*$/.test(output);
                const previous = line[index - 1] ?? '';
                const following = line[index + 2] ?? '';
                const isWordHyphen = next === '-' && !atLineStart && !/\s/.test(previous) && !/\s/.test(following);
                const isWordPlus = next === '+' && !atLineStart && !/\s/.test(previous) && !/\s/.test(following);
                const punctuation = '`*_[]{}<>|#+-!~=';
                if (punctuation.includes(next) && !isWordHyphen && !isWordPlus) {
                    output += next;
                    index += 2;
                    continue;
                }
            }
            output += char;
            index += 1;
        }
        return output;
    }).join('\n');
    function isEscaped(line, index) {
        let slashCount = 0;
        for (let cursor = index - 1; cursor >= 0 && line[cursor] === '\\'; cursor -= 1)
            slashCount += 1;
        return slashCount % 2 === 1;
    }
}
export const normalizeMarkdown = dshNormalizeMarkdown;
