# I22 战斗加深架构

修订：2026-09-05 14:40 +08 lzj — 创建：估算伤夹紧与敌境单测落点
修订：2026-09-05 14:51 +08 lzj — 本场气血与击毙已按成册落地
修订：2026-09-05 15:27 +08 lzj — 交手底数改攻防速
修订：2026-09-05 15:50 +08 lzj — 删掉旧估伤夹紧正文，公式只认 combat.md

依据 [combat.md](./combat.md) 第 10 节。本场气血、击毙、攻防速底数**已落地**。倍率与交手算术**只认**成册第 4 节，本文不另抄 0.4 / 秒杀档。不把招式库并进本项、不把天赋表搬进 `resolveCombatModifiers`。

---

## 0. 拍板

| 项 | 决议 |
|----|------|
| 表权威 | `REALM_RANKS` 只在 `combat.service.ts`；成册第 3 节同一套名 |
| 倍率与底数 | 只认 [combat.md](./combat.md) 第 4 节 |
| 估伤 JSON | 不参与结算；历史函数 `clampCombatBaseDamage` 仍导出，交手主路径不读 |
| 叠乘 | 天赋 / 命格在 `ActionService`；相对遁速在 `resolveCombatTurn`；秒杀枝仍不乘 |
| 敌境 | 未知键已当同阶；禁止 `includes('金丹')` 猜词 |
| LLM | 禁止第二次调用；禁止模型填胜负与落地气血 |
| UI | 禁止新建战斗页 |

---

## 1. 改哪些文件

```
backend/src/services/combat.service.ts           # 攻防速底数；resolveCombatTurn
backend/src/services/combat.service.test.ts      # 底数、空串/太上境/「金丹期」
backend/src/services/action.service.ts           # 传入神识/道心/遁速
docs/combat.md                                   # 算术唯一成册
frontend：不必新页
```

---

## 2. 敌境单测（现行为）

- `enemy_realm_major: ''` vs 炼气 → `normal`，`realmGap === 0`
- `'太上境'` vs 炼气 → 同上
- `'金丹期'`（多一个「期」）vs 炼气 → **未知同阶**，不要当金丹

交手底数与相对遁速见成册 4.4，本文不重写函数体。

---

## 3. 编排

`normal` 枝：成册 4.4 的底数再乘境界/五行/天赋/命格；承伤再乘相对遁速。

秒杀两枝不走该底数叠乘。

气血优先级（现码，本项**不要改顺序**）：突破 patch → 天罚 → 探索危险 → 双修 → 闭关回血 → 战斗掉血 / 模型 `hp_delta`。探索危险仍可能盖掉战斗伤。

---

## 4. 明确不做

- S20 招式槽、灵力耗招
- 敌方多五行 JSON
- 把 `getCombatDamageMultiplier` 并进 `resolveCombatModifiers`
- 新路由 `/api/combat`
