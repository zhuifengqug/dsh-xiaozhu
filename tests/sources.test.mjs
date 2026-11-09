import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { listSources, collectReference } from '../lib/sources.mjs'
import { createService } from '../lib/service.mjs'

test('来源清单默认含全局与工作区 AGENTS.md，且可去重', () => {
  const list = listSources()
  assert.ok(list.some((s) => s.name === '全局 AGENTS.md'))
  assert.ok(list.some((s) => s.name === '工作区 AGENTS.md'))
  const dup = listSources([list[0].file])
  assert.equal(dup.length, list.length)
})

test('collectReference 只读采集，缺文件不炸', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spider-src-'))
  const file = path.join(dir, 'AGENTS.md')
  fs.writeFileSync(file, '# 规则\n先给结论。\n', 'utf8')
  const r = collectReference([file, path.join(dir, 'missing.md')])
  const part = r.parts.find((p) => p.file === file)
  assert.equal(part.chars > 0, true)
  assert.ok(r.text.includes('先给结论。'))
  assert.ok(r.parts.some((p) => p.missing))
  assert.equal(fs.readFileSync(file, 'utf8'), '# 规则\n先给结论。\n')
})

test('service：重建底稿写入 reference 并留蜕', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'spider-src-'))
  const file = path.join(src, 'flavor.md')
  fs.writeFileSync(file, '每一轮回答都先给结论再给理由，不写铺垫。', 'utf8')
  process.env.DSH_SPIDER_SOURCES = file
  try {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spider-'))
    const svc = createService({ root })
    const r = svc.rebuildReference()
    assert.ok(r.contract.reference.includes('先给结论再给理由'))
    assert.equal(r.moult.reason, 'reference:auto')
    assert.ok(svc.getState().referenceSources.some((s) => s.file === file))

    // 写了重复内容 → 体检应当报 duplicate
    const saved = svc.saveSlot({ slot: 'texture', text: '每一轮回答都先给结论再给理由，不写铺垫。', enabled: true })
    assert.ok(saved.checkup.items.some((i) => i.rule === 'duplicate'))
  } finally {
    delete process.env.DSH_SPIDER_SOURCES
  }
})
