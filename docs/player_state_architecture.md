# I20 岁月加深架构

依据 [player_state.md](./player_state.md) 第 5.4、第 10 节。**已按本文落地**（schema 四列、纯函数、persistable、action 接线）；本文留作改代码的落点记录。**不改玩法语义、不改 Express 堆公式。** 词表只准改成册第 5.4.3 节。

---

## 0. 拍板

| 项 | 决议 |
|----|------|
| 月数权威 | 加深后成功回合 **不再采信** `DeducedAction.time_cost_months` |
| 随机 | 开场 3 或 6 时辰用可注入 `rollFn`（默认 `Math.random`） |
| 缺列 | 与 `scene_context` 相同：`$queryRaw` + persistable；缺列当 `dawn` / 0 / `none`，不 500 |
| LLM | 禁止第二次调用；禁止用模型判档 |
| 前端 | `GET /api/player/:id` 附 `day_phase`（及可选日文案）；死后读档仍走现有 `ALWAYS_ENABLED`，缺口若仍在则只改灰键，不绕过口令 |

---

## 1. 改哪些文件

```
backend/prisma/schema.prisma     # world_state 四列
backend/src/services/playerState.service.ts
backend/src/services/playerState.service.test.ts
backend/src/repositories/worldState.repository.ts
backend/src/services/action.service.ts   # 调 AI 前算时；落库写四列
backend/ai.ts                           # 不改模型；prompt 可注「时间已由天道扣定」
frontend：player 展示日段（MainGame 顶栏 / StatusCard）；不新建 Mobile 页
```

禁止新建 `MobileTime.tsx` 或第二套 `/api/time`。

---

## 2. 纯函数（建议签名）

全部放 `playerState.service.ts`，单测同目录。

- `matchBeatKeywords(actionText)`：按成册优先级返回档位（闭关由现有函数先判，本函数可不含闭关）。
- `openingShichen(rollFn)`：`rollFn() < 0.5 ? 3 : 6`。
- `applyShichen(state, delta)`：累加 `pending_shichen`，满 3 换 `day_phase`，`night` 溢出进 `pending_days`；满 30 日返回应加的整月（0 或 1+）。
- `resolveActionClock({ actionText, beat, phase, shichen, days, seclusionMonths, craftMonths, rollFn })`：返回 `{ monthsPassed, nextBeat, nextPhase, nextShichen, nextDays, logPhrase }`。`logPhrase` 用「片刻 / 一时辰 / 晨转午 / N月」，禁止「流逝 0 个月」。

未知 `day_phase` / `beat_scene` 字符串：当 `dawn` / `none`，不 throw。

---

## 3. 编排

`ActionService.execute` 在拼 `forcedOutcome`、调 `deduceAction` **之前**算出本回合钟（闭关/炼制/历练/微行）。把日段短句写入 `forcedOutcome`（如「此时正值午时」）。调 AI 之后 **忽略** `time_cost_months`。

落库：与 A6 一样，成功回合才写四列。快照已含 `world_state` 则四列随回滚。

---

## 4. 开工顺序

1. schema 四列 + `db push` / `generate`（EPERM 先停 `tsx watch`）。
2. 纯函数 + 成册第 11 节加深用例（含 `rollFn` 0 / 0.99）。
3. repository persistable。
4. `action.service` 接线；确认「与掌柜闲聊」不再 `monthsPassed === 1`。
5. 前端展示日段（可极薄）。死后读档灰键若仍在，顺手修，不挡公式。

禁止先改 `ai.ts` 模型名来「让时间变准」。
