// Generated from runtime/alpha3/src/core/card-research-packets.ts; edit the TypeScript source.
/** Expand around a ranked location in UTF-16 code units. The source is immutable and all
 * output coordinates stay in that decoded-text coordinate system. */
export function expandSourceHit(source, row, chars) {
    const part = source.segments[row.segment];
    if (!part)
        throw Error('检索命中不属于当前冻结原文');
    const width = Math.min(chars, part.end - part.start), mid = Math.floor((row.start + row.end) / 2);
    let start = Math.max(part.start, mid - Math.floor(width / 2)), end = Math.min(part.end, start + width);
    start = Math.max(part.start, end - width);
    return {
        ...row, chapter: part.chapter, start, end, text: source.text.slice(start, end)
    };
}
function subtractDelivered(row, receipts) {
    let ranges = [[row.start, row.end]];
    for (const receipt of receipts) {
        if (receipt.segment !== row.segment)
            continue;
        const next = [];
        for (const [start, end] of ranges) {
            if (receipt.end <= start || receipt.start >= end) {
                next.push([start, end]);
                continue;
            }
            const left = [start, Math.min(end, receipt.start)];
            const right = [Math.max(start, receipt.end), end];
            if (left[1] > left[0])
                next.push(left);
            if (right[1] > right[0])
                next.push(right);
        }
        ranges = next;
    }
    return ranges.map(([start, end]) => ({
        ...row, start, end, text: row.text.slice(start - row.start, end - row.start)
    }));
}
/** Coalesce overlap from one query batch before text is sent. A packet can substantiate more
 * than one frontier query, but its bytes are delivered once and receive one stable packet id. */
export function packetizeResearchHits(source, rows, receipts) {
    const uncovered = rows.flatMap(row => subtractDelivered(row, receipts).map(part => ({
        ...part, queryIndex: row.queryIndex
    })));
    const sorted = uncovered.sort((a, b) => a.segment - b.segment || a.start - b.start || a.end - b.end);
    const packets = [];
    for (const row of sorted) {
        const sourceHit = {
            segment: row.segment, start: row.start, end: row.end, ...(row.score === undefined ? {} : {
                score: row.score
            })
        };
        const last = packets.at(-1);
        if (last && last.segment === row.segment && row.start <= last.end) {
            last.end = Math.max(last.end, row.end);
            last.text = source.text.slice(last.start, last.end);
            last.sourceHits.push(sourceHit);
            if (!last.queryIndexes.includes(row.queryIndex))
                last.queryIndexes.push(row.queryIndex);
            continue;
        }
        packets.push({
            ...row, sourceHits: [sourceHit], queryIndexes: [row.queryIndex]
        });
    }
    return {
        packets, skipped: rows.length - uncovered.length, merged: uncovered.length - packets.length
    };
}
/** A dense cluster can merge many nearby matches into one long range. Split that range
 * deterministically before delivery so the program, rather than the model, apportions it
 * across native evidence contexts. */
export function splitDenseResearchPackets(source, packets, maxChars = 4000) {
    const result = [];
    for (const packet of packets) {
        for (let start = packet.start; start < packet.end;) {
            let end = Math.min(packet.end, start + maxChars);
            if (end < packet.end && /[\uD800-\uDBFF]/.test(source.text[end - 1]))
                end--;
            if (end <= start)
                throw Error('原文交付包无法安全拆分');
            result.push({
                ...packet, start, end, text: source.text.slice(start, end), sourceHits: packet.sourceHits.filter(hit => hit.start < end && hit.end > start)
            });
            start = end;
        }
    }
    return result;
}
export function safeDeferredEvidence(packets) {
    const json = JSON.stringify({
        schemaVersion: 1, packets
    });
    return json.length <= 19000 && Buffer.byteLength(json, 'utf8') <= 45000;
}
export function splitDeferredEvidence(packets) {
    const groups = [];
    let group = [];
    for (const packet of packets) {
        if (group.length && !safeDeferredEvidence([...group, packet])) {
            groups.push(group);
            group = [];
        }
        if (safeDeferredEvidence([packet]))
            group.push(packet);
        else
            throw Error('单个原文交付包超出原生安全结果上限；请缩短 context_chars 后重试');
    }
    if (group.length)
        groups.push(group);
    return groups;
}
