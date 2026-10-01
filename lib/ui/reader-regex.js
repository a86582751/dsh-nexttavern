// Generated from runtime/alpha3/src/ui/reader-regex.ts; edit the TypeScript source.
export function readerRegexTask(task) {
    const limit = (text) => { if (typeof text !== 'string' || text.length > 2_000_000)
        throw new Error('size'); return text; };
    const replaceBounded = (text, re, replacement) => {
        let used = 0, end = 0, count = 0, found;
        const output = [];
        // Avoid RegExp@@replace's up-front collection of every global match and
        // capture array. Account for each match before allocating the next one.
        while ((found = re.exec(text)) !== null) {
            if (++count > 100000)
                throw new Error('match-limit');
            const groups = found.groups, original = text, offset = found.index, match = found[0], captures = found.slice(1);
            let expandedSize = 0, tokenEnd = 0;
            const expanded = replacement.replace(/\$([$&`']|\d{1,2}|<[^>]*>)/g, (whole, token, index) => {
                let value = whole;
                if (token === '$')
                    value = '$';
                else if (token === '&')
                    value = match;
                else if (token === '`')
                    value = original.slice(0, offset);
                else if (token === "'")
                    value = original.slice(offset + match.length);
                else if (token.startsWith('<')) {
                    if (groups)
                        value = groups[token.slice(1, -1)] ?? '';
                }
                else {
                    const n = Number(token);
                    if (n > 0 && n <= captures.length)
                        value = captures[n - 1] ?? '';
                    else if (token.length === 2 && Number(token[0]) > 0 && Number(token[0]) <= captures.length)
                        value = (captures[Number(token[0]) - 1] ?? '') + token[1];
                }
                expandedSize += index - tokenEnd + value.length;
                tokenEnd = index + whole.length;
                if (expandedSize > 2_000_000)
                    throw new Error('size');
                return value;
            });
            used += offset - end + expanded.length;
            output.push(text.slice(end, offset), expanded);
            end = offset + match.length;
            if (used + text.length - end > 2_000_000)
                throw new Error('size');
            if (!re.global)
                break;
            if (match === '')
                re.lastIndex += re.unicode && text.codePointAt(re.lastIndex) > 65535 ? 2 : 1;
        }
        output.push(text.slice(end));
        return output.join('');
    };
    const regex = (rule) => {
        if (typeof rule?.match !== 'string' || !rule.match || rule.match.length > 4096 || String(rule.replace ?? '').length > 65536)
            throw new Error('rule-limit');
        return new RegExp(rule.match, 'g' + String(rule.flags ?? '').replace(/[gy]/g, ''));
    };
    if (task.op === 'source') {
        let output = limit(task.text), matched = false;
        const deferred = [];
        if (!Array.isArray(task.rules) || task.rules.length > 200)
            throw new Error('rule-limit');
        for (const [i, rule] of task.rules.entries()) {
            let re;
            try {
                re = regex(rule);
            }
            catch {
                continue;
            }
            if (re.test(output)) {
                re.lastIndex = 0;
                output = limit(replaceBounded(output, re, String(rule.replace ?? '')));
                matched = true;
            }
            else
                deferred.push(i);
        }
        return { output, deferred, matched };
    }
    const rule = task.rule, re = regex(rule), html = limit(task.html);
    if (re.test(html)) {
        re.lastIndex = 0;
        return { kind: 'html', html: limit(replaceBounded(html, re, String(rule.replace ?? ''))) };
    }
    if (!rule.match.includes('“') || !rule.match.includes('”'))
        return { kind: 'none' };
    if (!Array.isArray(task.nodes) || task.nodes.length > 10000)
        throw new Error('node-limit');
    const edits = [];
    let size = 0;
    for (const [node, original] of task.nodes.entries()) {
        limit(original);
        const ranges = Array.from(original.matchAll(/(`+)(?!`)[\s\S]*?\1(?!`)/g), m => [m.index, m.index + m[0].length]);
        const shadow = original.replace(/"([^"\n]+)"/g, (whole, content, index) => ranges.some(([a, b]) => index < b && index + whole.length > a) ? whole : `“${content}”`);
        if (shadow === original)
            continue;
        const parts = [], sticky = new RegExp(rule.match, 'y' + String(rule.flags ?? '').replace(/[gy]/g, ''));
        let cursor = 0, matched = false;
        re.lastIndex = 0;
        for (const match of shadow.matchAll(re)) {
            const i = match.index;
            if (original.slice(i, i + match[0].length) === match[0])
                continue;
            parts.push({ text: original.slice(cursor, i) });
            sticky.lastIndex = i;
            const replaced = limit(replaceBounded(shadow, sticky, String(rule.replace ?? ''))), suffix = shadow.length - i - match[0].length;
            const replacement = replaced.slice(i, suffix ? -suffix : undefined);
            size += replacement.length;
            if (size > 2_000_000)
                throw new Error('size');
            parts.push({ html: replacement });
            cursor = i + match[0].length;
            matched = true;
        }
        if (matched) {
            parts.push({ text: original.slice(cursor) });
            edits.push({ node, parts });
        }
    }
    return { kind: edits.length ? 'quote' : 'none', edits };
}
let readerRegexQueue = Promise.resolve(), readerRegexWorker = null;
export function runReaderRegex(task) {
    const run = () => new Promise((resolve, reject) => {
        let timer, worker;
        const stop = (error) => { clearTimeout(timer); worker?.terminate(); if (readerRegexWorker === worker)
            readerRegexWorker = null; reject(error); };
        try {
            if (!readerRegexWorker) {
                const code = `const run=${readerRegexTask.toString()};self.onmessage=e=>{try{self.postMessage({ok:true,value:run(e.data)})}catch{self.postMessage({ok:false})}};`;
                const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
                try {
                    readerRegexWorker = new Worker(url);
                }
                finally {
                    URL.revokeObjectURL(url);
                }
            }
            worker = readerRegexWorker;
            worker.onmessage = (e) => { clearTimeout(timer); e.data?.ok ? resolve(e.data.value) : stop(new Error('美化规则超过执行限制')); };
            worker.onerror = () => stop(new Error('美化工作线程不可用'));
            timer = setTimeout(() => stop(new Error('美化正则匹配超时')), 250);
            worker.postMessage(task);
        }
        catch (error) {
            stop(error);
        }
    });
    const result = readerRegexQueue.catch(() => { }).then(run);
    readerRegexQueue = result.catch(() => { });
    return result;
}
