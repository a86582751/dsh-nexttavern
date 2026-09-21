import { randomUUID } from 'node:crypto'
import { keyOf, durableSeq, provenanceSeq, rollLogEntries, rollLogRecord, recordSha256 } from './roleplay-data.js'
import { eventsOf, surfaceEntries, visibleCompactionCheckpoint } from './roleplay-context.js'
import { importActiveKey } from './roleplay-import.js'
import type { InheritanceDependencies, InheritanceSession, InheritanceOptions } from './roleplay-inheritance-types.js'
import type { DirectorNotes } from '../memory/memory-history.js'

export function createRoleplayInheritance(deps: InheritanceDependencies) {
  const { ensureState, cloneBranchRecord, T, clusterLoreVisible, contextWindowKey, cloneContextWindow, ctx, statusSource, statusFixedContext } = deps
  async function ensureBranch(session: InheritanceSession, { cadenceAnchorSeq = null, cadenceTurn = null }: InheritanceOptions = {}) {
    const st = ensureState(session.id)
    if (st.branchReady) return
    if (st.branchPreparing) {
      await st.branchPreparing
      return
    }
    st.branchPreparing = (async () => {
      try {
        const parent = session.header?.parentSession
        if (parent) {
            const meta = cloneBranchRecord(T.branch.get(keyOf(session.id, 'meta')))
            // A previous process can die after writing a provisional marker.
            // Existence alone is not an inheritance commit: only the explicit
            // ready marker permits skipping the copy/replay pass.
            const expectedSeedLength = Number.isSafeInteger(session.inheritedEventCount)
              ? Number(session.inheritedEventCount)
              : null
            const inheritanceReady = meta?.inheritanceState === 'ready'
              && String(meta?.inheritedFrom ?? '') === String(parent)
              && (meta?.inheritedAtSeedLength ?? null) === expectedSeedLength
            if (!inheritanceReady) {
            const pPrefix = `${parent}__`
            const cP = `${session.id}__`
            const seedLength = Number.isSafeInteger(session.inheritedEventCount)
              ? Number(session.inheritedEventCount)
              : Number.POSITIVE_INFINITY
            const beforeSeed = (seq: unknown) => {
              const value = durableSeq(seq)
              return value !== null && Number.isFinite(seedLength) && value < seedLength
            }
            const beforeSeedRecords = (items: unknown) => (Array.isArray(items) ? items as unknown[] : []).filter((item) => {
              if (!item || typeof item !== 'object') return false
              return beforeSeed(provenanceSeq(item))
            })
            const rewrittenCadenceSlot = Number.isSafeInteger(Number(cadenceAnchorSeq))
              && Number.isSafeInteger(Number(cadenceTurn))
              ? { anchorSeq: Number(cadenceAnchorSeq), turn: Number(cadenceTurn) }
              : null

            // 创作配置：fork 后仍应保留同一角色卡、世界书和作者美化；这些
            // 不是剧情正史，不能因从较早轮次分叉而突然消失。
            for (const [k, v] of T.cards.entries()) {
              if (k.startsWith(pPrefix) && v) await T.cards.put(cP + k.slice(pPrefix.length), cloneBranchRecord(v))
            }
            for (const [k, v] of T.worldbook.entries()) {
              if (k.startsWith(pPrefix) && v) await T.worldbook.put(cP + k.slice(pPrefix.length), cloneBranchRecord(v))
            }
            for (const table of [T.rules, T.opening]) {
              for (const [k, v] of table.entries()) {
                if (k.startsWith(pPrefix) && v) await table.put(cP + k.slice(pPrefix.length), cloneBranchRecord(v))
              }
            }
            const parentSettings = T.branch.get(keyOf(parent, 'settings'))
            for(const [k,v] of [...T.branch.entries()])if(k.startsWith(`${parent}__cluster-lore-`)&&Number(v.seq)<Number(seedLength)&&clusterLoreVisible(session,v,Number(seedLength)))
              await T.branch.put(keyOf(session.id,`cluster-lore-${v.seq}`),{...cloneBranchRecord(v),branchId:session.id})
            // A fresh native fork can receive explicit settings before its first story turn.
            // Inheritance fills missing fields without overwriting those saved choices.
            if (parentSettings) await T.branch.put(keyOf(session.id, 'settings'), {
              ...cloneBranchRecord(parentSettings),
              ...cloneBranchRecord(T.branch.get(keyOf(session.id, 'settings')) ?? {}),
            })
            const parentWindow = T.branch.get(contextWindowKey(parent))
            if (parentWindow) {
              const inheritedWindow = cloneContextWindow(parentWindow)!
              const inheritedStart = Number(inheritedWindow.startSeq ?? -1)
              const seedBoundary = Number.isFinite(seedLength) ? seedLength : Number.POSITIVE_INFINITY
              // A child may fork before the parent's current hard-window
              // boundary. In that case the copied boundary would hide visible
              // seed history, so restart the child at a conservative window 1.
              if (inheritedStart >= seedBoundary) {
                await T.branch.put(contextWindowKey(session.id), {
                  windowNumber: 1, windowId: randomUUID(), previousWindowId: null,
                  branchId: session.id, startSeq: -1, throughSeq: seedBoundary - 1,
                  storyTokens: 0, createdAt: Date.now(), rolloverCount: 0,
                  reason: 'fork-before-parent-window-boundary',
                })
              } else {
                await T.branch.put(contextWindowKey(session.id), {
                  ...inheritedWindow,
                  branchId: session.id,
                  throughSeq: Math.min(Number(inheritedWindow.throughSeq ?? -1), seedBoundary - 1),
                  inheritedFrom: parent,
                  inheritedAtSeedLength: Number.isFinite(seedLength) ? seedLength : null,
                })
              }
            }
            const parentStatusSpec = T.status.get(keyOf(parent, 'spec'))
            if (parentStatusSpec) await T.status.put(keyOf(session.id, 'spec'), cloneBranchRecord(parentStatusSpec))

            // Story-derived memory is fail-closed.  The child surface itself is
            // the only proof that a compacted summary belongs before the fork;
            // legacy fields without a source seq are deliberately not copied.
            const parentMemory = T.memory.get(keyOf(parent, 'head'))
            if (parentMemory) {
              const checkpoint = visibleCompactionCheckpoint(session)
              // Carry only complete, verified prefixes within the native seed.
              // The memory reader still checks every seq + content hash against
              // this child's selected history before exposing or reusing notes.
              const notesInsideSeed=(note: DirectorNotes | null | undefined): note is DirectorNotes=>Array.isArray(note?.sourceKeys)&&note.sourceKeys.length>0
                &&note.sourceKeys.every(key=>typeof key==='string'&&/^[0-9]+:[a-f0-9]{64}$/.test(key)&&beforeSeed(Number(key.split(':')[0])))
              const checkpointKeys = new Set<string | undefined>()
              const directorCheckpoints=[parentMemory.directorNotes,...(Array.isArray(parentMemory.directorCheckpoints)?parentMemory.directorCheckpoints:[])]
                .filter((note): note is DirectorNotes=>note?.validated===true&&notesInsideSeed(note))
                .filter(note=>{
                  const key=JSON.stringify(note.sourceKeys)
                  if(checkpointKeys.has(key))return false
                  checkpointKeys.add(key)
                  return true
                })
              const parentCadence = parentMemory.notesCadence
              const parentCadenceSlots = parentCadence?.schemaVersion === 1 && Array.isArray(parentCadence.slots)
                ? parentCadence.slots
                : ctx.get('compaction')?.legacyCadenceSlotsFor?.(ctx.sessions.get(parent), parentMemory) ?? []
              const notesCadence = Array.isArray(parentCadenceSlots)
                ? { schemaVersion: 1, branchId: session.id,
                  slots: parentCadenceSlots.filter(slot => Number.isSafeInteger(slot?.turn)
                    && Number.isSafeInteger(slot?.anchorSeq) && (beforeSeed(slot.anchorSeq)
                      || (rewrittenCadenceSlot !== null && Number(slot.anchorSeq) === rewrittenCadenceSlot.anchorSeq
                        && Number(slot.turn) === rewrittenCadenceSlot.turn))).map(slot => ({
                    turn: Number(slot.turn), anchorSeq: Number(slot.anchorSeq),
                  })),
                  inheritedFrom: parent, inheritedAtSeedLength: Number.isFinite(seedLength) ? seedLength : null,
                  updatedAt: Date.now() }
                : null
              await T.memory.put(keyOf(session.id, 'head'), {
                schemaVersion:1,
                summary: checkpoint?.text ?? '',
                surfaceCheckpointSeq: checkpoint?.seq ?? null,
                lastCompactedSeq: checkpoint?.seq ?? -1,
                archives: beforeSeedRecords(parentMemory.archives),
                archiveDigests: beforeSeedRecords(parentMemory.archiveDigests),
                deltas: beforeSeedRecords(parentMemory.deltas),
                pendingConfirmations: beforeSeedRecords(parentMemory.pendingConfirmations),
                lockedFacts: beforeSeedRecords(parentMemory.lockedFacts),
                styleNotes: beforeSeedRecords(parentMemory.styleNotes),
                userPrefs: beforeSeedRecords(parentMemory.userPrefs),
                directorCheckpoints:cloneBranchRecord(directorCheckpoints),
                ...(notesCadence ? { notesCadence } : {}),
                directorNotes:notesInsideSeed(parentMemory.directorNotes)&&(parentMemory.directorNotes.validated===true||parentMemory.directorNotes.manual===true)
                  ?cloneBranchRecord(parentMemory.directorNotes):null,
                inheritedFrom: parent,
                inheritedAtSeedLength: Number.isFinite(seedLength) ? seedLength : null,
                version: (Number(parentMemory.version) || 1) + 1,
              })
            }

            const parentScene = T.scene.get(keyOf(parent, 'current'))
            if (parentScene && beforeSeed(parentScene.updatedAtSeq ?? parentScene.atSeq)) {
              await T.scene.put(keyOf(session.id, 'current'), cloneBranchRecord(parentScene))
            }
            const parentPanel = T.status.get(keyOf(parent, 'panel'))
            if (parentPanel && beforeSeed(parentPanel.atSeq ?? parentPanel.updatedAtSeq)) {
              await T.status.put(keyOf(session.id, 'panel'), cloneBranchRecord(parentPanel))
            }
            // 待选择决策属于父分支的下一步 UI，不继承到已经开始重生/编辑的
            // 子分支；子分支正文落定后 Phase B 会生成自己的决策卡。
            for (const [k, v] of T.rolls.entries()) {
              if (!k.startsWith(pPrefix) || !v) continue
              const filtered = rollLogEntries(v).filter((item) => {
                const record = item as {atSeq?: unknown; seq?: unknown} | null | undefined
                return beforeSeed(record?.atSeq ?? record?.seq)
              })
              if (filtered.length) {
                await T.rolls.put(cP + k.slice(pPrefix.length), rollLogRecord(filtered))
              }
            }
            const parentImport = T.branch.get(importActiveKey(parent))
            if (parentImport) {
              await T.branch.put(importActiveKey(session.id), {
                ...cloneBranchRecord(parentImport),
                inheritedFrom: parent,
                sourceRecordSessionId: parentImport.sourceRecordSessionId ?? parent,
              })
            }
            // Meta is the inheritance commit marker and MUST be last.  All
            // earlier copies are idempotent, so a failed attempt can replay;
            // publishing meta first would make a half-inherited child look ready.
            await T.branch.put(keyOf(session.id, 'meta'), {
              createdAt: Date.now(),
              lastTurn: 0,
              lastSeq: -1,
              inheritedFrom: parent,
              inheritedAtSeedLength: Number.isFinite(seedLength) ? seedLength : null,
              inheritanceState: 'ready',
            })
          }
        } else if (!T.branch.get(keyOf(session.id, 'meta'))) {
          await T.branch.put(keyOf(session.id, 'meta'), { createdAt: Date.now(), lastTurn: 0, lastSeq: -1 })
        }
        // Native cloning copies a parent's durable panel, including its owner.
        // Rebind only an unchanged, proven prefix within this child's seed.
        // Also repairs ready records written by versions that copied the row
        // verbatim; no model call or parent-state mutation is needed.
        const inheritedPanel = T.status.get(keyOf(session.id, 'panel'))
        if (parent && inheritedPanel?.sessionId === parent && inheritedPanel.provenance && !inheritedPanel.stale
          && Number.isSafeInteger(session.inheritedEventCount) && Number(inheritedPanel.atSeq) < Number(session.inheritedEventCount)) {
          const event = eventsOf(session).find(item => item.seq === inheritedPanel.atSeq)
          const source = statusSource(session, event)
          const history = (ctx.get('compaction')?.storyEvidence?.(session) ?? surfaceEntries(session))
            .map(entry => ({ seq: entry.seq, role: ('role' in entry ? entry.role : undefined) ?? entry.kind, text: entry.text }))
            .filter(entry => entry.seq <= Number(inheritedPanel.atSeq))
          const proof = inheritedPanel.provenance
          if (source && source.sourceHash === proof.sourceHash
            && recordSha256(source.sourceSeqs) === recordSha256(proof.sourceSeqs)
            && typeof proof.historyHash === 'string' && recordSha256(history) === proof.historyHash) {
            const fixed = statusFixedContext(session)
            const asParent = { ...fixed, cards: fixed.cards.map(entry => ({ ...entry, key: `${parent}__${entry.key.slice(session.id.length + 2)}` })),
              worldbook: fixed.worldbook.map(entry => ({ ...entry, key: `${parent}__${entry.key.slice(session.id.length + 2)}` })) }
            await T.status.put(keyOf(session.id, 'panel'), { ...cloneBranchRecord(inheritedPanel), sessionId: session.id, branchId: session.id,
              provenance: { ...cloneBranchRecord(proof), ...(recordSha256(asParent) === proof.fixedContextHash
                ? { fixedContextHash: recordSha256(fixed) } : {}) } })
          }
        }
        st.branchReady = true
      } catch (error) {
        ctx.logger?.warn?.(`roleplay: branch inherit failed for ${session.id}: ${String(error)}`)
        st.branchReady = false
        throw error
      } finally {
        st.branchPreparing = null
      }
    })()
    await st.branchPreparing
  }
  return { ensureBranch }
}
