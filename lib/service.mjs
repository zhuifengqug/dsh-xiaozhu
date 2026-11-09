import fs from 'node:fs'
import path from 'node:path'
import { spiderRoot, FILES } from './paths.mjs'
import { createStore } from './store.mjs'
import {
  SLOT_ORDER, SLOTS, SLOT_BUDGET, CANDIDATE_LIMIT, REFERENCE_LIMIT,
  defaultContract, normalizeContract, compileContract, lintContract, lintText, diffText
} from './contract.mjs'

function newId() {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return 'c' + t + r
}

function summarizeMoult(entry, record) {
  const diff = (record && record.diff) || []
  const plus = diff.filter((d) => d.op === '+').length
  const minus = diff.filter((d) => d.op === '-').length
  return { seq: entry.seq, at: (record && record.at) || '', reason: (record && record.reason) || entry.name, plus, minus, preview: diff.filter((d) => d.op !== ' ').slice(0, 6) }
}

/**
 * 一切状态都在磁盘上，进程里只有一层 mtime 缓存。
 * 结果：改文件下一轮就生效，重启不丢东西，多开也不会互相盖掉。
 */
export function createService(options) {
  const opts = options || {}
  const root = opts.root || spiderRoot()
  const store = createStore(root)
  let cache = null

  function load() {
    const file = path.join(root, FILES.contract)
    let stamp = 'missing'
    try {
      const st = fs.statSync(file)
      stamp = String(st.mtimeMs) + ':' + String(st.size)
    } catch {
      stamp = 'missing'
    }
    if (cache && cache.stamp === stamp) return cache
    const contract = normalizeContract(store.readJson(FILES.contract, null))
    cache = { stamp, contract, compiled: compileContract(contract) }
    return cache
  }

  function compiledText() {
    try { return load().compiled } catch { return '' }
  }

  function pickSlot(id) {
    if (!SLOT_ORDER.includes(id)) throw new Error('unknown slot: ' + String(id))
    return id
  }

  function commit(next, reason) {
    const before = load().contract
    const normalized = normalizeContract(next)
    normalized.updatedAt = new Date().toISOString()
    const diff = diffText(compileContract(before), compileContract(normalized))
    store.writeJson(FILES.contract, normalized)
    cache = null
    const moult = store.writeMoult({ reason, before, after: normalized, diff })
    const checkup = lintContract(normalized)
    store.appendCheckup(Object.assign({ source: 'write:' + reason }, checkup))
    return {
      ok: true,
      contract: normalized,
      compiled: compileContract(normalized),
      checkup,
      moult: summarizeMoult({ seq: moult.seq, name: moult.name }, { at: moult.at, reason: moult.reason, diff: moult.diff })
    }
  }

  function getState() {
    const loaded = load()
    const candidates = store.readCandidates().items.slice(-50).reverse()
    const moults = store.listMoults().slice(0, 20).map((entry) => summarizeMoult(entry, store.readMoult(entry)))
    const checkups = store.readCheckups().records.slice(-8).reverse()
    return {
      ok: true,
      root,
      slots: SLOT_ORDER.map((id) => ({
        id,
        label: SLOTS[id].label,
        hint: SLOTS[id].hint,
        enabled: loaded.contract.slots[id].enabled,
        text: loaded.contract.slots[id].text,
        chars: loaded.contract.slots[id].text.trim().length,
        budget: SLOT_BUDGET
      })),
      compiled: loaded.compiled,
      compiledChars: loaded.compiled.length,
      reference: loaded.contract.reference,
      updatedAt: loaded.contract.updatedAt,
      candidates,
      pending: candidates.filter((c) => c.status === 'pending').length,
      moults,
      checkups
    }
  }

  function saveSlot(input) {
    const id = pickSlot(input.slot)
    const current = load().contract
    const next = normalizeContract(current)
    if (typeof input.text === 'string') next.slots[id].text = input.text.replace(/\s+$/, '')
    if (typeof input.enabled === 'boolean') next.slots[id].enabled = input.enabled
    return commit(next, 'edit:' + id)
  }

  function setReference(text) {
    const next = normalizeContract(load().contract)
    next.reference = String(text || '').slice(0, REFERENCE_LIMIT)
    return commit(next, 'reference')
  }

  function propose(input) {
    const id = pickSlot(input.slot)
    const text = String(input.text || '').trim()
    if (!text) throw new Error('empty candidate')
    const data = store.readCandidates()
    const same = data.items.find((c) => c.status === 'pending' && c.slot === id && c.text === text)
    if (same) return { ok: true, duplicate: true, id: same.id, pending: data.items.filter((c) => c.status === 'pending').length }
    const item = {
      id: newId(),
      slot: id,
      text: text.slice(0, CANDIDATE_LIMIT),
      why: String(input.why || '').slice(0, 240),
      at: new Date().toISOString(),
      status: 'pending'
    }
    data.items.push(item)
    store.writeCandidates(data)
    return { ok: true, id: item.id, pending: data.items.filter((c) => c.status === 'pending').length }
  }

  function decide(input) {
    const action = String(input.action || '')
    if (action !== 'accept' && action !== 'reject') throw new Error('action must be accept or reject')
    const data = store.readCandidates()
    const item = data.items.find((c) => c.id === input.id)
    if (!item) throw new Error('candidate not found: ' + String(input.id))
    if (item.status !== 'pending') throw new Error('candidate already ' + item.status)
    item.status = action === 'accept' ? 'accepted' : 'rejected'
    item.decidedAt = new Date().toISOString()
    store.writeCandidates(data)
    if (action === 'reject') return { ok: true, status: 'rejected' }
    const saved = saveSlot({ slot: item.slot, text: item.text, enabled: true })
    return Object.assign({ ok: true, status: 'accepted' }, saved)
  }

  function rollback(seq) {
    const target = Number(seq)
    const entry = store.listMoults().find((m) => m.seq === target)
    if (!entry) throw new Error('moult not found: ' + String(seq))
    const record = store.readMoult(entry)
    if (!record || !record.before) throw new Error('moult record broken: ' + String(seq))
    return commit(record.before, 'rollback:' + String(seq))
  }

  function checkup(input) {
    const text = input && typeof input.text === 'string' ? input.text : ''
    if (text.trim()) {
      const loaded = load()
      const items = lintText(text, { reference: loaded.contract.reference })
      const record = {
        at: new Date().toISOString(),
        source: 'manual:text',
        items,
        stats: { slots: {}, enabled: [], compiledChars: compileContract({ slots: { texture: { enabled: true, text } }, reference: '' }).length, errors: items.filter((i) => i.level === 'error').length, warns: items.filter((i) => i.level === 'warn').length }
      }
      store.appendCheckup(record)
      return { ok: true, checkup: record }
    }
    const record = Object.assign({ source: 'manual:contract' }, lintContract(load().contract))
    store.appendCheckup(record)
    return { ok: true, checkup: record }
  }

  return { root, getState, compiledText, saveSlot, setReference, propose, decide, rollback, checkup, loadContract: () => load().contract }
}
