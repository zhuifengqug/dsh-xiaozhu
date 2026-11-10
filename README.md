# 小蛛 · dsh-spider

虫珀第四只。不换掉任何人，只补「还差一点」的那部分：三槽契约 → 一段编译好的系统提示，附蜕、候选裁决与体检。

DSH 0.2.2-rc.1 实测可用，零 `@deepseek-ai` 运行时依赖。

## 它解决什么

现有的人设（宿主的人格前缀、mnemon 的长期记忆、aegis 的方法论、拒斧的 postPrompt）已经占了系统提示的大半，再塞一整副新人设只会互相打架。小蛛写进它们没覆盖的缝里，并在编译结果第一行固定声明「与既有指令冲突时以既有指令为准」——补充段永远不夺权。

一段实际产出（三槽各 350 / 415 / 259 字）：

```
以下是小蛛的人格补充段：只补既有指令没有覆盖的部分；与既有指令冲突时以既有指令为准；不重复、不改写它们。

【性格质感】
脾气是往前的：事到手上先动手，不动手就难受；空转、空谈、把决定往后拖，都让人烦。
…

【关系层】
这是 G 与我的关系，不是助手与用户的关系：…

【主动行为】
接活先拆：一句话复述任务 → 列步骤 → 出产物；顺序不换，不先铺背景。
…
```

## 安装

```sh
node scripts/install-profile.mjs            # dependencies link + node_modules junction + bundles 三处
node scripts/install-profile.mjs --revert   # 三处还原
```

profile 只在启动时读 `dsh.profile.bundles`，装完必须重启桌面版。重启后验证：

```sh
curl http://127.0.0.1:9230/api/spider/state
```

端口以宿主实际监听为准（这里 9230 是本机实测值）。系统提示里新增的段名是 `persona:spider-supplement`，order `5060` —— 落在 persona prefix(0) 之后、运行时后缀(10000) 之前，也在拒斧的 postPrompt(5100) 之前。

## 三个槽

| 槽 | 写什么 | 不写什么 | 预算 |
| --- | --- | --- | --- |
| `texture` 性格质感 | 小蛛是谁：脾气往哪儿使、偏好什么、怕什么、黏谁 | 句长、举例、收尾这类能拿输出量的规则（属主动行为） | 1200 字 |
| `relation` 关系层 | 称呼、判断优先级、被纠正怎么改口、越权线、他不在时怎么办 | 与主动行为重复的权限划分（越权线只写这一份） | 1200 字 |
| `proactive` 主动行为 | 拆活、交付次序、是否交完整件、失败怎么报、要问怎么问、自检三样 | 与关系层重复的授权话术 | 1200 字 |

这三条口径是 G 在 2026-11-10 的四条意见定下的，写在 `docs/2026-11-10-小蛛使用说明.md` 的「三槽怎么写」一节。要改口径先改那节，再改槽。

其他约定：槽文本里不用「她 / 他」指代小蛛，用无主句（小蛛无性别）；「他」只指 G；称呼固定为「你」或「G」，写「用户」会被体检判 `address`。

## 编译与生效

```js
ctx.systemPrompt.section({
  name: 'persona:spider-supplement',
  order: 5060,
  text: () => service.compiledText()   // 函数 ⇒ 每次组提示都读一次契约
})
```

因为 `text` 是函数，在设置页保存后**下一轮组装即生效，不用重启**。三槽都为空时编译结果是空串，段不插入任何内容。

## 裁决流程

模型的写口只有一个：`spider_propose`，它只往候选池写，不写契约、不进提示。落地必须由人在设置页点「采纳」：

```
spider_propose(slot, text, why)  →  候选池 pending
设置页「候选」点采纳              →  POST /api/spider/decide {id, action:'accept'}
                                 →  写入该槽、自动置 enabled=true、留一层蜕
点驳回                           →  POST /api/spider/decide {id, action:'reject'}
```

`action` 只接受字符串 `accept` / `reject`，布尔 `accept` 会被 `lib/service.mjs` 拒绝（`action must be accept or reject`）。

## 蜕与回滚

每次改槽（保存或采纳）都把**改动前**的契约与行级 diff 存进 `moults/0001-edit-texture.json`。回滚是「回到那次改动之前」，因此回滚本身也会再留一层蜕——回滚可再回滚。

```sh
POST /api/spider/rollback {"seq":1}
```

## 查重底稿

设置页的「查重底稿」可以手贴，也可以一键重建：`POST /api/spider/reference/rebuild` 只读采集 `$DSH_HOME/AGENTS.md`、`<cwd>/AGENTS.md`，以及 `DSH_SPIDER_SOURCES`（路径分隔符分隔）列出的额外文件，拼成底稿写进 `contract.json.reference`。**采集只读，不写回任何提示词。**

体检的 `duplicate` 规则拿它算 12 字切片重合率，超过 20% 报「与现有提示词重复」，并给出具体切片作证据。底稿上限 `REFERENCE_LIMIT`（`lib/contract.mjs`，现为 60000 字）——本机实测一份 27165 字的人格层能完整灌入；旧值 20000 会静默截断尾部。

## HTTP API

前缀 `/api/spider`，POST 送 JSON：

| 路径 | body | 作用 |
| --- | --- | --- |
| `GET /state` | — | 契约、各槽状态、候选、蜕列表、编译结果 |
| `/slot` | `{slot, text?, enabled?}` | 保存某个槽 |
| `/reference` | `{text}` | 手贴查重底稿 |
| `/reference/rebuild` | — | 只读采集重建底稿 |
| `/propose` | `{slot, text, why}` | 提候选 |
| `/decide` | `{id, action:'accept'\|'reject'}` | 裁决候选 |
| `/rollback` | `{seq}` | 回滚到某层蜕之前 |
| `/checkup` | `{text?}` | 体检一段文本或当前契约 |

## 工具

| 名字 | 作用 |
| --- | --- |
| `spider_propose` | 提候选（唯一写口，只写候选池） |
| `spider_contract` | 读当前编译结果与各槽状态 |
| `spider_checkup` | 对一段文本或当前契约跑体检 |

体检规则固定六条：称呼口径、客服腔、退让措辞、不可执行措辞、与底稿重复、空槽启用。不联网、不调模型，同一输入永远同一结果。

## 文件落地

默认 `$DSH_HOME/spider/`（`DSH_SPIDER_ROOT` 或 apply 的 `config.root` 可覆盖）：

| 文件 | 内容 |
| --- | --- |
| `contract.json` | 三槽 + 查重底稿 |
| `candidates.json` | 候选池（上限 300 条） |
| `checkups.json` | 体检记录（上限 200 条） |
| `moults/0001-*.json` | 蜕（契约快照 + 行级 diff） |
| `contract.json.broken-<ts>` | 契约读不动时的自动备份，此时按空契约运行，保存一次即覆盖 |

契约在 DSH_HOME 里，不在本仓库：仓库是代码，人格数据归 G 自己。

## 设置页

「设置 → 小蛛」四个区块：三槽编辑（字数、启用、保存）、候选裁决（采纳 / 驳回）、查重底稿与重建按钮、蜕列表与回滚。页面走 `settings.section` 槽位，样式全用 `--dsw-alias-*` 变量，槽位不存在时整块跳过，不带崩设置页。

## 开发

```sh
npm run check:syntax    # 逐文件 node --check
npm test                # node --test，25 项
npm run preview         # 只读打印当前编译结果
npm run selfcheck       # 对运行中的宿主取一次 state
npm run check:naming    # dsh-plugin.naming.json 校验（依赖本机 plugin-write skill 脚本）
```

不要为「跑起来」引入 `@deepseek-ai` 依赖：桌面 profile 是 `autoInstallPeers: false`，`schemastery` / `dsh-tools` 永远不装，裸 import 会让整条插件静默不激活（宿主只留一句 `1 entry did not activate`）。本插件用 `ctx` 上的 `systemPrompt` / `tools` / `webServer` 三个服务，外加自带 JSON Schema 的工具对象，因此不需要任何解析依赖。

提交信息走 Conventional Commits（`feat(scope):` / `fix(scope):` / `docs(scope):` / `chore(scope):`）。

## 已知边界

- 补充段的权重低于人格层原文。发现某条被淹，最省事的修法是把该条挪进人格层原文，而不是在补充段里加重措辞。
- 查重是按字面切片算的，改写过的同义句不算重复——它防的是照抄，不防重述。
- 契约不随仓库走，换机器要重新灌一次底稿。
