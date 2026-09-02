# S22 长效记忆与大事记（规格）

规格先行。**薄实现已提前到路线 A6**（试玩叙事割裂，属补全现有行动环）；完整 30 回合压缩备忘录与 `chronicles` 表仍属阶段 **D1**。A6 薄做代码已落地；D1 全表代码未写。AI 仍不得改数值；短记忆与大事记都只约束叙事上下文。

调用顺序以 [player_agency.md](./player_agency.md) 第 7 节为准：A6 读写发生在日限之后、`deduceAction` 之前（读）与本回合成功落库时（写）。禁止用模型判断「该不该继续救老人」。

---

## 0. 薄实现（A6，试玩优先）

要解决的当场问题：模型每回合失忆；玩家写「搜寻机缘 / 继续前行」就会另开一场，上一场重伤者、玉简蒸发。白狐一类新戏**多半不是第二次探索骰**（「搜寻机缘」不含历练关键词），必须靠注入块拦住，不能只拦「掷骰机缘」字样。

### 0.1 做 / 不做

| 项 | A6 |
|----|-----|
| 上一回成功 `narrative` 规则截断后注入本次 `deduceAction`（**不要**再调一次 LLM 做摘要） | **必做** |
| 未收束场景：`pending_scene ≠ none` 时注入「勿无故另开互不相关奇遇」；选项须点名当前场 | **必做** |
| 未收束时**跳过**本回合 `rollExplorationEncounter`（避免地上还有人又强制第二场大能/秘境） | **必做** |
| 字段落在 `world_state`，随现有快照回滚（与 `scene_context` 同命运） | **必做** |
| 每 30 回合重算 800 字备忘录、局内天机簿页 | **A6 不做**（D1） |
| 未收束 → HTTP 400（把「搜寻机缘」整句打回） | **禁止**；只锁叙事 |
| 把 `scene_context` 扩成第三种「未收束奇遇」并走情境锁 | **禁止**；情境锁仍只有 `none \| combat` |
| 用模型判断离开/续场 | **禁止** |

### 0.2 存什么（与 D1 大事记分开）

A6 **不入库整段剧情**，也不建大事记表。只在 `world_state` 增加两列（英文标识符；Prisma 5 + `db push`；若 generate 遇 EPERM 先停 `tsx watch`）：

| 列 | 取值 | 说明 |
|----|------|------|
| `last_narrative_digest` | 字符串，可空 | 上一回成功叙事截断。上限 **120** 个 Unicode 码位（与网关 200 字行动上限同量级、更短）。超出直接 `slice`，不省略号堆设定。空 = 尚无上一回（开局第一动）。 |
| `pending_scene` | `none`（缺省）/ `wounded_expert` / `secret_realm` | 未收束奇遇**类型**。**不存 NPC 名**（人名来自本回合 AI，掷骰当下没有）。 |

禁止把 digest 写进 `chronicles`；D1 条目仍必须是拦截器模板句（§4），与本列无关。

### 0.3 未收束：何时置上 / 何时清掉

**置上（本回合成功落库之后）：**

- 本回合探索骰 `triggered` 且类型为 `wounded_expert` 或 `secret_realm` → 写成对应 `pending_scene`（覆盖旧值）。
- 不把「模型自己编了路边老人、骰子没出」写成 pending 类型；那种续场只靠 `last_narrative_digest`（玩家下句若写「为老者疗伤」仍接得上）。

**不算离开（pending 保持，且必须注入「勿另开」）：**

子串命中任一条仍视为未收束：`搜寻机缘`、`继续前行`、`前行`、`历练`、`探索`、`游历`、`另寻`（未搭配下面「算离开」词）。  
试玩句「继续前行，搜寻机缘」**必须**落在本档——这是 A6 存在的理由。

**算离开（本回合成功落库后把 `pending_scene` 置 `none`）：**

明文子串，禁止正则、禁止模型。命中任一条即可（实现时写死数组）：

`不管他`、`弃之不顾`、`抛下`、`丢下`、`告辞`、`就此别过`、`转身离去`、`离开此地`、`回府`、`闭关`

「闭关」同时仍走闭关拦截器加修为；A6 只额外清 pending（人已被丢在山里）。

秘境：行动含 `进入秘境` / `踏入秘境` / `放弃秘境` / `不进秘境` → 清 `secret_realm`。不必穷尽小说。

**不要**用「未点名 NPC」当离开条件（名字本回合才可能出现）。

### 0.4 注入块（与 A5 的 forcedOutcome 分工）

A5 继续拼拦截器 `forcedOutcome`。A6 另给 `deduceAction` 一段固定中文，放在 system prompt **玩家行动之前**（不要与 A5 段落糊成一句以免抢「最高指令」）：

```
【近事】上一回：{last_narrative_digest 或「无」}
【未收束】{若 pending=none：无；否则对应一句}
```

未收束句模板（写死，可单测）：

- `wounded_expert`：场上仍有未了的重伤之人（或其所托之物）。叙事须接续此事；禁止另开互不相关的新奇遇（幼兽、另一路人、第二场秘境等）。`next_options` 须点名当前场（继续救治 / 检视所赠 / 明确抛下），禁止只给「搜寻机缘」万金油。
- `secret_realm`：秘境仍在眼前未决。须写进入、放弃或观望；禁止假装没看见另起炉灶。选项同上理。

有 digest 无 pending 时只注入【近事】，不禁止新奇遇。

### 0.5 调用顺序（`ActionService.execute`）

与 [player_agency.md](./player_agency.md) 第 7 节同一套，此处只写 A6 细项。单向，禁止先调 AI 再补近事。

1. 口令 / 净化 / 黑名单 / 死亡锁 / 情境锁 / 日限（不变）  
2. **读** `last_narrative_digest`、`pending_scene`  
3. 既有拦截器（突破、闭关、物品、**探索骰**等）  
   - 若 `pending_scene !== none`：**不要调用** `rollExplorationEncounter`（本回合当没出门掷奇遇）  
4. A5 `detectMiracleClaim` / `rollMiracle`  
5. 按 0.4 拼近事注入 → `deduceAction`  
6. 战斗公式、写库  
7. **仅当本回合成功**（将返回 200）：用本回 `narrative` 覆盖 digest（截断 120）；按 0.3 更新 pending。情境锁拒绝、死亡 403、日限 429 **不改**这两列。

### 0.6 文件与签名（无函数体）

```
backend/src/services/sceneMemory.service.ts
```

- `truncateNarrativeDigest(text: string): string` — 空串得 `''`；取前 120 码位。  
- `parsePendingScene(raw: unknown): 'none' | 'wounded_expert' | 'secret_realm'` — 未知当 `none`，不抛。  
- `detectPendingLeave(action: string, pending): boolean` — pending 为 `none` 则恒 false。  
- `buildSceneMemoryPrompt(digest: string, pending): string` — 供 `deduceAction` 插入。  
- `nextPendingScene({ pending, encounterType, action, leave }): PendingScene` — 纯函数，单测用固定句。

`ai.ts`：`deduceAction` 增加可选参数 `sceneMemoryPrompt?: string`（空则不插【近事】）。  
Repository：在 `WorldStateRepository` 读写两列；不要在路由里散落 `prisma.world_state`。  
未知列 / 旧库：学 `scene_context` 的 persistable 降级，**禁止**整次回合 500。

骰子：本文件 A6 **不掷骰**。探索骰仍在 `exploration.service.ts`，只是 pending 时跳过。

### 0.7 验收（A6）

单测用固定行动句，注入 `rollFn` 处与探索骰现有测法一致；**不测**真实 DeepSeek。

- 无 digest 的第一动：`buildSceneMemoryPrompt` 含「上一回：无」，没有未收束句。  
- 写入 digest 后下一动 prompt 含该截断句，不是空白。  
- 120 字截断：第 121 码位丢掉。  
- 探索骰出 `wounded_expert` 后，下一句「继续前行，搜寻机缘」：`detectPendingLeave` 为 false；注入块含「禁止另开」；本回合**不**再 `rollExplorationEncounter`。  
- 下一句「弃之不顾，转身离去」：`detectPendingLeave` 为 true；成功落库后 pending 为 `none`。  
- 「再刺一剑」且 pending 为 `none`：不插入未收束句。  
- 不调用第二次 LLM。  

---


## 1. 要解决的问题（完整形态 / D1）

长局后模型忘掉仇家、恩情、关键丹药。需要后端保存「已发生事实」，定期压成备忘录注入 system prompt 顶部。A6 只覆盖「下一句还记得上一场」。

---

## 2. 实体

**A6：** `last_narrative_digest`、`pending_scene`，见第 0.2 节；**不是**大事记条目。

**D1：**

| 实体 | 一句话 |
|------|--------|
| 大事记条目 | 一条不可由玩家直接改写的事实 |
| 回合计数 | 该存档成功 `/api/action` 次数 |
| 压缩备忘录 | 每 N 回合由后端生成的短摘要（可规则拼接，第一期 **不要** 再花一次 LLM 压缩，以免双倍账单） |
| 注入块 | D1 备忘录放进 `deduceAction`；A6 近事块见 0.4，不要合成一块 |

---

## 3. 字段

**大事记条目**

- `save_id`、时间（游戏内年季 + 现实写入时）
- 类型枚举（建议）：救人、杀人、结仇、结缘、入宗/叛宗、获宝、失宝、渡劫成败、坐化友人、区域解锁、自定义短句
- 主语/宾语（人名或物品名，可空）
- 一句事实（后端模板生成，**禁止**把整段 AI 剧情原文入库）
- 重要度 1～3（3 永远进入备忘录）

**压缩备忘录**

- 纯文本，上限 **800** 汉字
- 生成规则第一期：按重要度降序取条目，模板拼接，超出则丢最低重要度
- 每 **30** 次成功行动重算一次并缓存到 `saves` 或独立表一行

---

## 4. 谁有权写入（D1 大事记）

仅拦截器在 **硬事实已发生后** 调用 `chronicle.append`。A6 **不要**调用本接口。例如：

- 战斗击杀且后端判定敌人死亡
- 功德/业力跨越阈值
- 宗门叛逃成功
- 双修成功
- 探索奇遇类型已掷出

AI JSON 里的「自称救了某人」**不可**单独成条目，除非拦截器也认定。

---

## 5. 注入与隐私

- A6【近事】只进服务端 prompt，不写进局内系统日志（玩家日志仍是本回 `narrative`）。  
- D1 备忘录同样只进 prompt；玩家侧展示由 **I19** 决定，不预定成「天机簿纯文字页」。  
- 回滚：A6 两列在 `world_state` 上，现有快照已拍 `world_state` 即可。D1 若另表，快照须含 chronicles 或回滚后删晚于快照的条目。  
- 轮回新存档：不自动继承仇杀名单；A6 两列随新 `world_state` 从空开始。天道点见 [endings.md](./endings.md)。

---

## 6. 铁律

- 备忘录不得包含「请把修为改为」类句子。  
- A6 的 digest 只是截断叙事，**不是** D1 大事记；禁止拿 digest 当「玩家救了某人」的硬事实去改功德。  
- 第一期不用第二次 LLM 做摘要（L1 省钱）。若日后用模型压缩，必须限额且失败时回退规则拼接。

---

## 7. 验收

**A6：** 见第 0.7 节。

**D1（完整）**

- 30 回合后 prompt 含非空备忘录。
- 击杀类仅在战斗结算成功后出现一条。
- 回滚后面目条数与快照一致。
- 单测：拼接截断 800 字、重要度排序、禁止 AI 直写。
