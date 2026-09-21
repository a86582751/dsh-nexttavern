// Keep the model-facing schemas together. Allocate per registration, preserving
// the former isolation between plugin instances and all descriptions/limits.
export function createAdaptationToolSchemas() {
    const source = {
        source_id: {
            type: 'string', pattern: '^[a-f0-9]{64}$'
        }
    }, cursor = {
        cursor: {
            type: 'integer', minimum: 0
        }
    };
    const researchCitation = {
        type: 'object', description: '本次 query/read 返回原文中的逐字引用；程序按 segment 与 quote 定位 start/end/hash，不要自行计算偏移。', properties: {
            segment: {
                type: 'integer', minimum: 0, description: '原文分段编号。'
            }, start: {
                type: 'integer', minimum: 0, description: '可选的 UTF-16 起点；只有在本次返回原文中明确可见且唯一时提供。'
            }, quote: {
                type: 'string', minLength: 6, maxLength: 500, description: '从本次返回原文逐字复制的连续短句，保留标点、简繁与空格。'
            }
        }, required: ['segment', 'quote'], additionalProperties: false
    };
    const researchChain = {
        type: 'object', description: '关键事件的原著因果链；每个阶段行动都必须有本次已返回原文的 citations。', properties: {
            cause: {
                type: 'string', minLength: 1, maxLength: 1600, description: '促成事件发生的原著起因。'
            }, preconditions: {
                type: 'string', minLength: 1, maxLength: 1600, description: '事件成立前必须满足的原著前置条件。'
            }, actions: {
                type: 'array', minItems: 1, maxItems: 8, description: '按原著顺序排列的阶段行动。', items: {
                    type: 'object', properties: {
                        summary: {
                            type: 'string', minLength: 1, maxLength: 800, description: '一个阶段的原著行动摘要。'
                        }, citations: {
                            type: 'array', minItems: 1, maxItems: 6, items: researchCitation, description: '该阶段行动的逐字原文引用。'
                        }
                    }, required: ['summary', 'citations'], additionalProperties: false
                }
            }, people: {
                type: 'string', minLength: 1, maxLength: 500, description: '参与、推动或承受该因果链的原著人物。'
            }, result: {
                type: 'string', minLength: 1, maxLength: 1600, description: '原著中实际发生的结果。'
            }, reveal: {
                type: 'string', minLength: 1, maxLength: 800, description: '原著揭露位置以及谁在何时具备该知情。'
            }
        }, required: ['cause', 'preconditions', 'actions', 'people', 'result', 'reveal'], additionalProperties: false
    };
    const researchEdge = {
        type: 'object', description: '可复用的原著关系边；不是玩家世界线事实。', properties: {
            from: {
                type: 'string', minLength: 1, maxLength: 200, description: '关系起点人物、势力或对象。'
            }, relation: {
                type: 'string', minLength: 1, maxLength: 200, description: '原著明确表达的关系。'
            }, to: {
                type: 'string', minLength: 1, maxLength: 200, description: '关系终点人物、势力或对象。'
            }, citations: {
                type: 'array', minItems: 1, maxItems: 6, items: researchCitation, description: '证明该关系边的逐字原文引用。'
            }
        }, required: ['from', 'relation', 'to', 'citations'], additionalProperties: false
    };
    const researchEntry = {
        type: 'object',
        description: '研究事实。category、statement、certainty、storyOccursAt、readerRevealedAt、characterKnowledge 是保存所需字段；character 还必须提供 entity 与 topic。certainty=unknown 仅保存当前研究的私有未知项，可用合法既有 id 编辑，不能带 citations、chain、edges 或 source_packet_ids；certainty=verified-original 表示原著已核实事实，必须有 citations，save 会转为共享追加并忽略 id，append 的 entries 不得带 id。',
        properties: {
            id: {
                type: 'string', pattern: '^[a-f0-9]{64}$', description: '仅 unknown 编辑时填写既有条目 ID；append 不得填写，verified save 会忽略。'
            }, category: {
                type: 'string', enum: ['world', 'rule', 'faction', 'relation', 'event', 'character'], description: '研究条目类别。'
            }, statement: {
                type: 'string', minLength: 1, maxLength: 1600, description: '原著事实或待核实研究陈述。'
            }, certainty: {
                type: 'string', enum: ['verified-original', 'unknown'], description: 'verified-original 必须有当前原文引用；unknown 是无原著证据的私有研究项。'
            }, entity: {
                type: 'string', minLength: 1, maxLength: 200, description: '仅 character 使用：原著人物实体名称。'
            }, topic: {
                type: 'string',
                enum: ['identity', 'motive', 'relations', 'affiliation', 'limits', 'turning-point', 'opening'],
                description: '仅 character 使用：人物专题。'
            }, citations: {
                type: 'array', minItems: 1, maxItems: 6, items: researchCitation, description: 'verified-original 的共享事实引用；必须来自本次 query/read 已返回原文。unknown 不得提供。'
            }, storyOccursAt: {
                type: 'string', minLength: 1, maxLength: 300, description: '事件在原著世界中的发生时间或位置；区别于读者何时得知；无法确定请明确写“未知”。'
            }, readerRevealedAt: {
                type: 'string', minLength: 1, maxLength: 300, description: '读者在原著何处、何时得知该事实；无法确定请明确写“未知”。'
            }, characterKnowledge: {
                type: 'string', minLength: 1, maxLength: 600, description: '哪些角色在何种条件下知道，不能把读者已知当作角色已知；无法确定请明确写“未知”。'
            }, chain: researchChain, edges: {
                type: 'array', minItems: 1, maxItems: 8, items: researchEdge, description: '可选的原著关系边集合；每条边都必须有本次已返回原文引用。'
            }
        }, required: ['category', 'statement', 'certainty', 'storyOccursAt', 'readerRevealedAt', 'characterKnowledge'], additionalProperties: false
    };
    const researchEntries = {
        type: 'array',
        minItems: 1,
        maxItems: 8,
        description: 'append 专用：1–8 条不带 id 的 verified-original 事实；每条必须含完整字段、citations，character 还需 entity/topic。',
        items: {
            ...researchEntry, properties: {
                ...Object.fromEntries(Object.entries(researchEntry.properties).filter(([key]) => key !== 'id')), certainty: {
                    type: 'string', enum: ['verified-original'], description: 'append 只能追加已由本次原文引用核实的共享原著事实。'
                }
            }, required: [
                'category', 'statement', 'certainty', 'citations', 'storyOccursAt', 'readerRevealedAt', 'characterKnowledge'
            ]
        }
    };
    const target = {
        protagonist: {
            type: 'string', maxLength: 200, description: '复用玩家已确认的改编主角；未知留空，不凭空代选。'
        }, opening_point: {
            type: 'string', maxLength: 500, description: '复用已有偏好问卷中玩家确认的开局位置；未知可留空。'
        }
    };
    return {
        source, cursor, researchEntry, researchEntries, target
    };
}
