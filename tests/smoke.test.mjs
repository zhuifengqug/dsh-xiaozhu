import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { apply, name, inject, SECTION_NAME, SECTION_ORDER } from '../index.js'

/** 最小假宿主：只实现小蛛用到的 ctx 面（systemPrompt / tools / webServer）。 */
function fakeHost() {
  const seen = { sections: [], tools: [], routes: [], services: {}, disposed: 0, effects: 0 }
  const ctx = {
    effect(fn) {
      seen.effects += 1
      const disposer = fn()
      return () => { seen.disposed += 1; if (typeof disposer === 'function') disposer() }
    },
    set(key, value) { seen.services[key] = value },
    systemPrompt: { section(spec) { seen.sections.push(spec); return () => {} } },
    tools: { register(definition) { seen.tools.push(definition); return () => {} } },
    webServer: { register(route) { seen.routes.push(route); return () => {} } }
  }
  return { ctx, seen }
}

function fakeReq(method, url, body) {
  const req = new EventEmitter()
  req.method = method
  req.url = url
  queueMicrotask(() => {
    if (body !== undefined) req.emit('data', Buffer.from(JSON.stringify(body), 'utf8'))
    req.emit('end')
  })
  return req
}

function fakeRes() {
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(k, v) { res.headers[k.toLowerCase()] = v },
    end(text) { res.body = text || '' }
  }
  return res
}

function boot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spider-smoke-'))
  const host = fakeHost()
  apply(host.ctx, { root })
  return { root, host }
}

test('模块声明与家族一致', () => {
  assert.equal(name, 'spider')
  assert.deepEqual(inject.slice().sort(), ['systemPrompt', 'tools', 'webServer'])
  assert.equal(SECTION_ORDER > 0, true)
})

test('注册了系统提示段、三个工具、一条路由', () => {
  const { host } = boot()
  assert.equal(host.seen.sections.length, 1)
  assert.equal(host.seen.sections[0].name, SECTION_NAME)
  assert.equal(host.seen.sections[0].order, SECTION_ORDER)
  assert.equal(typeof host.seen.sections[0].text, 'function')
  assert.deepEqual(host.seen.tools.map((t) => t.name).sort(), ['spider_checkup', 'spider_contract', 'spider_propose'])
  for (const tool of host.seen.tools) {
    assert.equal(typeof tool.output.render, 'function')
    assert.equal(tool.output.schema.type, 'object')
    assert.ok(Array.isArray(tool.parameters ? [] : []))
    assert.equal(typeof tool.execute, 'function')
  }
  assert.equal(host.seen.routes.length, 1)
  assert.equal(host.seen.routes[0].kind, 'prefix')
  assert.equal(host.seen.routes[0].path, '/api/spider')
  assert.ok(host.seen.services.zhuifengqugSpiderSupplement)
})

test('空契约时提示段返回空串，不插入任何内容', () => {
  const { host } = boot()
  assert.equal(host.seen.sections[0].text(), '')
})

test('工具闭环：提候选 → 读契约 → 采纳后进提示', async () => {
  const { host } = boot()
  const byName = (n) => host.seen.tools.find((t) => t.name === n)
  const propose = await byName('spider_propose').execute({ slot: 'texture', text: '句子以结论开头。', why: '交付一上来就铺垫' })
  assert.equal(propose.ok, true)
  assert.ok(propose.text.includes('待裁决 1 条'))

  const contract = await byName('spider_contract').execute({})
  assert.equal(contract.ok, true)
  assert.ok(contract.text.includes('待裁决候选：1 条'))

  const checkup = await byName('spider_checkup').execute({ text: '称呼我 YG。' })
  assert.ok(checkup.text.includes('称呼口径'))

  const route = host.seen.routes[0]
  const listRes = fakeRes()
  await route.handler(fakeReq('GET', '/api/spider/state'), listRes)
  const listed = JSON.parse(listRes.body)
  assert.equal(listed.ok, true)
  assert.equal(listed.pending, 1)

  const id = listed.candidates[0].id
  const decideRes = fakeRes()
  await route.handler(fakeReq('POST', '/api/spider/decide', { id, action: 'accept' }), decideRes)
  const decided = JSON.parse(decideRes.body)
  assert.equal(decided.ok, true)
  assert.ok(decided.compiled.includes('句子以结论开头。'))
  assert.ok(host.seen.sections[0].text().includes('句子以结论开头。'))
})

test('路由：坏输入回 400，未知路径回 404，GET 写接口回 405', async () => {
  const { host } = boot()
  const route = host.seen.routes[0]

  const bad = fakeRes()
  await route.handler(fakeReq('POST', '/api/spider/slot', { slot: 'nope', text: 'x' }), bad)
  assert.equal(bad.statusCode, 400)
  assert.ok(JSON.parse(bad.body).error.includes('unknown slot'))

  const missing = fakeRes()
  await route.handler(fakeReq('GET', '/api/spider/nothing'), missing)
  assert.equal(missing.statusCode, 405)

  const notFound = fakeRes()
  await route.handler(fakeReq('POST', '/api/spider/nothing', {}), notFound)
  assert.equal(notFound.statusCode, 404)
})

test('路由：保存槽 + 回滚', async () => {
  const { host } = boot()
  const route = host.seen.routes[0]

  const save = fakeRes()
  await route.handler(fakeReq('POST', '/api/spider/slot', { slot: 'relation', text: '称呼只用 G。', enabled: true }), save)
  const saved = JSON.parse(save.body)
  assert.equal(saved.ok, true)
  assert.equal(saved.moult.seq, 1)

  const save2 = fakeRes()
  await route.handler(fakeReq('POST', '/api/spider/slot', { slot: 'proactive', text: '先动手。', enabled: true }), save2)

  const rollback = fakeRes()
  await route.handler(fakeReq('POST', '/api/spider/rollback', { seq: 2 }), rollback)
  const back = JSON.parse(rollback.body)
  assert.equal(back.ok, true)
  assert.equal(back.compiled.includes('先动手。'), false)
  assert.equal(back.compiled.includes('称呼只用 G。'), true)
})
