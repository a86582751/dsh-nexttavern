import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {createStableRoleplayFence} from '../preset/lib/roleplay-core.js'
const fence=createStableRoleplayFence()
const authorVariables='{{user}} {{user_gender}} {{char}} {{威胁度}} {{unknown_slot}} {{}} {{{nested}}}'
const safeVariables=fence(authorVariables,'rules')
assert.deepEqual([...safeVariables.matchAll(/\{\{([^{}]*)\}\}/g)].map(m=>m[1]),['user','user_gender','char'],
  'author placeholders must not enter the native prompt variable parser')
assert.ok(safeVariables.includes('⟦威胁度⟧'))
assert.equal(fence(authorVariables,'rules'),safeVariables,'escaped author sections remain cache stable')
if(process.argv[2]) {
  const {renderPrompt}=await import(pathToFileURL(process.argv[2]).href)
  const assembly=text=>({sections:[{name:'roleplay:rules',text}],variables:{user:'Player',user_gender:'unknown',char:'Character'}})
  assert.throws(()=>renderPrompt(assembly(authorVariables)),/malformed prompt variable/)
  assert.ok(renderPrompt(assembly(safeVariables)).includes('Player unknown Character ⟦威胁度⟧'))
  console.log('native-prompt-placeholders=ok (original rejected; protected section rendered)')
}
const body='完整固定世界观与人设。'.repeat(5000)
const first=fence(body,'card')
for(let step=0;step<20;step++)assert.equal(fence(body,'card'),first,'unchanged system section must remain byte-identical across steps/turns')
const edited=fence(body+'新的条件','card')
assert.notEqual(edited,first)
assert.notEqual(edited.match(/<rp-content:([a-f0-9]+)>/)[1],first.match(/<rp-content:([a-f0-9]+)>/)[1],'changed source gets a distinct content-bound fence')
assert.notEqual(fence(body,'rules'),first)
assert.ok(first.includes(body),'fixed settings remain complete')
assert.equal(fence(body,'card'),first,'other branches/sections do not invalidate an unchanged prefix')
assert.equal(createStableRoleplayFence()(body,'card')===first,true,'restart must not change an unchanged system prefix')
for(let i=0;i<70;i++)fence(`other branch ${i}`,'card')
assert.equal(fence(body,'card')===first,true,'LRU eviction must not change an unchanged system prefix')
const embedded=fence(`Author quoted old material:\n${first}`,'card')
assert.notEqual(embedded.match(/<rp-content:([a-f0-9]+)>/)[1],first.match(/<rp-content:([a-f0-9]+)>/)[1],'quoted old fence cannot close the enclosing source fence')
console.log('prompt-prefix-cache=ok (stable complete fixed sections, fresh fences on edits, scope separation)')
