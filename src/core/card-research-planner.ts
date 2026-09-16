import { createHash, randomUUID } from 'node:crypto';
import type { AdaptationSource, AdaptationTable } from './card-adaptation.js';
export type ReadingMode = 'close-reading' | 'coarse';
export interface ResearchCitation {
    segment: number;
    start: number;
    end: number;
    quote: string;
    sha256: string;
}
export interface ResearchEdge {
    from: string;
    relation: string;
    to: string;
    citations: ResearchCitation[];
}
export interface ResearchFact {
    id: string;
    category: 'world' | 'rule' | 'faction' | 'relation' | 'event' | 'character';
    statement: string;
    certainty: 'verified-original' | 'unknown';
    entity?: string;
    topic?: string;
    citations: ResearchCitation[];
    storyOccursAt: string;
    readerRevealedAt: string;
    characterKnowledge: string;
    chain?: {
        cause: string;
        preconditions: string;
        actions: {
            summary: string;
            citations: ResearchCitation[];
        }[];
        people: string;
        result: string;
        reveal: string;
    };
    /** A source-cited relation is a reusable research edge, never a player-worldline fact. */
    edges?: ResearchEdge[];
}
interface Receipt {
    start: number;
    end: number;
    segment: number;
    sha256: string;
}
interface ResearchPacket extends Receipt {
    id: string;
    generation: string;
    /** Explicit whole-packet confirmation after a verified fact transaction. */
    acknowledged?: true;
}
interface PacketWrite {
    rows:{segment:number;start:number;end:number;text:string}[];
    query?:string; fingerprint?:string; seq?:number; frontierId?:string;
    candidates?:{segment:number;start:number;end:number;score?:number}[];
    mode?:'keyword'|'semantic'|'hybrid'; completeQuery?:boolean;
}
interface QueryRecord {
    query: string;
    fingerprint: string;
    mode: 'keyword' | 'semantic' | 'hybrid';
    seq: number;
    ranges: Receipt[];
    candidates: CandidateRange[];
}
interface CandidateRange extends Receipt {
    score?: number;
}
type FrontierSource = 'target' | 'opening' | 'coverage' | 'relation' | 'unknown' | 'manual';
type FrontierState = 'pending' | 'queried' | 'deferred';
interface ResearchFrontier {
    id: string;
    query: string;
    normalizedQuery: string;
    source: FrontierSource;
    state: FrontierState;
    priority: number;
    parentFactIds: string[];
    candidateRanges: CandidateRange[];
    attemptedFingerprints: string[];
}
interface ResearchPlan {
    schemaVersion: 2;
    kind: 'adaptation-research-plan';
    owner: string;
    sourceId: string;
    textSha256: string;
    revision: number;
    mode: ReadingMode | null;
    status: 'choice-required' | 'active' | 'paused' | 'finished';
    generation: string;
    target: {
        protagonist: string;
        openingPoint: string;
    };
    createdAt: number;
    startedSeq: number;
    budget: {
        queryBatches: number;
        maxQueryBatches: number;
        readPackets: number;
        maxReadPackets: number;
    };
    receipts: Receipt[];
    packets: ResearchPacket[];
    queries: QueryRecord[];
    entries: ResearchFact[];
    frontier: ResearchFrontier[];
    web: {
        url: string;
        callId: string;
        resultSeq: number;
        excerptHash: string;
    }[];
    finishedFingerprint?: string;
    finishedAt?: number;
}
interface ResearchBase {
    schemaVersion: 2;
    kind: 'original-research-base';
    textSha256: string;
    rawSha256: string;
    revision: number;
    entries: ResearchFact[];
}
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const planKey = (owner: string, id: string) => `adaptation-research-${hash(owner)}-${id}`;
// Evidence coordinates belong to the decoded text. Equal raw bytes decoded under a different
// explicit encoding therefore cannot share a fact base, even though their source file matches.
const baseKey = (s: AdaptationSource) => `adaptation-research-base-${hash(s.rawSha256 + ':' + s.textSha256 + ':v1')}`;
const locks = new Map<string, Promise<unknown>>();
async function lock<T>(key: string, work: () => Promise<T>): Promise<T> { const p = (locks.get(key) ?? Promise.resolve()).catch(() => { }).then(work); locks.set(key, p); try {
    return await p;
}
finally {
    if (locks.get(key) === p)
        locks.delete(key);
} }
const categories = ['world', 'rule', 'faction', 'relation', 'event'] as const;
const allCategories = [...categories, 'character'] as const;
const topics = ['identity', 'motive', 'relations', 'affiliation', 'limits', 'turning-point', 'opening'] as const;
const modes = ['close-reading', 'coarse'] as const;
const queryModes = ['keyword', 'semantic', 'hybrid'] as const;
const statuses = ['choice-required', 'active', 'paused', 'finished'] as const;
const frontierSources = ['target', 'opening', 'coverage', 'relation', 'unknown', 'manual'] as const;
const frontierStates = ['pending', 'queried', 'deferred'] as const;
const hex64 = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
function text(v: unknown, name: string, max = 1600, optional = false) { if (typeof v !== 'string' || v.length > max || (!optional && !v.trim()))
    throw Error(`${name} 需要 ${optional ? '0' : '1'}–${max} 字符`); return v.trim(); }
function integer(v: unknown, name: string, min: number, max: number) { if (!Number.isSafeInteger(v) || Number(v) < min || Number(v) > max)
    throw Error(`${name} 无效`); return Number(v); }
function unique<T>(values: T[], key: (value: T) => string, name: string) { const seen = new Set<string>(); for (const value of values) {
    const id = key(value);
    if (seen.has(id))
        throw Error(`${name} 不可重复`);
    seen.add(id);
} }
function normalizedQuery(value: string) { return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase(); }
function citation(source: AdaptationSource, raw: unknown, label = '引用'): ResearchCitation {
    const value = object(raw), segment = integer(value.segment, `${label}分段`, 0, source.segments.length - 1), part = source.segments[segment]!;
    const start = integer(value.start, `${label}起点`, part.start, part.end), quote = text(value.quote, `${label}原文短句`, 500);
    if (quote.length < 6)
        throw Error(`${label}原文短句至少需要 6 字符`);
    const end = start + quote.length;
    if (end > part.end || source.text.slice(start, end) !== quote)
        throw Error(`${label}不属于指定原文分段`);
    const sha256 = hash(quote);
    if (value.sha256 !== undefined && value.sha256 !== sha256)
        throw Error(`${label}哈希不匹配`);
    return { segment, start, end, quote, sha256 };
}
function citationsFromSource(source: AdaptationSource, raw: unknown, label = '事实'): ResearchCitation[] {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 6)
        throw Error(`${label}需要 1–6 条原文引用`);
    const result = raw.map((item, index) => citation(source, item, `${label}引用 ${index + 1}`));
    unique(result, value => `${value.segment}:${value.start}:${value.end}:${value.sha256}`, `${label}引用`);
    return result;
}
// A model should copy evidence, not count UTF-16 positions in a long novel.
// Search only hash-validated packets actually delivered to this research plan.
// Persist the same canonical coordinates as before; never fuzzy-match wording.
function resolveInputCitations(source:AdaptationSource,receipts:readonly Receipt[],raw:unknown,label='citations'):ResearchCitation[] {
    if(!Array.isArray(raw)||raw.length<1||raw.length>6)throw Error(`${label} 需要 1–6 条原文引用`);
    const resolved=raw.map((item,index)=>{
        const value=object(item),segment=integer(value.segment,'引用分段',0,source.segments.length-1),quote=text(value.quote,'原文短句',500);
        if(quote.length<6)throw Error('原文短句至少需要 6 字符；请从已返回原文复制更完整的一句，不必计算 start');
        const packets=receipts.filter(r=>r.segment===segment&&hash(source.text.slice(r.start,r.end))===r.sha256);
        const hint=value.start;
        if(typeof hint==='number'&&Number.isSafeInteger(hint)&&packets.some(r=>hint>=r.start&&hint+quote.length<=r.end)&&source.text.slice(hint,hint+quote.length)===quote)
            return citation(source,value,`事实引用 ${index+1}`);
        const positions=new Set<number>();
        for(const packet of packets){
            let offset=source.text.indexOf(quote,packet.start);
            while(offset>=packet.start&&offset+quote.length<=packet.end){
                positions.add(offset);
                if(positions.size>1)break;
                offset=source.text.indexOf(quote,offset+1);
            }
            if(positions.size>1)break;
        }
        if(!positions.size)throw Error(`引用未由本计划实际查询/回读，或原文短句不匹配（第 ${index+1} 条）；请 query/read 后逐字复制 6–500 字符，保留标点与简繁，不要猜 start 或用文件工具计算`);
        if(positions.size>1)throw Error(`事实引用 ${index+1}在已返回原文中出现多处；请复制更长的唯一原句，或提供准确 start`);
        return citation(source,{...value,start:[...positions][0]},`事实引用 ${index+1}`);
    });
    unique(resolved,c=>`${c.segment}:${c.start}:${c.end}:${c.sha256}`,'事实引用');
    return resolved;
}
function resolveInputFact(source:AdaptationSource,receipts:readonly Receipt[],input:Record<string,unknown>) {
    const result:Record<string,unknown>={...input,citations:resolveInputCitations(source,receipts,input.citations)};
    if(input.chain!==undefined){
        const chain=object(input.chain);
        if(!Array.isArray(chain.actions))throw Error('因果链缺少阶段行动');
        result.chain={...chain,actions:chain.actions.map((item,index)=>{const action=object(item);return {...action,citations:resolveInputCitations(source,receipts,action.citations,`chain.actions[${index}].citations`)}})};
    }
    if(input.edges!==undefined){
        if(!Array.isArray(input.edges))throw Error('关系边必须是数组');
        result.edges=input.edges.map((item,index)=>{const edge=object(item);return {...edge,citations:resolveInputCitations(source,receipts,edge.citations,`edges[${index}].citations`)}});
    }
    return result;
}
function validateChain(source: AdaptationSource, raw: unknown): ResearchFact['chain'] {
    const value = object(raw), actions = value.actions;
    if (!Array.isArray(actions) || !actions.length || actions.length > 8)
        throw Error('关键因果链需要 1–8 个有证据的阶段行动');
    return { cause: text(value.cause, '起因'), preconditions: text(value.preconditions, '前置条件'), actions: actions.map((item, index) => { const action = object(item); return { summary: text(action.summary, `阶段行动 ${index + 1}`, 800), citations: citationsFromSource(source, action.citations, `阶段行动 ${index + 1}`) }; }), people: text(value.people, '相关人物', 500), result: text(value.result, '原著结果'), reveal: text(value.reveal, '揭露位置与知情条件', 800) };
}
function validateEdges(source: AdaptationSource, raw: unknown): ResearchEdge[] {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8)
        throw Error('关系边需要 1–8 条带原著引用的关联');
    const edges = raw.map((item, index) => {
        const value = object(item);
        return {
            from: text(value.from, `关系边 ${index + 1} 起点`, 200),
            relation: text(value.relation, `关系边 ${index + 1} 关系`, 200),
            to: text(value.to, `关系边 ${index + 1} 终点`, 200),
            citations: citationsFromSource(source, value.citations, `关系边 ${index + 1}`),
        };
    });
    unique(edges, edge => `${edge.from}\u0000${edge.relation}\u0000${edge.to}`, '关系边');
    return edges;
}
function factFromStored(source: AdaptationSource, raw: unknown, scope: 'base' | 'private'): ResearchFact {
    const value = object(raw), category = String(value.category) as ResearchFact['category'], certainty = value.certainty;
    if (!hex64(value.id) || !allCategories.includes(category) || !['verified-original', 'unknown'].includes(String(certainty)))
        throw Error('研究事实记录损坏');
    const fact: ResearchFact = { id: value.id as string, category, statement: text(value.statement, '研究条目', 1600), certainty: certainty as ResearchFact['certainty'], citations: [], storyOccursAt: text(value.storyOccursAt, '事件发生时间', 300), readerRevealedAt: text(value.readerRevealedAt, '读者获知位置', 300), characterKnowledge: text(value.characterKnowledge, '角色知情条件', 600) };
    if (category === 'character') {
        fact.entity = text(value.entity, '原著人物', 200);
        fact.topic = text(value.topic, '人物专题', 50);
        if (!topics.includes(fact.topic as typeof topics[number]))
            throw Error('人物专题字段无效');
    }
    else if (value.entity !== undefined || value.topic !== undefined)
        throw Error('非人物条目不能带人物专题字段');
    if (fact.certainty === 'unknown') {
        if (scope === 'base' || (Array.isArray(value.citations) && value.citations.length) || value.chain !== undefined || value.edges !== undefined)
            throw Error('未知项不能伪装成共享原著事实或带原著因果证据');
        return fact;
    }
    if (scope === 'private')
        throw Error('已核实原著事实必须保存到共享原著底稿');
    fact.citations = citationsFromSource(source, value.citations);
    if (value.chain !== undefined)
        fact.chain = validateChain(source, value.chain);
    if (value.edges !== undefined)
        fact.edges = validateEdges(source, value.edges);
    return fact;
}
function privateFact(source: AdaptationSource, raw: unknown, id: string): ResearchFact { return factFromStored(source, { ...object(raw), id, certainty: 'unknown', citations: [] }, 'private'); }
function sharedFact(source: AdaptationSource, raw: unknown): ResearchFact {
    const value = object(raw), fact: ResearchFact = { id: '0'.repeat(64), category: String(value.category) as ResearchFact['category'], statement: text(value.statement, '条目', 1600), certainty: 'verified-original', citations: citationsFromSource(source, value.citations), storyOccursAt: text(value.storyOccursAt ?? '未知', '事件发生时间', 300), readerRevealedAt: text(value.readerRevealedAt ?? '未知', '读者获知位置', 300), characterKnowledge: text(value.characterKnowledge ?? '未知；不能作为角色已知信息', '角色知情条件', 600) };
    if (!allCategories.includes(fact.category))
        throw Error('事实类别无效');
    if (fact.category === 'character') {
        fact.entity = text(value.entity, '原著人物', 200);
        fact.topic = text(value.topic, '人物专题', 50);
        if (!topics.includes(fact.topic as typeof topics[number]))
            throw Error('人物专题字段无效');
    }
    if (value.chain !== undefined)
        fact.chain = validateChain(source, value.chain);
    if (value.edges !== undefined)
        fact.edges = validateEdges(source, value.edges);
    const stable = { rawSha256: source.rawSha256, category: fact.category, statement: fact.statement, entity: fact.entity ?? null, topic: fact.topic ?? null, citations: fact.citations.map(c => [c.segment, c.start, c.end, c.sha256]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), storyOccursAt: fact.storyOccursAt, readerRevealedAt: fact.readerRevealedAt, characterKnowledge: fact.characterKnowledge, chain: fact.chain, edges: fact.edges };
    fact.id = hash(JSON.stringify(stable));
    return factFromStored(source, fact, 'base');
}
const sameFact = (a: ResearchFact, b: ResearchFact) => JSON.stringify(a) === JSON.stringify(b);
/** Original evidence is shared; protagonist, opening choice and unknowns remain owner-local. */
export function createResearchPlanner(table: AdaptationTable, loadSource: (owner: string, id: string) => AdaptationSource, assessLongitudinal?: (source: AdaptationSource,target: string,facts: ResearchFact[])=>{missing:string[];[key:string]:unknown}) {
    function receiptFromStored(source: AdaptationSource, raw: unknown, label = '阅读回执'): Receipt {
        const value = object(raw), segment = integer(value.segment, `${label}分段`, 0, source.segments.length - 1), part = source.segments[segment]!, start = integer(value.start, `${label}起点`, part.start, part.end), end = integer(value.end, `${label}终点`, start, part.end), sha256 = value.sha256;
        if (start === end || !hex64(sha256) || hash(source.text.slice(start, end)) !== sha256)
            throw Error(`${label}与冻结原文不一致`);
        return { segment, start, end, sha256: sha256 as string };
    }
    const packetId = (owner: string, source: AdaptationSource, receipt: Receipt) => hash(`${owner}\u0000${source.id}\u0000${source.textSha256}\u0000${receipt.segment}\u0000${receipt.start}\u0000${receipt.end}\u0000${receipt.sha256}`);
    function packetFromStored(source: AdaptationSource, owner: string, raw: unknown): ResearchPacket {
        const receipt = receiptFromStored(source, raw, '研究交付包'), value = object(raw), generation = text(value.generation, '研究交付 generation', 200), id = value.id;
        if (!hex64(id) || id !== packetId(owner, source, receipt))
            throw Error('研究交付包 ID 与原文不匹配');
        if (value.acknowledged !== undefined && value.acknowledged !== true)
            throw Error('研究交付包确认标记无效');
        return { ...receipt, id: id as string, generation, ...(value.acknowledged === true ? { acknowledged: true as const } : {}) };
    }
    function candidateFromStored(source: AdaptationSource, raw: unknown, label = '检索候选'): CandidateRange {
        const receipt = receiptFromStored(source, raw, label), value = object(raw);
        if (value.score === undefined)
            return receipt;
        if (typeof value.score !== 'number' || !Number.isFinite(value.score))
            throw Error(`${label}分数无效`);
        return { ...receipt, score: value.score };
    }
    function frontierFromStored(source: AdaptationSource, raw: unknown): ResearchFrontier {
        const value = object(raw), query = text(value.query, '探索查询', 1000), normalized = text(value.normalizedQuery, '规范化探索查询', 1000), sourceKind = value.source, state = value.state;
        if (normalized !== normalizedQuery(query) || !frontierSources.includes(sourceKind as FrontierSource) || !frontierStates.includes(state as FrontierState))
            throw Error('探索前沿记录损坏');
        const parentFactIds = value.parentFactIds;
        if (!hex64(value.id) || !Number.isSafeInteger(value.priority) || Number(value.priority) < 0 || Number(value.priority) > 100 || !Array.isArray(parentFactIds) || parentFactIds.length > 8 || parentFactIds.some(id => !hex64(id)) || !Array.isArray(value.candidateRanges) || value.candidateRanges.length > 30 || !Array.isArray(value.attemptedFingerprints) || value.attemptedFingerprints.length > 20)
            throw Error('探索前沿记录无效');
        const candidates = value.candidateRanges.map(item => candidateFromStored(source, item));
        unique(candidates, row => `${row.segment}:${row.start}:${row.end}`, '探索候选');
        const attemptedFingerprints = value.attemptedFingerprints.map(item => text(item, '探索检索指纹', 300));
        unique(attemptedFingerprints, item => item, '探索检索指纹');
        return { id: value.id as string, query, normalizedQuery: normalized, source: sourceKind as FrontierSource, state: state as FrontierState, priority: Number(value.priority), parentFactIds: [...parentFactIds] as string[], candidateRanges: candidates, attemptedFingerprints };
    }
    function validatePlan(source: AdaptationSource, raw: unknown): ResearchPlan {
        const value = object(raw);
        if (![1, 2].includes(Number(value.schemaVersion)) || value.kind !== 'adaptation-research-plan' || typeof value.owner !== 'string' || typeof value.sourceId !== 'string' || value.textSha256 !== source.textSha256 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !(value.mode === null || modes.includes(value.mode as ReadingMode)) || !statuses.includes(value.status as ResearchPlan['status']) || typeof value.generation !== 'string' || !value.generation || value.generation.length > 200)
            throw Error('改编研究计划损坏，不能沿用完成标记');
        const target = object(value.target), budget = object(value.budget);
        const plan: ResearchPlan = { schemaVersion: 2, kind: 'adaptation-research-plan', owner: value.owner as string, sourceId: value.sourceId as string, textSha256: source.textSha256, revision: Number(value.revision), mode: value.mode as ReadingMode | null, status: value.status as ResearchPlan['status'], generation: value.generation as string, target: { protagonist: text(target.protagonist, '重点主角', 200, true), openingPoint: text(target.openingPoint, '开局时间点', 500, true) }, budget: { queryBatches: integer(budget.queryBatches, '已用检索批次', 0, 200), maxQueryBatches: integer(budget.maxQueryBatches, '最大检索批次', 1, 200), readPackets: integer(budget.readPackets, '已用阅读包', 0, 500), maxReadPackets: integer(budget.maxReadPackets, '最大阅读包', 1, 500) }, receipts: [], packets: [], queries: [], entries: [], frontier: [], web: [], createdAt: integer(value.createdAt, '计划创建时间', 0, Number.MAX_SAFE_INTEGER), startedSeq: integer(value.startedSeq, '研究开始位置', -1, Number.MAX_SAFE_INTEGER) };
        if (plan.budget.queryBatches > plan.budget.maxQueryBatches || plan.budget.readPackets > plan.budget.maxReadPackets)
            throw Error('研究预算记录损坏');
        if (plan.status === 'choice-required' && plan.mode !== null)
            throw Error('待选择研究计划不能带阅读模式');
        if (plan.mode === 'coarse' && !plan.target.protagonist && plan.status !== 'choice-required')
            throw Error('粗颗粒度计划缺少重点主角');
        const frontierRaw = value.frontier === undefined ? [] : value.frontier;
        const packetsRaw = value.packets === undefined ? [] : value.packets;
        if (!Array.isArray(value.receipts) || value.receipts.length > 1000 || !Array.isArray(packetsRaw) || packetsRaw.length > 1000 || !Array.isArray(value.queries) || value.queries.length > 400 || !Array.isArray(value.entries) || value.entries.length > 250 || !Array.isArray(frontierRaw) || frontierRaw.length > 256 || !Array.isArray(value.web) || value.web.length > 200)
            throw Error('研究计划记录容量无效');
        plan.receipts = value.receipts.map(item => receiptFromStored(source, item));
        unique(plan.receipts, r => `${r.segment}:${r.start}:${r.end}`, '阅读回执');
        plan.packets = packetsRaw.map(item => packetFromStored(source, plan.owner, item));
        unique(plan.packets, packet => `${packet.id}:${packet.generation}`, '研究交付包');
        plan.queries = value.queries.map(item => {
            const query = object(item), rawQuery = text(query.query, '研究查询', 1000), fingerprint = text(query.fingerprint, '检索指纹', 300), mode = query.mode === undefined ? (fingerprint === 'keyword' ? 'keyword' : 'semantic') : text(query.mode, '检索模式', 20), seq = integer(query.seq, '查询位置', -1, Number.MAX_SAFE_INTEGER), rangesRaw = query.ranges;
            if (!queryModes.includes(mode as typeof queryModes[number]))
                throw Error('研究查询模式无效');
            if (!Array.isArray(rangesRaw) || rangesRaw.length > 32)
                throw Error('研究查询返回范围无效');
            const ranges = rangesRaw.map(range => receiptFromStored(source, range, '查询返回范围'));
            unique(ranges, r => `${r.segment}:${r.start}:${r.end}`, '查询返回范围');
            const candidatesRaw = query.candidates ?? [];
            if (!Array.isArray(candidatesRaw) || candidatesRaw.length > 30)
                throw Error('研究查询候选范围无效');
            const candidates = candidatesRaw.map(candidate => candidateFromStored(source, candidate, '查询候选范围'));
            unique(candidates, row => `${row.segment}:${row.start}:${row.end}`, '查询候选范围');
            return { query: rawQuery, fingerprint, mode: mode as QueryRecord['mode'], seq, ranges, candidates };
        });
        unique(plan.queries, q => `${normalizedQuery(q.query)}:${q.mode}:${q.fingerprint}`, '研究查询');
        plan.entries = value.entries.map(item => factFromStored(source, item, 'private'));
        unique(plan.entries, f => f.id, '私有研究条目');
        plan.frontier = frontierRaw.map(item => frontierFromStored(source, item));
        unique(plan.frontier, item => item.id, '探索前沿 ID');
        unique(plan.frontier, item => item.normalizedQuery, '探索前沿查询');
        // V1 had no frontier. Derive only deterministic target/opening/coverage questions;
        // this is an in-memory migration and becomes durable on the next normal plan write.
        if (Number(value.schemaVersion) === 1 && plan.mode === 'coarse')
            seedFrontier(plan, source);
        plan.web = value.web.map(item => { const web = object(item), url = text(web.url, '网页来源', 2048), callId = text(web.callId, '网页调用 ID', 200), resultSeq = integer(web.resultSeq, '网页结果位置', 0, Number.MAX_SAFE_INTEGER), excerptHash = web.excerptHash; if (!/^https?:\/\//i.test(url) || !hex64(excerptHash))
            throw Error('网页低信任账本损坏'); return { url, callId, resultSeq, excerptHash: excerptHash as string }; });
        unique(plan.web, w => w.callId, '网页调用账本');
        if (plan.status === 'finished') {
            plan.finishedFingerprint = text(value.finishedFingerprint, '完成索引指纹', 300);
            plan.finishedAt = integer(value.finishedAt, '完成时间', 0, Number.MAX_SAFE_INTEGER);
        }
        else if (value.finishedFingerprint !== undefined || value.finishedAt !== undefined)
            throw Error('未完成研究不能带完成证明');
        return plan;
    }
    function load(owner: string, id: string) { const source = loadSource(owner, id), stored = table.get(planKey(owner, id)); if (stored == null)
        return null;
        // Reject a swapped record before validating owner-derived packet IDs, so a corrupted
        // owner can never be reported as a usable packet for this plan.
        const identity = object(stored);
        if (identity.owner !== owner || identity.sourceId !== id)
            throw Error('研究计划归属与当前原著不匹配');
        const plan = validatePlan(source, stored); return structuredClone(plan); }
    function baseRecord(source: AdaptationSource): {
        exists: boolean;
        base: ResearchBase;
    } {
        const stored = table.get(baseKey(source));
        if (stored == null)
            return { exists: false, base: { schemaVersion: 2, kind: 'original-research-base', textSha256: source.textSha256, rawSha256: source.rawSha256, revision: 0, entries: [] } };
        const value = object(stored);
        if (![1, 2].includes(Number(value.schemaVersion)) || value.kind !== 'original-research-base' || value.textSha256 !== source.textSha256 || value.rawSha256 !== source.rawSha256 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !Array.isArray(value.entries) || value.entries.length > 2000)
            throw Error('共享原著底稿损坏');
        const base: ResearchBase = { schemaVersion: 2, kind: 'original-research-base', textSha256: source.textSha256, rawSha256: source.rawSha256, revision: Number(value.revision), entries: value.entries.map(item => factFromStored(source, item, 'base')) };
        unique(base.entries, f => f.id, '共享原著事实 ID');
        return { exists: true, base: structuredClone(base) };
    }
    const base = (source: AdaptationSource) => baseRecord(source).base;
    const frontierId = (source: AdaptationSource, normalized: string) => hash(`${source.textSha256}\u0000${normalized}\u0000frontier-v1`);
    function queueFrontier(plan: ResearchPlan, source: AdaptationSource, query: string, sourceKind: FrontierSource, priority: number, parentFactIds: string[] = []) {
        const normalized = normalizedQuery(text(query, '探索查询', 1000));
        if (!normalized)
            return;
        const existing = plan.frontier.find(item => item.normalizedQuery === normalized);
        if (existing) {
            existing.priority = Math.max(existing.priority, priority);
            existing.parentFactIds = [...new Set([...existing.parentFactIds, ...parentFactIds])].slice(0, 8);
            return existing;
        }
        if (plan.frontier.length >= 256)
            throw Error('探索前沿达到 256 项上限；请完成、延期或删除已有问题后继续');
        const item: ResearchFrontier = { id: frontierId(source, normalized), query: text(query, '探索查询', 1000), normalizedQuery: normalized, source: sourceKind, state: 'pending', priority, parentFactIds: [...new Set(parentFactIds)].slice(0, 8), candidateRanges: [], attemptedFingerprints: [] };
        plan.frontier.push(item);
        return item;
    }
    function sampleSegments(source: AdaptationSource) {
        const count = Math.min(2, source.segments.length), seed = Number.parseInt(source.textSha256.slice(0, 8), 16);
        return [...new Set(Array.from({ length: count }, (_, i) => (seed + i * Math.max(1, Math.floor(source.segments.length / 2))) % source.segments.length))];
    }
    function seedFrontier(plan: ResearchPlan, source: AdaptationSource) {
        if (!plan.target.protagonist)
            return;
        queueFrontier(plan, source, `${plan.target.protagonist} 的身份、动机、关系、势力、限制与开局状态`, 'target', 100);
        queueFrontier(plan, source, `${plan.target.protagonist} 相关关键事件的起因、前置条件、阶段行动、结果与揭露`, 'target', 95);
        if (plan.target.openingPoint)
            queueFrontier(plan, source, `${plan.target.protagonist} 在${plan.target.openingPoint}前后的关系、选择与已知信息`, 'opening', 90);
        queueFrontier(plan, source, '世界规则、势力格局、主要人物关系与关键冲突', 'coverage', 70);
        for (const segment of sampleSegments(source)) {
            const chapter = source.segments[segment]?.chapter?.trim();
            if (chapter)
                queueFrontier(plan, source, `${chapter} 的主要人物、事件与因果`, 'coverage', 80);
        }
    }
    function queueFactEdges(plan: ResearchPlan, source: AdaptationSource, fact: ResearchFact) {
        for (const edge of fact.edges ?? [])
            queueFrontier(plan, source, `${edge.from} ${edge.relation} ${edge.to}`, 'relation', 85, [fact.id]);
    }
    function delivery(owner: string, source: AdaptationSource, plan: ResearchPlan, packets: ResearchPacket[]) {
        return { schemaVersion: 1 as const, owner, sourceId: source.id, textSha256: source.textSha256, generation: plan.generation, packetIds: packets.map(packet => packet.id) };
    }
    function currentPackets(plan: ResearchPlan, raw: unknown) {
        if (raw === undefined)
            return [] as ResearchPacket[];
        if (!Array.isArray(raw) || raw.length > 32 || raw.some(id => !hex64(id)))
            throw Error('source_packet_ids 需要 0–32 个交付包 ID');
        unique(raw as string[], id => id, 'source_packet_ids');
        return raw.map(id => {
            const packet = plan.packets.find(item => item.id === id && item.generation === plan.generation);
            if (!packet)
                throw Error('source_packet_ids 必须是当前研究 generation 已真正交付的原文包；请重新 query/read 后再确认');
            return packet;
        });
    }
    function checkpoint(owner: string, source: AdaptationSource, plan: ResearchPlan, packets: ResearchPacket[]) {
        return { ...delivery(owner, source, plan, packets), revision: plan.revision };
    }
    function acknowledgePackets(plan: ResearchPlan, packets: ResearchPacket[]) {
        for (const packet of packets) {
            const stored = plan.packets.find(item => item.id === packet.id && item.generation === plan.generation);
            if (stored)
                stored.acknowledged = true;
        }
    }
    function entries(owner: string, id: string) { const source = loadSource(owner, id), shared = base(source).entries, privateEntries = load(owner, id)?.entries ?? [], ids = new Set(shared.map(f => f.id)); for (const fact of privateEntries) {
        if (ids.has(fact.id))
            throw Error('私有研究条目与共享原著事实 ID 冲突');
        ids.add(fact.id);
    } return [...shared, ...privateEntries].map(f => structuredClone(f)); }
    function assess(owner: string, id: string) {
        const source = loadSource(owner, id), plan = load(owner, id), facts = entries(owner, id), verified = facts.filter(f => f.certainty === 'verified-original'), count = Math.min(10, source.segments.length);
        const bins = Array.from({ length: count }, (_, i) => { const first = Math.floor(i * source.segments.length / count), last = Math.floor((i + 1) * source.segments.length / count) - 1; return { id: i, startSegment: first, endSegment: last, covered: verified.some(f => f.citations.some(c => c.segment >= first && c.segment <= last)) }; }), categoryCoverage = categories.map(id => ({ id, covered: verified.some(f => f.category === id) })), target = plan?.target.protagonist ?? '', missing: string[] = [];
        if (!target)
            missing.push('指定重点主角');
        for (const category of categoryCoverage)
            if (!category.covered)
                missing.push(`全局 ${category.id} 原著证据`);
        for (const topic of topics)
            if (!verified.some(f => f.category === 'character' && f.entity === target && f.topic === topic))
                missing.push(`主角专题 ${topic}`);
        if (!verified.some(f => f.chain))
            missing.push('至少一条有完整原因/条件/行动/人物/结果/揭露证据的关键因果链');
        for (const bin of bins)
            if (!bin.covered)
                missing.push(`原著区间 ${bin.id + 1}/${count} 定向抽查`);
        const samples = sampleSegments(source);
        for (const segment of samples)
            if (!verified.some(f => f.citations.some(c => c.segment === segment)))
                missing.push(`独立抽样段 ${segment} 的证据条目`);
        const longitudinal=target?assessLongitudinal?.(source,target,verified):undefined;
        if(longitudinal)missing.push(...longitudinal.missing);
        return { ready: missing.length === 0, missing, bins, categories: categoryCoverage, samples,...(longitudinal?{longitudinal}:{}), caveat: '区间抽查、专题和因果证据达标不等于完整通读或无遗漏；原著未来事件不能覆盖当前世界线，读者获知章节不等于角色知情。' };
    }
    function view(owner: string, id: string) { const plan = load(owner, id); if (!plan)
        return undefined; const all = entries(owner, id), pending = plan.frontier.filter(item => item.state === 'pending').sort((a, b) => b.priority - a.priority || a.query.localeCompare(b.query)); return { schemaVersion: 2 as const, revision: plan.revision, mode: plan.mode, status: plan.status, target: structuredClone(plan.target), budget: structuredClone(plan.budget), coverage: assess(owner, id), frontier: { pending: pending.length, queried: plan.frontier.filter(item => item.state === 'queried').length, deferred: plan.frontier.filter(item => item.state === 'deferred').length, next: structuredClone(pending.slice(0, 4)), sampleSegments: sampleSegments(loadSource(owner, id)) }, entries: all.slice(0, 10).map(f => ({ id: f.id, category: f.category, statement: f.statement.slice(0, 400), certainty: f.certainty })), totalEntries: all.length }; }
    async function offer(owner: string, id: string, seq: number) { return lock(planKey(owner, id), async () => { if (load(owner, id))
        return view(owner, id); const source = loadSource(owner, id), plan: ResearchPlan = { schemaVersion: 2, kind: 'adaptation-research-plan', owner, sourceId: id, textSha256: source.textSha256, revision: 0, mode: null, status: 'choice-required', generation: randomUUID(), target: { protagonist: '', openingPoint: '' }, createdAt: Date.now(), startedSeq: integer(seq, '研究开始位置', -1, Number.MAX_SAFE_INTEGER), budget: { queryBatches: 0, maxQueryBatches: 7, readPackets: 0, maxReadPackets: 40 }, receipts: [], packets: [], queries: [], entries: [], frontier: [], web: [] }; validatePlan(source, plan); await table.put(planKey(owner, id), plan); return view(owner, id); }); }
    async function change(owner: string, id: string, revision: number, fn: (plan: ResearchPlan) => void) { return lock(planKey(owner, id), async () => { const source = loadSource(owner, id), plan = load(owner, id); if (!plan || plan.revision !== revision)
        throw Error('研究计划已变化，请刷新后重试'); fn(plan); plan.revision++; validatePlan(source, plan); await table.put(planKey(owner, id), plan); return view(owner, id); }); }
    async function select(owner: string, id: string, revision: number, mode: ReadingMode, protagonist = '', openingPoint = '') { if (!modes.includes(mode))
        throw Error('请选择精读或粗颗粒度'); return change(owner, id, revision, plan => { plan.mode = mode; plan.target = mode === 'coarse' ? { protagonist: text(protagonist, '重点主角', 200), openingPoint: text(openingPoint, '开局时间点', 500, true) } : { protagonist: '', openingPoint: '' }; if (mode === 'coarse')
            seedFrontier(plan, loadSource(owner, id)); plan.status = 'active'; plan.generation = randomUUID(); delete plan.finishedAt; delete plan.finishedFingerprint; }); }
    function active(owner: string, id: string) { const plan = load(owner, id); if (!plan || plan.mode !== 'coarse')
        throw Error('当前不是粗颗粒度改编'); if (plan.status !== 'active')
        throw Error('研究已暂停或完成，请明确恢复后继续'); return plan; }
    function assertGeneration(owner: string, id: string, generation: string) { const plan = load(owner, id); if (!plan || plan.generation !== generation || plan.status !== 'active')
        throw Error('研究计划已切换、暂停或取消，旧结果不再写入'); return plan; }
    async function reserve(owner: string, id: string, kind: 'queryBatches' | 'readPackets') { return lock(planKey(owner, id), async () => { const source = loadSource(owner, id), plan = active(owner, id), max = kind === 'queryBatches' ? 'maxQueryBatches' : 'maxReadPackets'; if (plan.budget[kind] >= plan.budget[max]) {
        plan.status = 'paused';
        plan.generation = randomUUID();
        plan.revision++;
        validatePlan(source, plan);
        await table.put(planKey(owner, id), plan);
        throw Error('研究预算已用完，进度保留；请在面板调整预算并恢复');
    } ; plan.budget[kind]++; plan.revision++; validatePlan(source, plan); await table.put(planKey(owner, id), plan); return plan.generation; }); }
    async function refundRead(owner: string, id: string, generation: string) { return lock(planKey(owner, id), async () => { const source = loadSource(owner, id), plan = assertGeneration(owner, id, generation); if (plan.budget.readPackets < 1)
        return; plan.budget.readPackets--; plan.revision++; validatePlan(source, plan); await table.put(planKey(owner, id), plan); }); }
    async function control(owner: string, id: string, revision: number, command: 'pause' | 'resume' | 'budget', input: Record<string, unknown> = {}) { if (!['pause', 'resume', 'budget'].includes(command))
        throw Error('未知研究控制操作'); return change(owner, id, revision, plan => { if (command === 'budget')
        for (const [field, max] of [['maxQueryBatches', 200], ['maxReadPackets', 500]] as const) {
            const used = field === 'maxQueryBatches' ? plan.budget.queryBatches : plan.budget.readPackets, n = input[field];
            if (!Number.isSafeInteger(n) || Number(n) < 1 || Number(n) > max || Number(n) < used)
                throw Error(`${field} 预算无效或低于已消费次数`);
            plan.budget[field] = Number(n);
        }
    else {
        if (!plan.mode)
            throw Error('请先选择阅读方式');
        if (plan.status === 'finished')
            throw Error('已完成研究不能恢复或暂停；重新选择模式会创建新一轮研究');
        plan.status = command === 'pause' ? 'paused' : 'active';
        plan.generation = randomUUID();
        delete plan.finishedAt;
        delete plan.finishedFingerprint;
    } }); }
    async function prepareQueries(owner: string, id: string, fingerprint: string, requested: string[] = [], mode: QueryRecord['mode'] = 'hybrid',visiblePacketIds?:ReadonlySet<string>) { return lock(planKey(owner, id), async () => {
        const source = loadSource(owner, id), plan = active(owner, id), checkedFingerprint = text(fingerprint, '检索指纹', 300);
        if (!queryModes.includes(mode))
            throw Error('研究查询模式无效');
        if (!Array.isArray(requested) || requested.length > 4)
            throw Error('研究查询需要 0–4 个问题');
        const before = plan.frontier.length;
        for (const query of requested) {
            if (typeof query !== 'string' || !query.trim() || query.length > 1000)
                throw Error('研究查询需要 1–1000 字符');
            queueFrontier(plan, source, query, 'manual', 75);
        }
        const completed = new Set(plan.queries.filter(item => item.fingerprint === checkedFingerprint && item.mode === mode
          &&(visiblePacketIds===undefined||item.ranges.every(range=>plan.packets.some(packet=>packet.segment===range.segment&&packet.start<=range.start&&packet.end>=range.end&&(packet.acknowledged||packet.generation===plan.generation&&visiblePacketIds.has(packet.id)))))).map(item => normalizedQuery(item.query)));
        // A tool query is one research round. Start with the protagonist seed so the
        // first delivery is reviewable; later rounds expand a bounded three-question
        // relation frontier. Callers may still supply fewer manual questions.
        const roundSize = plan.budget.queryBatches === 0 ? 1 : 3;
        const selected = plan.frontier.filter(item => item.state !== 'deferred' && !completed.has(item.normalizedQuery)).sort((a, b) => b.priority - a.priority || a.query.localeCompare(b.query)).slice(0, roundSize);
        if (!selected.length)
            throw Error('没有可执行的新研究问题；请读取定向抽样段、保存带引用的关系边，或由玩家恢复/扩大查询预算');
        if (plan.frontier.length !== before) {
            plan.revision++;
            validatePlan(source, plan);
            await table.put(planKey(owner, id), plan);
        }
        return structuredClone(selected);
    }); }
    function addPackets(plan:ResearchPlan,source:AdaptationSource,input:PacketWrite) {
        const {rows,query,fingerprint='keyword',seq=-1,frontierId,candidates=[],mode=fingerprint==='keyword'?'keyword':'semantic',completeQuery=true}=input;
        const generation=plan.generation;
        if (!Array.isArray(rows) || rows.length > 32 || !Array.isArray(candidates) || candidates.length > 30)
            throw Error('研究原文包数量无效');
        const nextRows = rows.map((row, index) => {
            const value = object(row), segment = integer(value.segment, `原文包 ${index + 1} 分段`, 0, source.segments.length - 1), part = source.segments[segment]!, start = integer(value.start, `原文包 ${index + 1} 起点`, part.start, part.end), end = integer(value.end, `原文包 ${index + 1} 终点`, start, part.end);
            if (start === end || typeof value.text !== 'string' || source.text.slice(start, end) !== value.text)
                throw Error('返回的原文范围或哈希不匹配');
            return { segment, start, end, sha256: hash(value.text) };
        });
        unique(nextRows, r => `${r.segment}:${r.start}:${r.end}`, '本次原文包');
        for (const receipt of nextRows)
            if (!plan.receipts.some(item => item.segment === receipt.segment && item.start === receipt.start && item.end === receipt.end))
                plan.receipts.push(receipt);
        const delivered = nextRows.map(receipt => ({ ...receipt, id: packetId(plan.owner, source, receipt), generation }));
        for (const packet of delivered)
            if (!plan.packets.some(item => item.id === packet.id && item.generation === packet.generation))
                plan.packets.push(packet);
        if (query !== undefined && completeQuery) {
        const storedQuery = text(query, '查询', 1000), storedFingerprint = text(fingerprint, '检索指纹', 300), key = `${normalizedQuery(storedQuery)}:${mode}:${storedFingerprint}`;
        if (!queryModes.includes(mode))
            throw Error('研究查询模式无效');
        const nextCandidates = candidates.map((candidate, index) => {
            const value = object(candidate), segment = integer(value.segment, `查询候选 ${index + 1} 分段`, 0, source.segments.length - 1), part = source.segments[segment]!, start = integer(value.start, `查询候选 ${index + 1} 起点`, part.start, part.end), end = integer(value.end, `查询候选 ${index + 1} 终点`, start, part.end);
            return candidateFromStored(source, { ...value, segment, start, end, sha256: hash(source.text.slice(start, end)) }, `查询候选 ${index + 1}`);
        });
        unique(nextCandidates, row => `${row.segment}:${row.start}:${row.end}`, '查询候选');
        if (!plan.queries.some(item => `${normalizedQuery(item.query)}:${item.mode}:${item.fingerprint}` === key))
            plan.queries.push({ query: storedQuery, fingerprint: storedFingerprint, mode, seq: integer(seq, '查询位置', -1, Number.MAX_SAFE_INTEGER), ranges: nextRows, candidates: nextCandidates });
        if (frontierId !== undefined) {
            const frontier = plan.frontier.find(item => item.id === frontierId);
            if (!frontier || frontier.normalizedQuery !== normalizedQuery(storedQuery))
                throw Error('探索前沿已变化，请重新获取下一批问题');
            frontier.state = 'queried';
            frontier.candidateRanges = nextCandidates;
            frontier.attemptedFingerprints = [...new Set([...frontier.attemptedFingerprints, `${mode}:${storedFingerprint}`])].slice(-20);
        }
        }
        return structuredClone(delivered);
    }
    async function recordBatch(owner:string,id:string,generation:string,requests:PacketWrite[],valid:()=>boolean=()=>true) {
      return lock(planKey(owner,id),async()=>{
        const before=assertGeneration(owner,id,generation),source=loadSource(owner,id),plan=structuredClone(before);
        if(!valid())throw Error('研究交付前对话、原著或计划已变化');
        if(!requests.length||requests.length>3)throw Error('研究批次需要 1–3 个查询结果');
        // All rows/frontiers validate on one private draft; no first-query
        // receipt survives a later query failing within this native tool call.
        const delivered=requests.map(input=>addPackets(plan,source,input));
        plan.receipts = plan.receipts.slice(-1000);
        plan.packets = plan.packets.slice(-1000);
        plan.queries = plan.queries.slice(-400);
        plan.revision++;
        validatePlan(source, plan);
        if(!valid())throw Error('研究交付前对话、原著或计划已变化');
        try {
          await table.put(planKey(owner,id),plan);
          if(!valid())throw Error('研究交付期间对话、原著或计划已变化；已撤回未交付回执');
        }catch(error){
          try{await table.put(planKey(owner,id),before)}catch(rollback){throw Error('研究交付保存失败且回滚未完成，请停止研究并检查存储',{cause:rollback})}
          throw error;
        }
        return delivered;
      });
    }
    async function recordPacket(owner:string,id:string,generation:string,rows:PacketWrite['rows'],query?:string,fingerprint='keyword',seq=-1,frontierId?:string,candidates:NonNullable<PacketWrite['candidates']>=[],mode:QueryRecord['mode']=fingerprint==='keyword'?'keyword':'semantic',completeQuery=true,valid:()=>boolean=()=>true) {
      return (await recordBatch(owner,id,generation,[{rows,query,fingerprint,seq,frontierId,candidates,mode,completeQuery}],valid))[0]!;
    }
    async function read(owner: string, id: string, segment: number, offset = 0, maxChars = 2400, valid: () => boolean = () => true) {
        if (!Number.isSafeInteger(segment) || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(maxChars) || maxChars < 256 || maxChars > 4000)
            throw Error('定向回读参数无效');
        const source = loadSource(owner, id), part = source.segments[segment];
        if (!part || part.start + offset >= part.end)
            throw Error('定向回读超出原文分段');
        const generation = await reserve(owner, id, 'readPackets'), start = part.start + offset, end = Math.min(part.end, start + maxChars), row = { segment, start, end, text: source.text.slice(start, end) };
        let delivered: ResearchPacket[];
        try {
            delivered = await recordPacket(owner, id, generation, [row], undefined, 'keyword', -1, undefined, [], 'keyword', true, valid);
        }
        catch (error) {
            try {
                await refundRead(owner, id, generation);
            }
            catch {
                throw Error('保存定向回读失败，且无法回滚本地阅读预算；请刷新后检查研究状态', { cause: error });
            }
            throw error;
        }
        const current = active(owner, id);
        return { ...row, chapter: part.chapter, nextOffset: end < part.end ? end - part.start : null, scope: '局部原文，不标为整段已读', researchDelivery: delivery(owner, source, current, delivered), research: view(owner, id) };
    }
    function citations(owner: string, id: string, raw: unknown): ResearchCitation[] { const source = loadSource(owner, id), plan = active(owner, id), result = resolveInputCitations(source,plan.receipts,raw); for (const cite of result)
        if (!plan.receipts.some(receipt => receipt.segment === cite.segment && receipt.start <= cite.start && receipt.end >= cite.end && hash(source.text.slice(receipt.start, receipt.end)) === receipt.sha256))
            throw Error('引用未由本计划实际查询/回读，或不属于该段原文'); return result; }
    async function append(owner: string, id: string, revision: number, raws: unknown[], sourcePacketIds: unknown = []) { const source = loadSource(owner, id); return lock(baseKey(source), async () => lock(planKey(owner, id), async () => {
        const plan = active(owner, id);
        if (plan.revision !== revision)
            throw Error('研究计划已变化，先刷新再保存');
        if (!Array.isArray(raws) || raws.length < 1 || raws.length > 8)
            throw Error('原著事实批量追加需要 1–8 条条目');
        const confirmed = currentPackets(plan, sourcePacketIds), facts = raws.map((raw, index) => {
            const input = object(raw);
            if (input.certainty !== 'verified-original' || input.id !== undefined)
                throw Error(`批量条目 ${index + 1} 只能追加不带 id 的 verified-original 原著事实`);
            const fact = sharedFact(source, resolveInputFact(source, plan.receipts, input));
            const citations = [...fact.citations, ...(fact.chain?.actions.flatMap(action => action.citations) ?? []), ...(fact.edges?.flatMap(edge => edge.citations) ?? [])];
            for (const cite of citations)
                if (!plan.receipts.some(receipt => receipt.segment === cite.segment && receipt.start <= cite.start && receipt.end >= cite.end && hash(source.text.slice(receipt.start, receipt.end)) === receipt.sha256))
                    throw Error('引用未由本计划实际查询/回读，或不属于该段原文');
            return fact;
        });
        const deduped = [...new Map(facts.map(fact => [fact.id, fact])).values()];
        const stored = baseRecord(source), additions: ResearchFact[] = [];
        for (const fact of deduped) {
            const existing = stored.base.entries.find(item => item.id === fact.id);
            if (existing && !sameFact(existing, fact))
                throw Error('共享原著事实 ID 冲突');
            if (!existing)
                additions.push(fact);
        }
        if (!additions.length) {
            if (confirmed.length) {
                const nextPlan = structuredClone(plan);
                acknowledgePackets(nextPlan, confirmed);
                nextPlan.revision++;
                validatePlan(source, nextPlan);
                await table.put(planKey(owner, id), nextPlan);
                return { ...view(owner, id)!, researchCheckpoint: checkpoint(owner, source, nextPlan, confirmed) };
            }
            return { ...view(owner, id)!, researchCheckpoint: checkpoint(owner, source, plan, confirmed) };
        }
        if (stored.base.entries.length + additions.length > 2000)
            throw Error('共享原著底稿达到条目上限');
        const nextPlan = structuredClone(plan), nextBase: ResearchBase = { ...stored.base, revision: stored.base.revision + 1, entries: [...stored.base.entries, ...additions] };
        for (const fact of additions)
            queueFactEdges(nextPlan, source, fact);
        acknowledgePackets(nextPlan, confirmed);
        nextPlan.revision++;
        validatePlan(source, nextPlan);
        await table.put(planKey(owner, id), nextPlan);
        try {
            await table.put(baseKey(source), nextBase);
        }
        catch (error) {
            let rollbackFailure: unknown;
            try {
                await table.put(planKey(owner, id), plan);
                if (stored.exists || !table.delete)
                    await table.put(baseKey(source), stored.base);
                else
                    await table.delete(baseKey(source));
            }
            catch (rollback) {
                rollbackFailure = rollback;
            }
            if (rollbackFailure)
                throw Error('共享原著事实保存失败，且回滚未完成；请停止写入并检查持久存储', { cause: rollbackFailure });
            throw error;
        }
        return { ...view(owner, id)!, researchCheckpoint: checkpoint(owner, source, nextPlan, confirmed) };
    })); }
    async function save(owner: string, id: string, revision: number, raw: unknown, sourcePacketIds: unknown = []) { const source = loadSource(owner, id), input = object(raw), certainty = input.certainty;
        if (!['verified-original', 'unknown'].includes(String(certainty)))
            throw Error('请选择 verified-original 或 unknown；网络资料不能直接成为原著事实');
        if (certainty === 'verified-original') {
            const { id: _ignored, ...withoutId } = input;
            return append(owner, id, revision, [withoutId], sourcePacketIds);
        }
        return lock(planKey(owner, id), async () => {
            const plan = active(owner, id);
            if (plan.revision !== revision)
                throw Error('研究计划已变化，先刷新再保存');
            if (sourcePacketIds !== undefined && (!Array.isArray(sourcePacketIds) || sourcePacketIds.length))
                throw Error('unknown 条目不能确认整个原文包；只有成功保存的 verified-original 事实可提交 source_packet_ids');
            const requested = typeof input.id === 'string' && hex64(input.id) ? input.id : undefined, existing = requested ? plan.entries.find(f => f.id === requested) : undefined, fact = privateFact(source, input, existing?.id ?? hash(randomUUID()));
            if (plan.entries.length >= 250 && !existing)
                throw Error('本研究条目达到 250 项上限');
            const next = structuredClone(plan);
            next.entries = next.entries.filter(f => f.id !== fact.id).concat(fact);
            queueFrontier(next, source, fact.statement, 'unknown', 65, []);
            next.revision++;
            validatePlan(source, next);
            await table.put(planKey(owner, id), next);
            return view(owner, id);
        });
    }
    async function finish(owner: string, id: string, fingerprint: string) { return lock(planKey(owner, id), async () => { const source = loadSource(owner, id), plan = load(owner, id); if (!plan || plan.mode !== 'coarse')
        throw Error('当前不是粗颗粒度改编'); const checked = text(fingerprint, '完成索引指纹', 300); if (plan.status === 'paused')
        throw Error('研究已暂停，请明确恢复后再完成'); if (plan.status === 'finished' && plan.finishedFingerprint === checked)
        return view(owner, id); if (plan.status !== 'active' && plan.status !== 'finished')
        throw Error('研究尚未启动'); const coverage = assess(owner, id); if (!coverage.ready)
        throw Error('粗颗粒度研究缺项：' + coverage.missing.join('；')); plan.status = 'finished'; plan.finishedFingerprint = checked; plan.finishedAt = Date.now(); plan.revision++; validatePlan(source, plan); await table.put(planKey(owner, id), plan); return view(owner, id); }); }
    return { load, view, offer, select, control, active, reserve, prepareQueries, recordPacket, recordBatch, read, save, append, finish, entries, assess, assertGeneration };
}
