import { createService } from './lib/service.mjs'

export const name = 'spider'
export const inject = ['systemPrompt', 'tools', 'webServer']

/** 小蛛补充段在系统提示里的位置：persona prefix(0) 之后、运行时后缀(10000) 之前。 */
export const SECTION_NAME = 'persona:spider-supplement'
export const SECTION_ORDER = 5060
const ROUTE = '/api/spider'
const SLOT_ENUM = ['texture', 'relation', 'proactive']

const OUTPUT = {
  schema: {
    type: 'object',
    properties: { ok: { type: 'boolean' }, text: { type: 'string' } },
    required: ['ok', 'text'],
    additionalProperties: true
  },
  render: (_args, value) => [{ type: 'text', text: String((value && value.text) || '') }]
}

function buildTools(service) {
  return [
    {
      name: 'spider_propose',
      description:
        '向小蛛的人格候选池提交一条建议。这是唯一能写东西的口子：它只写候选池，不写契约、不进系统提示，必须由 G 在设置页点采纳才生效。' +
        '每次只提一条，一条只说明一个可判定的行为改动。',
      parameters: {
        type: 'object',
        properties: {
          slot: { type: 'string', enum: SLOT_ENUM, description: 'texture=性格质感 relation=关系层 proactive=主动行为' },
          text: { type: 'string', description: '拟加入该槽的原文，直接写进提示的那种句子，不写解释' },
          why: { type: 'string', description: '为什么需要这一条：是哪一次交付暴露出的缺口' }
        },
        required: ['slot', 'text', 'why'],
        additionalProperties: false
      },
      output: OUTPUT,
      execute: async (args) => {
        try {
          const r = service.propose(args)
          if (r.duplicate) return { ok: true, id: r.id, pending: r.pending, text: '同样的候选已在池里（' + r.id + '），未重复提交。待裁决 ' + r.pending + ' 条。' }
          return { ok: true, id: r.id, pending: r.pending, text: '已提交候选 ' + r.id + '（' + args.slot + '）。待裁决 ' + r.pending + ' 条 —— 等 G 在 设置 → 小蛛 里点采纳，它才会进提示。' }
        } catch (error) {
          return { ok: false, text: '提交失败：' + String(error && error.message ? error.message : error) }
        }
      }
    },
    {
      name: 'spider_contract',
      description: '读当前小蛛契约编译出的那一段系统提示原文与各槽状态。只读：改契约只能在设置页，或走 spider_propose 提候选。',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: OUTPUT,
      execute: async () => {
        const s = service.getState()
        const lines = ['编译结果（' + s.compiledChars + ' 字）：', s.compiled || '（空 —— 三槽都没有启用的内容，系统提示里不会插入任何东西）']
        for (const slot of s.slots) lines.push('· ' + slot.label + '：' + (slot.enabled ? '启用' : '未启用') + '，' + slot.chars + '/' + slot.budget + ' 字')
        if (s.pending) lines.push('待裁决候选：' + s.pending + ' 条')
        return { ok: true, text: lines.join('\n') }
      }
    },
    {
      name: 'spider_checkup',
      description: '对一段拟写进契约的文本跑体检：称呼口径、客服腔、退让措辞、不可执行措辞、与现有提示词重复。固定规则、不联网，同一输入永远同一结果。',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string', description: '要检查的文本；留空则体检当前契约' } },
        required: [],
        additionalProperties: false
      },
      output: OUTPUT,
      execute: async (args) => {
        const r = service.checkup(args || {})
        const items = r.checkup.items
        if (!items.length) return { ok: true, text: '体检通过：没有命中规则。' }
        const lines = ['体检命中 ' + items.length + ' 条：']
        for (const item of items) lines.push('[' + item.level + '] ' + item.title + ' — ' + item.evidence + '  → ' + item.hint)
        return { ok: true, text: lines.join('\n') }
      }
    }
  ]
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (!text) return resolve({})
      try { resolve(JSON.parse(text)) } catch { reject(new Error('invalid json')) }
    })
    req.on('error', reject)
  })
}

function send(res, code, payload) {
  const body = JSON.stringify(payload)
  res.statusCode = code
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(body)
}

function makeHandler(service) {
  return async function handler(req, res) {
    let pathname = ROUTE
    try { pathname = new URL(req.url, 'http://localhost').pathname } catch { pathname = ROUTE + '/' }
    if (pathname.startsWith(ROUTE)) pathname = pathname.slice(ROUTE.length) || '/'
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1)
    const method = (req.method || 'GET').toUpperCase()

    try {
      if (method === 'GET' && (pathname === '/' || pathname === '/state')) return send(res, 200, service.getState())
      if (method !== 'POST') return send(res, 405, { ok: false, error: 'method not allowed' })
      const body = await readBody(req, 512 * 1024)
      if (pathname === '/slot') return send(res, 200, service.saveSlot(body))
      if (pathname === '/reference') return send(res, 200, service.setReference(body.text))
      if (pathname === '/reference/rebuild') return send(res, 200, service.rebuildReference())
      if (pathname === '/propose') return send(res, 200, service.propose(body))
      if (pathname === '/decide') return send(res, 200, service.decide(body))
      if (pathname === '/rollback') return send(res, 200, service.rollback(body.seq))
      if (pathname === '/checkup') return send(res, 200, service.checkup(body))
      return send(res, 404, { ok: false, error: 'not found' })
    } catch (error) {
      return send(res, 400, { ok: false, error: String(error && error.message ? error.message : error) })
    }
  }
}

export function apply(ctx, config = {}) {
  const service = createService({ root: config.root })
  if (typeof ctx.set === 'function') {
    try { ctx.set('zhuifengqugSpiderSupplement', service) } catch { /* 服务名已被占用时不阻塞激活 */ }
  }
  ctx.effect(() => ctx.systemPrompt.section({
    name: SECTION_NAME,
    order: SECTION_ORDER,
    text: () => service.compiledText()
  }))
  for (const tool of buildTools(service)) ctx.effect(() => ctx.tools.register(tool))
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: ROUTE, handler: makeHandler(service) }))
}
