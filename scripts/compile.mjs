// 不开宿主也能看编译结果：读真实契约，打印会被拼进系统提示的那一段。
//   node scripts/compile.mjs          看编译结果
//   node scripts/compile.mjs --check  连体检一起看
import { createService } from '../lib/service.mjs'

const svc = createService()
const state = svc.getState()
const check = process.argv.includes('--check')

if (state.warning) console.log('[警告] ' + state.warning)
console.log('契约：' + state.root + '（' + (state.updatedAt || '从未保存') + '）')
for (const slot of state.slots) {
  console.log('· ' + slot.label + '：' + (slot.enabled ? '启用' : '未启用') + ' ' + slot.chars + '/' + slot.budget + ' 字')
}
console.log('---')
console.log(state.compiled || '（空 —— 三槽都没有启用的内容）')
console.log('---')
console.log('编译后 ' + state.compiledChars + ' 字' + (state.pending ? '，待裁决候选 ' + state.pending + ' 条' : ''))

if (check) {
  const latest = state.checkups && state.checkups[0]
  console.log('')
  console.log('最近一次体检：' + (latest ? latest.at + ' · ' + (latest.source || '') : '无'))
  if (latest && latest.items.length) {
    for (const item of latest.items) console.log('[' + item.level + '] ' + item.title + (item.slot ? ' (' + item.slot + ')' : '') + ' — ' + item.evidence)
  } else if (latest) {
    console.log('没有命中任何规则。')
  }
}
