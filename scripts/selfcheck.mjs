// 重启宿主后跑一次：确认插件真的被加载、段真的有内容、路由真的通。
//   node scripts/selfcheck.mjs [origin]     默认 http://127.0.0.1:20651
const origin = (process.argv[2] || process.env.DSH_ORIGIN || 'http://127.0.0.1:20651').replace(/\/$/, '')

function fail(message, hint) {
  console.log('[x] ' + message)
  if (hint) console.log('    ' + hint)
  process.exit(1)
}

let res
try {
  res = await fetch(origin + '/api/spider/state', { cache: 'no-store' })
} catch (error) {
  fail('连不上 ' + origin + '：' + String(error && error.message ? error.message : error), '宿主没起来，或 origin 不对（第一个参数可覆盖）。')
}

if (res.status === 404) {
  fail('/api/spider/state 返回 404', '路由没注册 —— 插件没进 bundles 或没通过导入。看宿主日志有没有 did not activate。')
}
if (!res.ok) fail('/api/spider/state 返回 ' + res.status)

const state = await res.json()
if (!state || state.ok !== true) fail('state 响应异常：' + JSON.stringify(state).slice(0, 200))

console.log('[ok] 路由通了：' + state.root)
console.log('     编译后 ' + state.compiledChars + ' 字，待裁决候选 ' + state.pending + ' 条')
for (const slot of state.slots) console.log('     · ' + slot.label + '：' + (slot.enabled ? '启用' : '未启用') + ' ' + slot.chars + '/' + slot.budget)
if (state.warning) console.log('     [警告] ' + state.warning)

if (state.compiledChars === 0) {
  console.log('')
  console.log('[!] 契约还是空的 —— 路由通了说明插件已加载，但系统提示里现在没有插入任何东西。')
  console.log('    填槽：设置 → 小蛛；或 node scripts/compile.mjs 先看编译结果。')
  process.exit(0)
}

console.log('')
console.log('[ok] 段内容非空。下一轮对话的系统提示里应当出现 persona:spider-supplement 这一段。')
