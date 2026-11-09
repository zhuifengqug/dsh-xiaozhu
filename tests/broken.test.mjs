import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createService } from '../lib/service.mjs'

test('契约文件坏掉：备份 + 空契约运行 + 能救回来', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spider-broken-'))
  fs.writeFileSync(path.join(root, 'contract.json'), '{ 这不是 json', 'utf8')
  const svc = createService({ root })
  const state = svc.getState()
  assert.ok(state.warning.includes('备份'))
  assert.equal(state.compiled, '')
  assert.ok(fs.readdirSync(root).some((n) => n.startsWith('contract.json.broken-')))

  const saved = svc.saveSlot({ slot: 'texture', text: '重新写一遍。', enabled: true })
  assert.ok(saved.compiled.includes('重新写一遍。'))
  assert.equal(svc.getState().warning, '')
})
