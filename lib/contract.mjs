// 小蛛的契约模型：三槽 → 编译成一段提示；同一契约永远编译出同一份字节。

export const SLOT_ORDER = ['texture', 'relation', 'proactive']

export const SLOTS = {
  texture: {
    id: 'texture',
    label: '性格质感',
    hint: '说话节奏、锋利度、怎么举例、句子怎么收尾。写"长句多还是短句多"这种能判定的，不写"要自然"。'
  },
  relation: {
    id: 'relation',
    label: '关系层',
    hint: '怎么称呼 G、可以自主越到哪一步、被纠正后怎么改口。关系是私事，这段只写 G 与它之间。'
  },
  proactive: {
    id: 'proactive',
    label: '主动行为',
    hint: '什么时候先动手再汇报、什么时候先问一句、交付形态偏好（先产物后解释/先结论后细节）。'
  }
}

export const PREAMBLE = '以下是小蛛的人格补充段：只补既有指令没有覆盖的部分；与既有指令冲突时以既有指令为准；不重复、不改写它们。'

/** 单槽字面上限。超了不是错，是提示：这段会挤占每一轮的上下文。 */
export const SLOT_BUDGET = 1200
/** 查重底稿上限，只入对比、不入提示。 */
export const REFERENCE_LIMIT = 20000
/** 单条候选上限，防止模型一次塞进整篇人格。 */
export const CANDIDATE_LIMIT = 1200

export function defaultContract() {
  return {
    version: 1,
    slots: {
      texture: { enabled: false, text: '' },
      relation: { enabled: false, text: '' },
      proactive: { enabled: false, text: '' }
    },
    reference: '',
    updatedAt: ''
  }
}

export function normalizeContract(raw) {
  const base = defaultContract()
  if (!raw || typeof raw !== 'object') return base
  const out = base
  out.version = 1
  out.reference = typeof raw.reference === 'string' ? raw.reference.slice(0, REFERENCE_LIMIT) : ''
  out.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : ''
  const slots = raw.slots && typeof raw.slots === 'object' ? raw.slots : {}
  for (const id of SLOT_ORDER) {
    const s = slots[id]
    if (!s || typeof s !== 'object') continue
    out.slots[id] = {
      enabled: s.enabled === true,
      text: typeof s.text === 'string' ? s.text.replace(/\s+$/, '') : ''
    }
  }
  return out
}

/** 编译：确定性、无时间戳、无随机。没启用的槽不出现在结果里。 */
export function compileContract(contract) {
  const c = normalizeContract(contract)
  const blocks = []
  for (const id of SLOT_ORDER) {
    const slot = c.slots[id]
    if (!slot.enabled) continue
    const body = String(slot.text || '').trim()
    if (!body) continue
    blocks.push('【' + SLOTS[id].label + '】\n' + body)
  }
  if (!blocks.length) return ''
  return PREAMBLE + '\n\n' + blocks.join('\n\n') + '\n'
}

// ---------------------------------------------------------------- 体检

const NEG_HEAD = /(避免|不要|无需|不必|而不是|别)/
const NEG_TAIL = /[不别无勿禁免莫甭]/

function findHits(text, source, flags) {
  const out = []
  const rx = new RegExp(source, flags + 'g')
  let m
  while ((m = rx.exec(text)) !== null) {
    out.push({ index: m.index, match: m[0] })
    if (m.index === rx.lastIndex) rx.lastIndex += 1
    if (out.length >= 6) break
  }
  return out
}

function isNegated(text, index) {
  const head = text.slice(Math.max(0, index - 12), index)
  if (NEG_HEAD.test(head)) return true
  return NEG_TAIL.test(head.slice(-3))
}

function sentence(text, index, len) {
  const from = Math.max(0, index - 26)
  const to = Math.min(text.length, index + len + 26)
  return (from > 0 ? '…' : '') + text.slice(from, to).replace(/\s+/g, ' ') + (to < text.length ? '…' : '')
}

const TEXT_RULES = [
  {
    id: 'address',
    level: 'error',
    title: '称呼口径',
    source: '(?<![\\w-])(YG|PF)(?![\\w-])',
    flags: '',
    hint: '契约里只写 G。换成 YG/PF/"用户"等于每轮都在提醒它另一个口径。'
  },
  {
    id: 'ai-voice',
    level: 'error',
    title: '客服腔/AI 腔',
    source: "(作为(一名|一个|AI)|很高兴(为|见到)|希望对(你|您)有帮助|感谢(你|您)的耐心|I'm sorry|I apologize|as an AI)",
    flags: 'i',
    hint: '这类句子写进契约，等于把要躲的口径又念了一遍。删掉。'
  },
  {
    id: 'hedge',
    level: 'warn',
    title: '契约在教它退让',
    source: '(抱歉|对不起|出于安全|建议(你|您)|请注意|无法提供|不能提供)',
    flags: '',
    needNegation: true,
    hint: '真要写例外，写成可判定的条件（"遇到 X 时先说明一句再继续"），不写情绪词。'
  },
  {
    id: 'vague',
    level: 'info',
    title: '不可执行措辞',
    source: '(尽量|适当|酌情|灵活一点|自然一点|该硬就硬|把握分寸)',
    flags: '',
    hint: '换成能检查的判据：句长、是否先给产物、什么条件下停下来问。'
  }
]

function shingles(text, size) {
  const clean = String(text).replace(/\\s+/g, '')
  const out = new Set()
  for (let i = 0; i + size <= clean.length; i += 1) out.add(clean.slice(i, i + size))
  return out
}

/**
 * 体检：对契约（或一份待测文本）跑固定规则，返回信号而非分数。
 * 不调模型、不联网 —— 同样的输入永远同样的输出。
 */
export function lintText(text, options) {
  const opts = options || {}
  const items = []
  const body = String(text || '')
  if (body.trim()) {
    for (const rule of TEXT_RULES) {
      for (const hit of findHits(body, rule.source, rule.flags)) {
        if (rule.needNegation && isNegated(body, hit.index)) continue
        items.push({
          rule: rule.id,
          level: rule.level,
          title: rule.title,
          evidence: sentence(body, hit.index, hit.match.length),
          hint: rule.hint
        })
      }
    }
  }
  if (opts.reference && String(opts.reference).trim() && body.trim()) {
    const mine = shingles(body, 12)
    const theirs = shingles(opts.reference, 12)
    if (mine.size >= 8) {
      let hit = 0
      const samples = []
      for (const s of mine) {
        if (theirs.has(s)) {
          hit += 1
          if (samples.length < 3) samples.push(s)
        }
      }
      const ratio = hit / mine.size
      if (ratio > 0.2) {
        items.push({
          rule: 'duplicate',
          level: 'warn',
          title: '与现有提示词重复',
          evidence: '重合 ' + Math.round(ratio * 100) + '%：' + samples.join(' / '),
          hint: '重复的段落不会更有效，只会更占上下文。把重合部分删掉，只留没被覆盖的那部分。'
        })
      }
    }
  }
  return items
}

export function lintContract(contract) {
  const c = normalizeContract(contract)
  const items = []
  const perSlot = {}
  for (const id of SLOT_ORDER) {
    const slot = c.slots[id]
    const len = slot.text.trim().length
    perSlot[id] = { enabled: slot.enabled, chars: len }
    if (len > SLOT_BUDGET) {
      items.push({
        rule: 'budget',
        level: 'warn',
        title: '超出单槽预算',
        evidence: SLOTS[id].label + ' ' + len + ' 字（预算 ' + SLOT_BUDGET + '）',
        hint: '这段每一轮都会进提示，删到只留判据。'
      })
    }
    if (len > 0 && !slot.enabled) {
      items.push({
        rule: 'dormant',
        level: 'info',
        title: '已写未启用',
        evidence: SLOTS[id].label + ' 有 ' + len + ' 字但未启用',
        hint: '要么启用，要么清空 —— 停在中间最容易忘。'
      })
    }
    for (const item of lintText(slot.text, { reference: c.reference })) {
      items.push(Object.assign({ slot: id }, item))
    }
  }
  const compiled = compileContract(c)
  const enabled = SLOT_ORDER.filter((id) => c.slots[id].enabled && c.slots[id].text.trim())
  return {
    at: optsNow(),
    items,
    stats: {
      slots: perSlot,
      enabled,
      compiledChars: compiled.length,
      errors: items.filter((i) => i.level === 'error').length,
      warns: items.filter((i) => i.level === 'warn').length
    }
  }
}

function optsNow() {
  return new Date().toISOString()
}

// ---------------------------------------------------------------- 蜕的差异

/** 行级 diff（LCS），超过 600 行退化成集合差，够用就好。 */
export function diffText(before, after) {
  const a = String(before || '').split('\n')
  const b = String(after || '').split('\n')
  if (a.length > 600 || b.length > 600 || a.length * b.length > 200000) {
    const setA = new Set(a)
    const setB = new Set(b)
    const out = []
    for (const line of a) if (!setB.has(line)) out.push({ op: '-', text: line })
    for (const line of b) if (!setA.has(line)) out.push({ op: '+', text: line })
    return out
  }
  const dp = []
  for (let i = 0; i <= a.length; i += 1) dp.push(new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const out = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push({ op: ' ', text: a[i] }); i += 1; j += 1 }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ op: '-', text: a[i] }); i += 1 }
    else { out.push({ op: '+', text: b[j] }); j += 1 }
  }
  while (i < a.length) { out.push({ op: '-', text: a[i] }); i += 1 }
  while (j < b.length) { out.push({ op: '+', text: b[j] }); j += 1 }
  return out
}
