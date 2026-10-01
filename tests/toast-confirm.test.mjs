import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createToastController, confirmWithDialog } from '../lib/ui/client.js'
import { resolveJsdom } from '../lib/operations/tool-resolution.mjs'

const require = createRequire(import.meta.url)
const { JSDOM } = require(resolveJsdom())
const dom = new JSDOM('<!doctype html><body><dialog class="dsh-rp-dialog" open></dialog></body>')
const { document, Event } = dom.window
const manager = document.querySelector('.dsh-rp-dialog')
manager.matches = selector => selector === ':modal'

const toast = createToastController(document)
toast('first save')
assert.equal(manager.querySelectorAll('.dsh-rp-toast').length, 1, 'an open manager dialog owns its toast')
assert.equal(document.body.querySelectorAll('.dsh-rp-toast').length, 1)
let visible = manager.querySelector('.dsh-rp-toast')
assert.equal(visible.getAttribute('role'), 'status')
assert.equal(visible.getAttribute('aria-live'), 'polite')
toast('second save')
assert.equal(manager.querySelectorAll('.dsh-rp-toast').length, 1, 'a new toast removes the prior element')
assert.equal(manager.querySelector('.dsh-rp-toast').textContent, 'second save')
toast.dismiss()
assert.equal(document.querySelectorAll('.dsh-rp-toast').length, 0)
manager.removeAttribute('open')
toast('page notice')
assert.equal(document.body.querySelectorAll('.dsh-rp-toast').length, 1, 'ordinary pages use the body toast host')
toast.dismiss()

const confirm = confirmWithDialog(document, '确认执行？')
let confirmation = document.querySelector('.dsh-rp-confirm-dialog')
assert.ok(confirmation?.open, 'confirmation enters a native dialog')
confirmation.querySelector('[data-confirm="true"]').click()
assert.equal(await confirm, true, 'confirm resolves true only after explicit confirmation')
assert.equal(document.querySelector('.dsh-rp-confirm-dialog'), null)

const cancelled = confirmWithDialog(document, '确认取消？')
confirmation = document.querySelector('.dsh-rp-confirm-dialog')
const cancel = new Event('cancel', { cancelable: true })
confirmation.dispatchEvent(cancel)
assert.equal(cancel.defaultPrevented, true, 'Escape cancel is handled by the helper')
assert.equal(await cancelled, false, 'Escape resolves false')
assert.equal(document.querySelector('.dsh-rp-confirm-dialog'), null)

const clickedCancel = confirmWithDialog(document, '点按取消？')
confirmation = document.querySelector('.dsh-rp-confirm-dialog')
confirmation.querySelector('button:not([data-confirm])').click()
assert.equal(await clickedCancel, false, 'cancel button resolves false')
assert.equal(document.querySelector('.dsh-rp-confirm-dialog'), null)

console.log('toast-confirm=ok (modal host, single live toast, confirm and Escape cancel)')
