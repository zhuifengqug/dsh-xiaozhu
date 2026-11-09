# 小蛛 · dsh-spider

虫珀第四只。它不换掉任何人，只把「还差一点」的那部分补上：三槽契约 → 一段编译好的系统提示，加蜕、候选裁决、体检。

## 为什么是补充段，不是替换

现有的人设（mnemon 的长期记忆、aegis 的方法论、宿主自带的人格前缀）已经占了系统提示的大半。往里再塞一整副新人设，只会互相打架。小蛛只做两件事：写进既有指令没覆盖的缝里，并在编译时固定加一句「与既有指令冲突时以既有指令为准」。

## 四个部件

- **补充槽**：`texture`（性格质感）、`relation`（关系层）、`proactive`（主动行为）。各自可独立启用，编译按固定顺序拼，同一份契约永远编译出同一份字节。
- **编译注入**：`ctx.systemPrompt.section({ name: 'persona:spider-supplement', order: 5060, text: () => … })`，text 是函数 ⇒ 每次组提示都读当前契约，改完保存下一轮生效，不用重启。
- **蜕**：每次落盘把改动前的契约与行级 diff 存进 `moults/0001-edit-texture.json`。回滚是「回到那次之前的契约」，因此回滚本身也会再留一层蜕。
- **候选**：模型只有 `spider_propose` 一个写口，写进候选池，不进提示。必须人在设置页点采纳。
- **体检**：固定规则查称呼口径、客服腔、退让措辞、不可执行措辞、与底稿重复。不联网、不调模型。

## 文件落地

默认 `$DSH_HOME/spider/`（可用 `DSH_SPIDER_ROOT` 或 apply 的 `config.root` 覆盖）：

- `contract.json` —— 三槽 + 查重底稿
- `candidates.json` —— 候选池（最多 300 条）
- `checkups.json` —— 体检记录（最多 200 条）
- `moults/0001-*.json` —— 蜕

## 工具

| 名字 | 作用 |
| --- | --- |
| `spider_propose` | 提候选（唯一写口，只写候选池） |
| `spider_contract` | 读当前编译结果与各槽状态 |
| `spider_checkup` | 对一段文本或当前契约跑体检 |

## 依赖

零 `@deepseek-ai` 依赖：系统提示走 `ctx.systemPrompt.section`，工具用裸 JSON Schema 对象交给 `ctx.tools.register`，页面走 `ctx.webServer.register` + settings.section 槽位。桌面版 `autoInstallPeers: false` 也照常激活。

## 自检

```sh
npm run check:syntax
npm test
npm run check:naming
```
