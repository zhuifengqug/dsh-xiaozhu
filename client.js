window.__ModuleLoader__.load({
  id: '@zhuifengqug/dsh-spider',
  factory: function (require) {
    var React = require('react')
    var h = React.createElement

    var CSS = [
      '.xz{display:flex;flex-direction:column;gap:20px;padding:2px;color:var(--dsw-alias-label-primary,#1f2328);font-size:13px;line-height:1.6}',
      '.xz-head{display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;font-size:12px;color:var(--dsw-alias-label-secondary,#656d76)}',
      '.xz-head code{font-size:11px;opacity:.85}',
      '.xz-block{border:1px solid var(--dsw-alias-border-secondary,#d8dee4);border-radius:10px;padding:14px 16px;background:var(--dsw-alias-bg-elevated,#fff)}',
      '.xz-title{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:4px}',
      '.xz-title b{font-size:14px}',
      '.xz-hint{font-size:12px;color:var(--dsw-alias-label-secondary,#656d76);margin-bottom:10px}',
      '.xz-slot{border-top:1px dashed var(--dsw-alias-border-secondary,#d8dee4);padding-top:12px;margin-top:12px}',
      '.xz-slot:first-of-type{border-top:0;padding-top:0;margin-top:0}',
      '.xz-slot-head{display:flex;justify-content:space-between;gap:8px;align-items:center}',
      '.xz-slot-head span{font-weight:600}',
      '.xz textarea{width:100%;box-sizing:border-box;min-height:84px;resize:vertical;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-secondary,#d8dee4);background:transparent;color:inherit;font:inherit;line-height:1.55}',
      '.xz textarea:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#2f6feb)}',
      '.xz-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#656d76)}',
      '.xz-foot .grow{flex:1}',
      '.xz button{cursor:pointer;border-radius:7px;border:1px solid var(--dsw-alias-border-secondary,#d8dee4);background:transparent;color:inherit;font:inherit;font-size:12px;padding:4px 10px}',
      '.xz button:hover{border-color:var(--dsw-alias-brand-primary,#2f6feb);color:var(--dsw-alias-brand-primary,#2f6feb)}',
      '.xz button.primary{background:var(--dsw-alias-brand-primary,#2f6feb);border-color:transparent;color:#fff}',
      '.xz button.primary:hover{opacity:.88;color:#fff}',
      '.xz button:disabled{opacity:.45;cursor:default}',
      '.xz-pre{margin:0;padding:10px 12px;border-radius:8px;background:rgba(127,127,127,.08);white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;max-height:240px;overflow:auto}',
      '.xz-row{display:flex;gap:10px;padding:9px 0;border-top:1px dashed var(--dsw-alias-border-secondary,#d8dee4)}',
      '.xz-row:first-child{border-top:0}',
      '.xz-row .body{flex:1;min-width:0}',
      '.xz-row .meta{font-size:11px;color:var(--dsw-alias-label-secondary,#656d76)}',
      '.xz-chip{display:inline-block;padding:0 6px;border-radius:5px;background:rgba(127,127,127,.14);font-size:11px;margin-right:6px}',
      '.xz-err{color:#cf222e;font-size:12px}',
      '.xz-ok{color:#1a7f37;font-size:12px}',
      '.xz-diff{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;white-space:pre-wrap;margin:4px 0 0}',
      '.xz-diff .add{color:#1a7f37}',
      '.xz-diff .del{color:#cf222e}',
      '.xz-empty{color:var(--dsw-alias-label-secondary,#656d76);font-size:12px}',
      '.xz-check{display:flex;gap:6px;align-items:center;font-size:12px}'
    ].join('\n')

    function ensureStyle() {
      if (typeof document === 'undefined') return
      if (document.getElementById('xz-spider-css')) return
      var el = document.createElement('style')
      el.id = 'xz-spider-css'
      el.textContent = CSS
      document.head.appendChild(el)
    }
    ensureStyle()

    function api(method, suffix, body) {
      var init = { method: method, cache: 'no-store' }
      if (body !== undefined) {
        init.headers = { 'content-type': 'application/json' }
        init.body = JSON.stringify(body)
      }
      return fetch('/api/spider' + suffix, init).then(function (res) {
        return res.json().catch(function () { return { ok: false, error: 'HTTP ' + res.status } })
      }).then(function (data) {
        if (!data || data.ok === false) throw new Error((data && data.error) || '请求失败')
        return data
      })
    }

    function fmtTime(iso) {
      if (!iso) return ''
      var d = new Date(iso)
      if (isNaN(d.getTime())) return String(iso)
      return d.toLocaleString('zh-CN', { hour12: false })
    }

    function Block(props) {
      return h('section', { className: 'xz-block' },
        h('div', { className: 'xz-title' }, h('b', null, props.title), props.right || null),
        props.hint ? h('div', { className: 'xz-hint' }, props.hint) : null,
        props.children)
    }

    function useLoader() {
      var stateRef = React.useState(null)
      var errRef = React.useState('')
      var busyRef = React.useState('')
      var draftRef = React.useState({})
      var enabledRef = React.useState({})
      var state = stateRef[0]
      var setState = stateRef[1]
      var error = errRef[0]
      var setError = errRef[1]
      var busy = busyRef[0]
      var setBusy = busyRef[1]
      var drafts = draftRef[0]
      var setDrafts = draftRef[1]
      var enabled = enabledRef[0]
      var setEnabled = enabledRef[1]
      var stamp = state ? String(state.updatedAt) + '|' + String(state.compiledChars) : ''

      function load() {
        return api('GET', '/state').then(function (data) {
          setState(data)
          return data
        }).catch(function (e) {
          setError(String(e && e.message ? e.message : e))
        })
      }

      React.useEffect(function () { load() }, [])

      React.useEffect(function () {
        if (!state) return
        var nextDraft = {}
        var nextEnabled = {}
        state.slots.forEach(function (slot) {
          nextDraft[slot.id] = slot.text
          nextEnabled[slot.id] = slot.enabled
        })
        setDrafts(nextDraft)
        setEnabled(nextEnabled)
      }, [stamp])

      function run(name, fn) {
        setBusy(name)
        setError('')
        return fn().then(function () { return load() }).catch(function (e) {
          setError(String(e && e.message ? e.message : e))
        }).then(function () { setBusy('') })
      }

      return { state: state, setState: setState, error: error, busy: busy, drafts: drafts, setDrafts: setDrafts, enabled: enabled, setEnabled: setEnabled, run: run, reload: load }
    }

    function SlotEditor(props) {
      var slot = props.slot
      var value = props.draft === undefined ? slot.text : props.draft
      var chars = String(value || '').trim().length
      var over = chars > slot.budget
      return h('div', { className: 'xz-slot' },
        h('div', { className: 'xz-slot-head' },
          h('span', null, slot.label),
          h('label', { className: 'xz-check' },
            h('input', {
              type: 'checkbox',
              checked: !!props.enabled,
              disabled: !!props.busy,
              onChange: function (ev) { props.onToggle(ev.target.checked) }
            }),
            '启用')),
        h('div', { className: 'xz-hint', style: { margin: '4px 0 8px' } }, slot.hint),
        h('textarea', {
          value: value === undefined ? '' : value,
          spellCheck: false,
          placeholder: '只写判据，不写形容词。比如：句子以结论开头；被纠正时不解释，改完再回一句改了什么。',
          onChange: function (ev) { props.onChange(ev.target.value) }
        }),
        h('div', { className: 'xz-foot' },
          h('span', null, chars + ' / ' + slot.budget + ' 字', over ? ' · 超预算' : '')),
        h('div', { className: 'xz-foot' },
          h('span', { className: 'grow' }),
          h('button', {
            type: 'button',
            className: 'primary',
            disabled: !!props.busy || value === slot.text,
            onClick: props.onSave
          }, props.busy ? '保存中…' : '保存')))
    }

    function levelTag(level) {
      var color = level === 'error' ? '#cf222e' : level === 'warn' ? '#9a6700' : 'var(--dsw-alias-label-secondary,#656d76)'
      return h('span', { className: 'xz-chip', style: { color: color } }, level)
    }

    function SettingsSection() {
      var ui = useLoader()
      var state = ui.state

      if (!state) {
        return h('div', { className: 'xz' },
          h('div', { className: 'xz-head' }, '正在读取小蛛契约…'),
          ui.error ? h('div', { className: 'xz-err' }, ui.error) : null)
      }

      var latest = state.checkups && state.checkups.length ? state.checkups[0] : null
      var pending = (state.candidates || []).filter(function (c) { return c.status === 'pending' })

      return h('div', { className: 'xz' },
        h('div', { className: 'xz-head' },
          h('span', null, '编译后 ' + state.compiledChars + ' 字'),
          h('span', null, '最近改动 ' + (fmtTime(state.updatedAt) || '从未')),
          h('code', null, state.root),
          h('span', { className: 'grow' }),
          h('button', { type: 'button', disabled: ui.busy === 'reload', onClick: function () { ui.run('reload', function () { return Promise.resolve() }) } }, '刷新')),

        ui.error ? h('div', { className: 'xz-err' }, ui.error) : null,

        h(Block, {
          title: '契约 → 编译结果',
          hint: state.compiledChars
            ? '这一段就是每轮拼进系统提示的原文。改完保存，下一轮自动生效，不用重启。'
            : '三槽都空，系统提示里不会插入任何东西 —— 现在的小蛛只是家族里那只没长人格的。'
        }, h('pre', { className: 'xz-pre' }, state.compiled || '（空）')),

        h(Block, { title: '补充槽', hint: '只写既有提示词没有覆盖的部分。与既有指令冲突时以既有指令为准 —— 这句话在编译时自动加，不用你写。' },
          state.slots.map(function (slot) {
            return h(SlotEditor, {
              key: slot.id,
              slot: slot,
              draft: ui.drafts[slot.id],
              enabled: ui.enabled[slot.id],
              busy: ui.busy === 'save:' + slot.id || ui.busy === 'toggle:' + slot.id,
              onChange: function (text) {
                var next = Object.assign({}, ui.drafts)
                next[slot.id] = text
                ui.setDrafts(next)
              },
              onToggle: function (on) {
                ui.run('toggle:' + slot.id, function () {
                  return api('POST', '/slot', { slot: slot.id, enabled: on })
                })
              },
              onSave: function () {
                ui.run('save:' + slot.id, function () {
                  return api('POST', '/slot', { slot: slot.id, text: ui.drafts[slot.id] || '' })
                })
              }
            })
          })),

        h(Block, {
          title: '体检',
          hint: '固定规则检查：称呼口径、客服腔、退让措辞、不可执行措辞、与底稿重复。不联网，同一输入永远同一结果。',
          right: h('button', {
            type: 'button',
            disabled: ui.busy === 'checkup',
            onClick: function () { ui.run('checkup', function () { return api('POST', '/checkup', {}) }) }
          }, '体检当前契约')
        },
          latest
            ? h('div', null,
                latest.items.length
                  ? latest.items.map(function (item, i) {
                      return h('div', { className: 'xz-row', key: 'ck' + i },
                        h('div', { className: 'body' },
                          h('div', null, levelTag(item.level), item.title, item.slot ? h('span', { className: 'xz-meta', style: { marginLeft: 6 } }, '(' + item.slot + ')') : null),
                          h('div', { className: 'xz-meta' }, item.evidence),
                          h('div', { className: 'xz-meta' }, '→ ' + item.hint)))
                    })
                  : h('div', { className: 'xz-ok' }, '最近一次体检没有命中任何规则。'),
                h('div', { className: 'xz-meta', style: { marginTop: 6, fontSize: 11 } }, '记录于 ' + fmtTime(latest.at) + ' · ' + (latest.source || '')))
            : h('div', { className: 'xz-empty' }, '还没有体检记录。'),

          h('div', { style: { marginTop: 14 } },
            h('div', { className: 'xz-hint', style: { marginBottom: 6 } }, '查重底稿（只做对比，不注入）'),
            h('textarea', {
              value: state.reference || '',
              placeholder: '把现有的人格 / 提示词粘贴到这里，体检时会比对是否重复。',
              onChange: function (ev) {
                var next = Object.assign({}, state, { reference: ev.target.value })
                ui.setState(next)
              }
            }),
            h('div', { className: 'xz-foot' },
              h('span', { className: 'grow' }),
              h('button', {
                type: 'button',
                disabled: ui.busy === 'reference',
                onClick: function () { ui.run('reference', function () { return api('POST', '/reference', { text: state.reference || '' }) }) }
              }, '保存底稿')))),

        h(Block, { title: '候选', hint: '模型只能往这里写。只有你点采纳，它才会落进槽里；驳回留痕，不会再提。' },
          pending.length
            ? pending.map(function (c) {
                return h('div', { className: 'xz-row', key: c.id },
                  h('div', { className: 'body' },
                    h('div', null, h('span', { className: 'xz-chip' }, c.slot), c.why || '（未说明理由）'),
                    h('pre', { className: 'xz-pre', style: { marginTop: 6 } }, c.text),
                    h('div', { className: 'xz-meta' }, c.id + ' · ' + fmtTime(c.at))),
                  h('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                    h('button', {
                      type: 'button',
                      className: 'primary',
                      disabled: !!ui.busy,
                      onClick: function () { ui.run('accept:' + c.id, function () { return api('POST', '/decide', { id: c.id, action: 'accept' }) }) }
                    }, '采纳'),
                    h('button', {
                      type: 'button',
                      disabled: !!ui.busy,
                      onClick: function () { ui.run('reject:' + c.id, function () { return api('POST', '/decide', { id: c.id, action: 'reject' }) }) }
                    }, '驳回')))
              })
            : h('div', { className: 'xz-empty' }, '没有待裁决的候选。')),

        h(Block, { title: '蜕', hint: '每次落盘都留一份改动前的样子。回滚不是撤销一步，是回到那一次之前的契约 —— 所以它会再留一层蜕。' },
          state.moults && state.moults.length
            ? state.moults.map(function (m) {
                return h('div', { className: 'xz-row', key: 'm' + m.seq },
                  h('div', { className: 'body' },
                    h('div', null, h('span', { className: 'xz-chip' }, '#' + m.seq), m.reason,
                      h('span', { className: 'xz-meta', style: { marginLeft: 8 } }, '+' + m.plus + ' / −' + m.minus)),
                    h('div', { className: 'xz-meta' }, fmtTime(m.at)),
                    m.preview && m.preview.length
                      ? h('pre', { className: 'xz-diff' }, m.preview.map(function (d, i) {
                          return h('div', { key: 'd' + i, className: d.op === '+' ? 'add' : 'del' }, (d.op === '+' ? '+ ' : '− ') + d.text)
                        }))
                      : null),
                  h('div', null,
                    h('button', {
                      type: 'button',
                      disabled: !!ui.busy,
                      onClick: function () {
                        if (typeof window !== 'undefined' && window.confirm && !window.confirm('回到 #' + m.seq + ' 之前那份契约？')) return
                        ui.run('rollback:' + m.seq, function () { return api('POST', '/rollback', { seq: m.seq }) })
                      }
                    }, '回滚')))
              })
            : h('div', { className: 'xz-empty' }, '还没有蜕。'))
      )
    }

    return {
      inject: ['slots'],
      apply: function (ctx) {
        var slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots
        if (!slots) return
        var register = function () {
          try {
            return slots.register({ name: 'settings.section', id: 'spider', order: 61, label: '小蛛' }, SettingsSection)
          } catch (e) {
            return undefined
          }
        }
        if (typeof slots.inject === 'function') {
          try {
            slots.inject('settings.section', register)
            return
          } catch (e) {
            /* 槽位未就绪时退化为直接注册 */
          }
        }
        register()
      }
    }
  }
})
