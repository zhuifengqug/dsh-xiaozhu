import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  defaultContract, normalizeContract, compileContract, lintContract, lintText, diffText, SLOTS, PREAMBLE, SLOT_BUDGET
} from '../lib/contract.mjs'
import { createService } from '../lib/service.mjs'

function withSlot(id, text, enabled) {
  const c = defaultContract()
  c.slots[id] = { enabled: enabled !== false, text }
  return c
}

test('空契约编译成空串', () => {
  assert.equal(compileContract(defaultContract()), '')
  assert.equal(compileContract({ slots: { texture: { enabled: false, text: '写了但没启用' } } }), '')
})

test('编译是确定性的，且带固定前言与槽标题', () => {
  const c = withSlot('texture', '  句子以结论开头。  ')
  const a = compileContract(c)
  const b = compileContract(JSON.parse(JSON.stringify(c)))
  assert.equal(a, b)
  assert.ok(a.startsWith(PREAMBLE))
  assert.ok(a.includes('【' + SLOTS.texture.label + '】'))
  assert.ok(a.includes('句子以结论开头。'))
  assert.ok(a.endsWith('\n'))
})

test('槽序固定：texture → relation → proactive', () => {
  const c = defaultContract()
  c.slots.texture = { enabled: true, text: 'T' }
  c.slots.relation = { enabled: true, text: 'R' }
  c.slots.proactive = { enabled: true, text: 'P' }
  const out = compileContract(c)
  assert.ok(out.indexOf('T') < out.indexOf('R'))
  assert.ok(out.indexOf('R') < out.indexOf('P'))
})

test('normalizeContract 修坏输入', () => {
  const c = normalizeContract({ slots: { texture: { enabled: 'yes', text: 42 }, nope: {} }, reference: 7 })
  assert.equal(c.slots.texture.enabled, false)
  assert.equal(c.slots.texture.text, '')
  assert.equal(c.reference, '')
  assert.deepEqual(Object.keys(c.slots).sort(), ['proactive', 'relation', 'texture'])
})

test('体检抓称呼口径', () => {
  const items = lintText('称呼我 YG。')
  assert.equal(items.filter((i) => i.rule === 'address').length, 1)
  assert.equal(items[0].level, 'error')
  assert.ok(items[0].evidence.includes('YG'))
})

test('体检抓客服腔', () => {
  const items = lintText('希望对你有所帮助，作为一个AI助手……')
  assert.ok(items.some((i) => i.rule === 'ai-voice'))
})

test('否定语境下的退让词不误报', () => {
  assert.equal(lintText('不要说抱歉，不要解释。').filter((i) => i.rule === 'hedge').length, 0)
  assert.equal(lintText('抱歉，我先停一下。').filter((i) => i.rule === 'hedge').length, 1)
})

test('体检抓不可执行措辞', () => {
  assert.ok(lintText('语气上尽量自然一点。').some((i) => i.rule === 'vague'))
})

test('预算与未启用提示', () => {
  const c = withSlot('texture', 'x'.repeat(SLOT_BUDGET + 5))
  const r = lintContract(c)
  assert.ok(r.items.some((i) => i.rule === 'budget'))
  const c2 = defaultContract()
  c2.slots.relation = { enabled: false, text: '有内容没启用' }
  assert.ok(lintContract(c2).items.some((i) => i.rule === 'dormant'))
})

test('查重：与底稿高度重合时告警', () => {
  const line = '每一轮回答都先给结论再给理由，不写铺垫，不写总结。'
  const c = withSlot('texture', line)
  c.reference = line + line
  const r = lintContract(c)
  assert.ok(r.items.some((i) => i.rule === 'duplicate'))
  const c2 = withSlot('texture', '遇到不确定的事实先查再答，查不到就说查不到。')
  c2.reference = '完全不相干的一段旧提示词，讲的是部署流程和端口号。'
  assert.ok(!lintContract(c2).items.some((i) => i.rule === 'duplicate'))
})

test('diffText 标出增删', () => {
  const d = diffText('a\nb\nc', 'a\nB\nc')
  assert.deepEqual(d.filter((x) => x.op === '-').map((x) => x.text), ['b'])
  assert.deepEqual(d.filter((x) => x.op === '+').map((x) => x.text), ['B'])
  assert.equal(d.filter((x) => x.op === ' ').length, 2)
})

test('超长输入走退化路径仍可用', () => {
  const big = new Array(700).fill('line').join('\n') + '\nnew'
  const d = diffText(big, big + '\nmore')
  assert.ok(d.some((x) => x.op === '+' && x.text === 'more'))
})

test('service：保存 → 编译 → 留蜕 → 回滚', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spider-'))
  const svc = createService({ root })
  assert.equal(svc.compiledText(), '')

  const r1 = svc.saveSlot({ slot: 'texture', text: '句子以结论开头。', enabled: true })
  assert.ok(r1.compiled.includes('句子以结论开头。'))
  assert.equal(r1.moult.seq, 1)
  assert.ok(fs.existsSync(path.join(root, 'contract.json')))

  const r2 = svc.saveSlot({ slot: 'relation', text: '称呼只用 G。', enabled: true })
  assert.equal(r2.moult.seq, 2)
  assert.ok(r2.compiled.includes('关系层'))

  const back = svc.rollback(2)
  assert.ok(back.compiled.includes('句子以结论开头。'))
  assert.ok(!back.compiled.includes('称呼只用 G。'))
  assert.equal(back.moult.reason, 'rollback:2')

  assert.throws(() => svc.saveSlot({ slot: 'nope', text: 'x' }), /unknown slot/)
  assert.throws(() => svc.rollback(99), /moult not found/)
})

test('service：候选只有采纳才进契约', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spider-'))
  const svc = createService({ root })

  const p = svc.propose({ slot: 'proactive', text: '先动手再汇报。', why: '这次交付停在方案上' })
  assert.equal(p.pending, 1)
  assert.equal(svc.compiledText(), '')

  const dup = svc.propose({ slot: 'proactive', text: '先动手再汇报。', why: '重复' })
  assert.equal(dup.duplicate, true)
  assert.equal(svc.getState().pending, 1)

  const rejected = svc.decide({ id: p.id, action: 'reject' })
  assert.equal(rejected.status, 'rejected')
  assert.equal(svc.getState().pending, 0)
  assert.equal(svc.compiledText(), '')

  const p2 = svc.propose({ slot: 'proactive', text: '先动手再汇报。', why: '再提一次' })
  const accepted = svc.decide({ id: p2.id, action: 'accept' })
  assert.equal(accepted.status, 'accepted')
  assert.ok(accepted.compiled.includes('先动手再汇报。'))
  assert.equal(accepted.contract.slots.proactive.enabled, true)
})

test('service：外部改文件下一轮就生效（mtime 缓存）', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spider-'))
  const svc = createService({ root })
  svc.saveSlot({ slot: 'texture', text: 'A。', enabled: true })
  assert.ok(svc.compiledText().includes('A。'))

  const file = path.join(root, 'contract.json')
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
  raw.slots.texture.text = 'B。'
  await new Promise((r) => setTimeout(r, 12))
  fs.writeFileSync(file, JSON.stringify(raw, null, 2), 'utf8')
  assert.ok(svc.compiledText().includes('B。'))
})
