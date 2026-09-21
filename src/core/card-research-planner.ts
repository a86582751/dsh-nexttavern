export type { ReadingMode, ResearchCitation, ResearchEdge, ResearchFact } from './card-research-record.js';
import type {
  ReadingMode,
  ResearchCitation,
  ResearchFact,
  ResearchPacket,
  PacketWrite,
  QueryRecord,
  ResearchPlan,
  ResearchBase,
} from './card-research-record.js';
import {
  hash,
  categories,
  topics,
  modes,
  queryModes,
  hex64,
  object,
  text,
  integer,
  unique,
  normalizedQuery,
  resolveInputCitations,
  resolveInputFact,
  factFromStored,
  privateFact,
  sharedFact,
  sameFact,
  validatePlan,
  frontierId,
  queueFrontier,
  sampleSegments,
  seedFrontier,
  queueFactEdges,
  delivery,
  currentPackets,
  checkpoint,
  acknowledgePackets,
  addPackets,
} from './card-research-record.js';
import { randomUUID } from 'node:crypto';
import type { AdaptationSource, AdaptationTable } from './card-adaptation.js';
const planKey = (owner: string, id: string) => `adaptation-research-${hash(owner)}-${id}`;
// Evidence coordinates belong to the decoded text. Equal raw bytes decoded under a different
// explicit encoding therefore cannot share a fact base, even though their source file matches.
const baseKey = (s: AdaptationSource) => `adaptation-research-base-${hash(s.rawSha256 + ':' + s.textSha256 + ':v1')}`;
const locks = new Map<string, Promise<unknown>>();
async function lock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const p = (locks.get(key) ?? Promise.resolve()).catch(() => {
  }).then(work);
  locks.set(key, p);
  try {
    return await p;
  }
  finally {
    if (locks.get(key) === p)
      locks.delete(key);
  }
}
/** Original evidence is shared; protagonist, opening choice and unknowns remain owner-local. */
export function createResearchPlanner(
  table: AdaptationTable,
  loadSource: (owner: string, id: string) => AdaptationSource,
  assessLongitudinal?: (source: AdaptationSource, target: string, facts: ResearchFact[]) => {
    missing: string[];
    [key: string]: unknown;
  }) {
  function load(owner: string, id: string) {
    const source = loadSource(owner, id), stored = table.get(planKey(owner, id));
    if (stored == null)
      return null;
    // Reject a swapped record before validating owner-derived packet IDs, so a corrupted
    // owner can never be reported as a usable packet for this plan.
    const identity = object(stored);
    if (identity.owner !== owner || identity.sourceId !== id)
      throw Error('研究计划归属与当前原著不匹配');
    const plan = validatePlan(source, stored);
    return structuredClone(plan);
  }
  function baseRecord(source: AdaptationSource): {
    exists: boolean;
    base: ResearchBase;
  } {
    const stored = table.get(baseKey(source));
    if (stored == null)
      return {
        exists: false,
        base: {
          schemaVersion: 2,
          kind: 'original-research-base',
          textSha256: source.textSha256,
          rawSha256: source.rawSha256,
          revision: 0,
          entries: []
        }
      };
    const value = object(stored);
    if (![1, 2].includes(Number(value.schemaVersion)) || value.kind !== 'original-research-base' || value.textSha256 !== source.textSha256



      || value.rawSha256 !== source.rawSha256
      || !Number.isSafeInteger(value.revision)
      || Number(value.revision) < 0
      || !Array.isArray(value.entries)
      || value.entries.length > 2000)
      throw Error('共享原著底稿损坏');
    const base: ResearchBase = {
      schemaVersion: 2,
      kind: 'original-research-base',
      textSha256: source.textSha256,
      rawSha256: source.rawSha256,
      revision: Number(value.revision),
      entries: value.entries.map(item => factFromStored(source, item, 'base'))
    };
    unique(base.entries, f => f.id, '共享原著事实 ID');
    return {
      exists: true, base: structuredClone(base)
    };
  }
  const base = (source: AdaptationSource) => baseRecord(source).base;
  function entries(owner: string, id: string) {
    const source = loadSource(owner, id),
      shared = base(source).entries,
      privateEntries = load(owner, id)?.entries ?? [],
      ids = new Set(shared.map(f => f.id));
    for (const fact of privateEntries) {
      if (ids.has(fact.id))
        throw Error('私有研究条目与共享原著事实 ID 冲突');
      ids.add(fact.id);
    }
    return [...shared, ...privateEntries].map(f => structuredClone(f));
  }
  function assess(owner: string, id: string) {
    const source = loadSource(
      owner,
      id),
      plan = load(
        owner,
        id),
      facts = entries(
        owner,
        id),
      verified = facts.filter(
        f => f.certainty === 'verified-original'),
      count = Math.min(
        10,
        source.segments.length);
    const bins = Array.from(
      {
        length: count
      },
      (_, i) => {
        const first = Math.floor(i * source.segments.length / count), last = Math.floor((i + 1) * source.segments.length / count) - 1;
        return {
          id: i,
          startSegment: first,
          endSegment: last,
          covered: verified.some(f => f.citations.some(c => c.segment >= first && c.segment <= last))
        };
      }),
      categoryCoverage = categories.map(id => ({
        id, covered: verified.some(f => f.category === id)
      })),
      target = plan?.target.protagonist ?? '',
      missing: string[] = [];
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
    const longitudinal = target ? assessLongitudinal?.(source, target, verified) : undefined;
    if (longitudinal)
      missing.push(...longitudinal.missing);
    return {
      ready: missing.length === 0,
      missing,
      bins,
      categories: categoryCoverage,
      samples,
      ...(longitudinal ? {
        longitudinal
      } : {}),
      caveat: '区间抽查、专题和因果证据达标不等于完整通读或无遗漏；原著未来事件不能覆盖当前世界线，读者获知章节不等于角色知情。'
    };
  }
  function view(owner: string, id: string) {
    const plan = load(owner, id);
    if (!plan)
      return undefined;
    const all = entries(
      owner,
      id),
      pending = plan.frontier.filter(
        item => item.state === 'pending').sort(
          (a, b) => b.priority - a.priority
            || a.query.localeCompare(
              b.query));
    return {
      schemaVersion: 2 as const,
      revision: plan.revision,
      mode: plan.mode,
      status: plan.status,
      target: structuredClone(plan.target),
      budget: structuredClone(plan.budget),
      coverage: assess(owner, id),
      frontier: {
        pending: pending.length,
        queried: plan.frontier.filter(item => item.state === 'queried').length,
        deferred: plan.frontier.filter(item => item.state === 'deferred').length,
        next: structuredClone(pending.slice(0, 4)),
        sampleSegments: sampleSegments(loadSource(owner, id))
      },
      entries: all.slice(0, 10).map(
        f => ({
          id: f.id, category: f.category, statement: f.statement.slice(0, 400), certainty: f.certainty
        })),
      totalEntries: all.length
    };
  }
  async function offer(owner: string, id: string, seq: number) {
    return lock(
      planKey(owner, id),
      async () => {
        if (load(owner, id))
          return view(owner, id);
        const source = loadSource(owner, id),
          plan: ResearchPlan = {
            schemaVersion: 2,
            kind: 'adaptation-research-plan',
            owner,
            sourceId: id,
            textSha256: source.textSha256,
            revision: 0,
            mode: null,
            status: 'choice-required',
            generation: randomUUID(),
            target: {
              protagonist: '', openingPoint: ''
            },
            createdAt: Date.now(),
            startedSeq: integer(seq, '研究开始位置', -1, Number.MAX_SAFE_INTEGER),
            budget: {
              queryBatches: 0, maxQueryBatches: 7, readPackets: 0, maxReadPackets: 40
            },
            receipts: [],
            packets: [],
            queries: [],
            entries: [],
            frontier: [],
            web: []
          };
        validatePlan(source, plan);
        await table.put(planKey(owner, id), plan);
        return view(owner, id);
      });
  }
  async function change(owner: string, id: string, revision: number, fn: (plan: ResearchPlan) => void) {
    return lock(
      planKey(owner, id),
      async () => {
        const source = loadSource(owner, id), plan = load(owner, id);
        if (!plan || plan.revision !== revision)
          throw Error('研究计划已变化，请刷新后重试');
        fn(plan);
        plan.revision++;
        validatePlan(source, plan);
        await table.put(planKey(owner, id), plan);
        return view(owner, id);
      });
  }
  async function select(owner: string, id: string, revision: number, mode: ReadingMode, protagonist = '', openingPoint = '') {
    if (!modes.includes(mode))
      throw Error('请选择精读或粗颗粒度');
    return change(
      owner,
      id,
      revision,
      plan => {
        plan.mode = mode;
        plan.target = mode === 'coarse'



          ? {
            protagonist: text(protagonist, '重点主角', 200), openingPoint: text(openingPoint, '开局时间点', 500, true)
          } : {
            protagonist: '', openingPoint: ''
          };
        if (mode === 'coarse')
          seedFrontier(plan, loadSource(owner, id));
        plan.status = 'active';
        plan.generation = randomUUID();
        delete plan.finishedAt;
        delete plan.finishedFingerprint;
      });
  }
  function active(owner: string, id: string) {
    const plan = load(owner, id);
    if (!plan || plan.mode !== 'coarse')
      throw Error('当前不是粗颗粒度改编');
    if (plan.status !== 'active')
      throw Error('研究已暂停或完成，请明确恢复后继续');
    return plan;
  }
  function assertGeneration(owner: string, id: string, generation: string) {
    const plan = load(owner, id);
    if (!plan || plan.generation !== generation || plan.status !== 'active')
      throw Error('研究计划已切换、暂停或取消，旧结果不再写入');
    return plan;
  }
  async function reserve(owner: string, id: string, kind: 'queryBatches' | 'readPackets') {
    return lock(
      planKey(owner, id),
      async () => {
        const source = loadSource(owner, id), plan = active(owner, id), max = kind === 'queryBatches' ? 'maxQueryBatches' : 'maxReadPackets';
        if (plan.budget[kind] >= plan.budget[max]) {
          plan.status = 'paused';
          plan.generation = randomUUID();
          plan.revision++;
          validatePlan(source, plan);
          await table.put(planKey(owner, id), plan);
          throw Error('研究预算已用完，进度保留；请在面板调整预算并恢复');
        }
        ;
        plan.budget[kind]++;
        plan.revision++;
        validatePlan(source, plan);
        await table.put(planKey(owner, id), plan);
        return plan.generation;
      });
  }
  async function refundRead(owner: string, id: string, generation: string) {
    return lock(
      planKey(owner, id),
      async () => {
        const source = loadSource(owner, id), plan = assertGeneration(owner, id, generation);
        if (plan.budget.readPackets < 1)
          return;
        plan.budget.readPackets--;
        plan.revision++;
        validatePlan(source, plan);
        await table.put(planKey(owner, id), plan);
      });
  }
  async function control(
    owner: string,
    id: string,
    revision: number,
    command: 'pause' | 'resume' | 'budget',
    input: Record<string, unknown> = {}) {
    if (!['pause', 'resume', 'budget'].includes(command))
      throw Error('未知研究控制操作');
    return change(
      owner,
      id,
      revision,
      plan => {
        if (command === 'budget')
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
        }
      });
  }
  async function prepareQueries(
    owner: string,
    id: string,
    fingerprint: string,
    requested: string[] = [],
    mode: QueryRecord['mode'] = 'hybrid',
    visiblePacketIds?: ReadonlySet<string>) {
    return lock(
      planKey(owner, id),
      async () => {
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
        const completed = new Set(
          plan.queries.filter(
            item => item.fingerprint === checkedFingerprint && item.mode === mode




              && (visiblePacketIds === undefined



                || item.ranges.every(
                  range => plan.packets.some(
                    packet => packet.segment === range.segment && packet.start <= range.start && packet.end >= range.end



                      && (packet.acknowledged || packet.generation === plan.generation && visiblePacketIds.has(packet.id)))))).map(
                        item => normalizedQuery(item.query)));
        // A tool query is one research round. Start with the protagonist seed so the
        // first delivery is reviewable; later rounds expand a bounded three-question
        // relation frontier. Callers may still supply fewer manual questions.
        const roundSize = plan.budget.queryBatches === 0 ? 1 : 3;
        const selected = plan.frontier.filter(item => item.state !== 'deferred' && !completed.has(item.normalizedQuery)).sort(
          (a, b) => b.priority - a.priority || a.query.localeCompare(b.query)).slice(
            0,
            roundSize);
        if (!selected.length)
          throw Error('没有可执行的新研究问题；请读取定向抽样段、保存带引用的关系边，或由玩家恢复/扩大查询预算');
        if (plan.frontier.length !== before) {
          plan.revision++;
          validatePlan(source, plan);
          await table.put(planKey(owner, id), plan);
        }
        return structuredClone(selected);
      });
  }
  async function recordBatch(owner: string, id: string, generation: string, requests: PacketWrite[], valid: () => boolean = () => true) {
    return lock(
      planKey(owner, id),
      async () => {
        const before = assertGeneration(owner, id, generation), source = loadSource(owner, id), plan = structuredClone(before);
        if (!valid())
          throw Error('研究交付前对话、原著或计划已变化');
        if (!requests.length || requests.length > 3)
          throw Error('研究批次需要 1–3 个查询结果');
        // All rows/frontiers validate on one private draft; no first-query
        // receipt survives a later query failing within this native tool call.
        const delivered = requests.map(input => addPackets(plan, source, input));
        plan.receipts = plan.receipts.slice(-1000);
        plan.packets = plan.packets.slice(-1000);
        plan.queries = plan.queries.slice(-400);
        plan.revision++;
        validatePlan(source, plan);
        if (!valid())
          throw Error('研究交付前对话、原著或计划已变化');
        try {
          await table.put(planKey(owner, id), plan);
          if (!valid())
            throw Error('研究交付期间对话、原著或计划已变化；已撤回未交付回执');
        }
        catch (error) {
          try {
            await table.put(planKey(owner, id), before);
          }
          catch (rollback) {
            throw Error('研究交付保存失败且回滚未完成，请停止研究并检查存储', {
              cause: rollback
            });
          }
          throw error;
        }
        return delivered;
      });
  }
  async function recordPacket(
    owner: string,
    id: string,
    generation: string,
    rows: PacketWrite['rows'],
    query?: string,
    fingerprint = 'keyword',
    seq = -1,
    frontierId?: string,
    candidates: NonNullable<PacketWrite['candidates']> = [],
    mode: QueryRecord['mode'] = fingerprint === 'keyword'
      ? 'keyword'
      : 'semantic',
    completeQuery = true,
    valid: () => boolean = () => true) {
    return (await recordBatch(
      owner,
      id,
      generation,
      [{
        rows, query, fingerprint, seq, frontierId, candidates, mode, completeQuery
      }],
      valid))[0]!;
  }
  async function read(owner: string, id: string, segment: number, offset = 0, maxChars = 2400, valid: () => boolean = () => true) {
    if (!Number.isSafeInteger(segment) || !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(maxChars) || maxChars < 256



      || maxChars > 4000)
      throw Error('定向回读参数无效');
    const source = loadSource(owner, id), part = source.segments[segment];
    if (!part || part.start + offset >= part.end)
      throw Error('定向回读超出原文分段');
    const generation = await reserve(owner, id, 'readPackets'),
      start = part.start + offset,
      end = Math.min(part.end, start + maxChars),
      row = {
        segment, start, end, text: source.text.slice(start, end)
      };
    let delivered: ResearchPacket[];
    try {
      delivered = await recordPacket(owner, id, generation, [row], undefined, 'keyword', -1, undefined, [], 'keyword', true, valid);
    }
    catch (error) {
      try {
        await refundRead(owner, id, generation);
      }
      catch {
        throw Error('保存定向回读失败，且无法回滚本地阅读预算；请刷新后检查研究状态', {
          cause: error
        });
      }
      throw error;
    }
    const current = active(owner, id);
    return {
      ...row,
      chapter: part.chapter,
      nextOffset: end < part.end ? end - part.start : null,
      scope: '局部原文，不标为整段已读',
      researchDelivery: delivery(owner, source, current, delivered),
      research: view(owner, id)
    };
  }
  function citations(owner: string, id: string, raw: unknown): ResearchCitation[] {
    const source = loadSource(owner, id), plan = active(owner, id), result = resolveInputCitations(source, plan.receipts, raw);
    for (const cite of result)
      if (!plan.receipts.some(
        receipt => receipt.segment === cite.segment && receipt.start <= cite.start && receipt.end >= cite.end



          && hash(source.text.slice(receipt.start, receipt.end)) === receipt.sha256))
        throw Error('引用未由本计划实际查询/回读，或不属于该段原文');
    return result;
  }
  async function append(owner: string, id: string, revision: number, raws: unknown[], sourcePacketIds: unknown = []) {
    const source = loadSource(owner, id);
    return lock(
      baseKey(source),
      async () => lock(
        planKey(owner, id),
        async () => {
          const plan = active(owner, id);
          if (plan.revision !== revision)
            throw Error('研究计划已变化，先刷新再保存');
          if (!Array.isArray(raws) || raws.length < 1 || raws.length > 8)
            throw Error('原著事实批量追加需要 1–8 条条目');
          const confirmed = currentPackets(plan, sourcePacketIds),
            facts = raws.map(
              (raw, index) => {
                const input = object(raw);
                if (input.certainty !== 'verified-original' || input.id !== undefined)
                  throw Error(`批量条目 ${index + 1} 只能追加不带 id 的 verified-original 原著事实`);
                const fact = sharedFact(source, resolveInputFact(source, plan.receipts, input));
                const citations = [
                  ...fact.citations,
                  ...(fact.chain?.actions.flatMap(action => action.citations) ?? []),
                  ...(fact.edges?.flatMap(edge => edge.citations) ?? [])
                ];
                for (const cite of citations)
                  if (!plan.receipts.some(
                    receipt => receipt.segment === cite.segment && receipt.start <= cite.start && receipt.end >= cite.end



                      && hash(source.text.slice(receipt.start, receipt.end)) === receipt.sha256))
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
              return {
                ...view(owner, id)!, researchCheckpoint: checkpoint(owner, source, nextPlan, confirmed)
              };
            }
            return {
              ...view(owner, id)!, researchCheckpoint: checkpoint(owner, source, plan, confirmed)
            };
          }
          if (stored.base.entries.length + additions.length > 2000)
            throw Error('共享原著底稿达到条目上限');
          const nextPlan = structuredClone(plan),
            nextBase: ResearchBase = {
              ...stored.base, revision: stored.base.revision + 1, entries: [...stored.base.entries, ...additions]
            };
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
              throw Error('共享原著事实保存失败，且回滚未完成；请停止写入并检查持久存储', {
                cause: rollbackFailure
              });
            throw error;
          }
          return {
            ...view(owner, id)!, researchCheckpoint: checkpoint(owner, source, nextPlan, confirmed)
          };
        }));
  }
  async function save(owner: string, id: string, revision: number, raw: unknown, sourcePacketIds: unknown = []) {
    const source = loadSource(owner, id), input = object(raw), certainty = input.certainty;
    if (!['verified-original', 'unknown'].includes(String(certainty)))
      throw Error('请选择 verified-original 或 unknown；网络资料不能直接成为原著事实');
    if (certainty === 'verified-original') {
      const { id: _ignored, ...withoutId } = input;
      return append(owner, id, revision, [withoutId], sourcePacketIds);
    }
    return lock(
      planKey(owner, id),
      async () => {
        const plan = active(owner, id);
        if (plan.revision !== revision)
          throw Error('研究计划已变化，先刷新再保存');
        if (sourcePacketIds !== undefined && (!Array.isArray(sourcePacketIds) || sourcePacketIds.length))
          throw Error('unknown 条目不能确认整个原文包；只有成功保存的 verified-original 事实可提交 source_packet_ids');
        const requested = typeof input.id === 'string'
          && hex64(
            input.id)
          ? input.id
          : undefined,
          existing = requested
            ? plan.entries.find(
              f => f.id === requested)
            : undefined,
          fact = privateFact(
            source,
            input,
            existing?.id
            ?? hash(
              randomUUID()));
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
  async function finish(owner: string, id: string, fingerprint: string) {
    return lock(
      planKey(owner, id),
      async () => {
        const source = loadSource(owner, id), plan = load(owner, id);
        if (!plan || plan.mode !== 'coarse')
          throw Error('当前不是粗颗粒度改编');
        const checked = text(fingerprint, '完成索引指纹', 300);
        if (plan.status === 'paused')
          throw Error('研究已暂停，请明确恢复后再完成');
        if (plan.status === 'finished' && plan.finishedFingerprint === checked)
          return view(owner, id);
        if (plan.status !== 'active' && plan.status !== 'finished')
          throw Error('研究尚未启动');
        const coverage = assess(owner, id);
        if (!coverage.ready)
          throw Error('粗颗粒度研究缺项：' + coverage.missing.join('；'));
        plan.status = 'finished';
        plan.finishedFingerprint = checked;
        plan.finishedAt = Date.now();
        plan.revision++;
        validatePlan(source, plan);
        await table.put(planKey(owner, id), plan);
        return view(owner, id);
      });
  }
  return {
    load,
    view,
    offer,
    select,
    control,
    active,
    reserve,
    prepareQueries,
    recordPacket,
    recordBatch,
    read,
    save,
    append,
    finish,
    entries,
    assess,
    assertGeneration
  };
}
