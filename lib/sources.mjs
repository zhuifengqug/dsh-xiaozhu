import fs from 'node:fs'
import path from 'node:path'
import { dshHome } from './paths.mjs'
import { REFERENCE_LIMIT } from './contract.mjs'

/**
 * 底稿来源：只读采集现有提示词，喂给查重规则。
 * 这里一个字节都不写回去 —— 提示词是 G 的，小蛛只做比对。
 */
export function listSources(extra) {
  const out = []
  const envList = process.env.DSH_SPIDER_SOURCES
  if (envList) {
    for (const item of envList.split(path.delimiter)) {
      if (item.trim()) out.push({ name: 'env', file: item.trim() })
    }
  }
  out.push({ name: '全局 AGENTS.md', file: path.join(dshHome(), 'AGENTS.md') })
  out.push({ name: '工作区 AGENTS.md', file: path.join(process.cwd(), 'AGENTS.md') })
  if (Array.isArray(extra)) {
    for (const file of extra) if (file) out.push({ name: path.basename(String(file)), file: String(file) })
  }
  const seen = new Set()
  return out.filter((item) => {
    if (seen.has(item.file)) return false
    seen.add(item.file)
    return true
  })
}

export function collectReference(extra) {
  const parts = []
  let total = 0
  for (const item of listSources(extra)) {
    let text = ''
    let missing = false
    try { text = fs.readFileSync(item.file, 'utf8') } catch { missing = true }
    if (!missing) {
      const trimmed = text.trim()
      if (trimmed) {
        const room = Math.max(0, REFERENCE_LIMIT - total)
        const slice = trimmed.slice(0, room)
        total += slice.length
        parts.push({ name: item.name, file: item.file, chars: slice.length, truncated: slice.length < trimmed.length })
      } else {
        parts.push({ name: item.name, file: item.file, chars: 0, empty: true })
      }
    } else {
      parts.push({ name: item.name, file: item.file, missing: true })
    }
  }
  const text = parts.filter((p) => p.chars > 0).map((p) => '<<' + p.name + '>>\n' + fs.readFileSync(p.file, 'utf8').trim().slice(0, p.chars)).join('\n\n')
  return { text: text.slice(0, REFERENCE_LIMIT), chars: Math.min(total, REFERENCE_LIMIT), parts }
}
