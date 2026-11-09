import fs from 'node:fs'
import path from 'node:path'
import { FILES } from './paths.mjs'

/** 落盘只走这里：原子写、目录自建、坏 JSON 不炸。 */
export function createStore(root) {
  const moultDir = () => path.join(root, FILES.moults)

  function ensure() {
    fs.mkdirSync(moultDir(), { recursive: true })
  }

  function readJson(name, fallback) {
    const file = path.join(root, name)
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      return fallback
    }
  }

  function writeJson(name, value) {
    ensure()
    const file = path.join(root, name)
    const tmp = file + '.tmp-' + process.pid
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
    fs.renameSync(tmp, file)
  }

  function listMoults() {
    ensure()
    let names = []
    try { names = fs.readdirSync(moultDir()) } catch { names = [] }
    const out = []
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      const seq = Number.parseInt(name.slice(0, 4), 10)
      if (!Number.isFinite(seq)) continue
      out.push({ seq, file: path.join(moultDir(), name), name })
    }
    out.sort((x, y) => y.seq - x.seq)
    return out
  }

  function readMoult(entry) {
    try { return JSON.parse(fs.readFileSync(entry.file, 'utf8')) } catch { return null }
  }

  function nextSeq() {
    const list = listMoults()
    return list.length ? list[0].seq + 1 : 1
  }

  function writeMoult(record) {
    ensure()
    const seq = nextSeq()
    const slug = String(record.reason || 'edit').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'edit'
    const name = String(seq).padStart(4, '0') + '-' + slug + '.json'
    const body = Object.assign({ seq, at: new Date().toISOString() }, record)
    fs.writeFileSync(path.join(moultDir(), name), JSON.stringify(body, null, 2) + '\n', 'utf8')
    return { seq, name, at: body.at, reason: body.reason, diff: body.diff || [] }
  }

  function readCandidates() {
    const raw = readJson(FILES.candidates, null)
    if (raw && Array.isArray(raw.items)) return raw
    return { version: 1, items: [] }
  }

  function writeCandidates(data) {
    const items = data.items.slice(-300)
    writeJson(FILES.candidates, { version: 1, items })
  }

  function readCheckups() {
    const raw = readJson(FILES.checkups, null)
    if (raw && Array.isArray(raw.records)) return raw
    return { version: 1, records: [] }
  }

  function appendCheckup(record) {
    const data = readCheckups()
    data.records.push(record)
    writeJson(FILES.checkups, { version: 1, records: data.records.slice(-200) })
  }

  return { root, ensure, readJson, writeJson, listMoults, readMoult, writeMoult, readCandidates, writeCandidates, readCheckups, appendCheckup }
}
