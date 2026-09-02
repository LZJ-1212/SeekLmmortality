# I21 境界加深架构

依据 [realms.md](./realms.md) 第 10 节。**代码尚未按本文落地**；改拦截器前先对成册。不改第 5.2 节门槛数字、不写结局 UI、不把压制公式搬进 `playerState.service.ts`。

---

## 0. 拍板

| 项 | 决议 |
|----|------|
| 表权威 | `REALM_LAWS` 与成册第 5.2 节同一套数字；改一处必须改另一处 |
| 位阶 | 继续只用 `combat.service.ts` 的 `REALM_RANKS`；突破函数不复制 rank |
| 随机 | 已有 `successRoll` / `deathRoll`；钟用现有 `rollFn` 通道，本项加深 **不新掷骰** |
| 终局 | `isTerminal: true` 写在法则行上；`resolveBreakthroughAttempt` 在无键判定之后、修为判定之前认终局 |
| 钟 | `resolveActionClock` 增加可选 `tribulationClock`，由 `ActionService` 按突破结果填，**禁止**在钟函数里再 `includes('渡劫')` |
| LLM | 禁止第二次调用；禁止模型填境界 |
| 搬家 | 法则表可仍留 `playerState.service.ts`；禁止新路由 `/api/realm` |

---

## 1. 改哪些文件

```
backend/src/services/playerState.service.ts      # RealmLaw.isTerminal；终局行；文案；钟入参
backend/src/services/playerState.service.test.ts  # 终局、文案、钟档（可测纯函数）
backend/src/services/action.service.ts           # 由 breakthroughResult 推导 tribulationClock
docs/realms.md                                   # 数字若改才动第 5.2 节
docs/content_catalog.md                          # 只改摘要/链接，不抄全表
frontend：不必新页；状态卡已有 大境·小境
```

禁止新建 `RealmPanel.tsx`。天赋三选一仍走现有 `pickRandomTalentChoices`（I26）。

---

## 2. 纯函数

### 2.1 `RealmLaw`

增加可选 `isTerminal?: boolean`。终局行：

```
'渡劫期·飞升': { next: '渡劫期·飞升', reqCultivation: 0, isMajor: false, isTerminal: true }
```

`reqCultivation: 0` 避免误走「修为不足 -10 血」。终局枝 **不读** 修为。

### 2.2 `resolveBreakthroughAttempt` 插入点

现顺序：无键 → 修为不足 → 小境 → 大境。

改为：无键 → **终局（`law.isTerminal`）** → 修为不足 → …

终局返回：`success: false`，`patch` 原样，文案见成册第 10.2 节。

无键文案改为成册第 10.3 节，**不改 mp**（本项不引入扣灵力）。

### 2.3 钟

扩展 `ActionClockInput`：

```
tribulationClock?: 'none' | 'minor' | 'major' | 'blocked'
```

缺省 `'none'`（非突破回合）。优先级见成册第 10.1 节：插在炼制之后、历练之前。

| 值 | 何时由编排填 | 钟 |
|----|----------------|-----|
| `none` | 未点突破词 | 不走进本档 |
| `minor` | 小境成功 | 1 时辰，`beat=none` |
| `major` | `isMajor` 且已过修为门槛（成功、重伤、轰灭） | 1 月，`beat=none`，`phase=dusk`，微行时辰清 0 |
| `blocked` | 无键 / 终局 / 修为不足 | 1 时辰，`beat=none` |

推导（编排，不要第二套关键词）：

```
if (!breakthroughResult) → 不传或 none
else if (终局或无键或修为不足文案枝) → blocked
else if (isMajor 路径已骰过，含失败) → major
else → minor   // 小境成功
```

修为不足现码不带 `isMajor` 成功；用「键存在且 cultivation < req」判断为 `blocked`，不要用文案子串。建议纯函数返回增加 `clockKind`，避免编排猜。

`BreakthroughAttemptResult` 增：

```
clockKind: 'minor' | 'major' | 'blocked'
```

无键/终局/修为不足 → `blocked`；小境成功 → `minor`；大境无论成败 → `major`。

---

## 3. 编排

`ActionService` 在现有 `resolveBreakthroughAttempt` 之后、`resolveActionClock` 之前把 `clockKind` 传入。闭关月数仍优先：有 `seclusionMonths` 则钟函数不看 `tribulationClock`。

大境轰灭仍走死亡锁落库；钟仍记 1 月（人已死，世界历可以走一个月——与「雷劫当天」叙事由模型写，主钟加月是天道账）。

---

## 4. 开工顺序

1. `RealmLaw` + 终局行 + 无键文案；单测终局与未知键文案。
2. `clockKind` 返回值 + `resolveActionClock` 一档；成册第 11 节加深用例。
3. `action.service` 传入 `tribulationClock`（或直接 `clockKind`）。
4. 全套 `npm test`；前端不必为 B2 强制 `build`（无 UI 合同变更时）。

禁止先改 `ai.ts` 让模型「少写飞升」。禁止为手玩全境界去改表内成功率。
