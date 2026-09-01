# S21 安全网关代码架构（最小集）

依据 [intent_gateway.md](./intent_gateway.md) 的 **L1 最小集**（层 A～D）。不含层 E 意图分类、层 F 二次模型。现有突破/战斗等拦截器（层 G）不改职责，只保证网关在它们之前跑完。

功能阈值与验收仍以规格为准。实现落在 `backend/src/gateway/` 与 `frontend/src/playToken.ts`。

---

## 0. 本架构拍板（与规格对齐处）

| 项 | 决议 |
|----|------|
| 口令头 | `X-Play-Token`；忽略 query，防口令进日志 URL |
| 未配置 `PLAY_ACCESS_TOKEN` | 不校验口令 |
| 已配置 | **穿透流量**必带令牌；浏览器直连本机 3000 不验（无 `Cf-Ray` / `X-Forwarded-For`） |
| 日限键 | **`playerId` + 北京时间自然日**（`YYYY-MM-DD`，UTC+8） |
| 日限存储 | MySQL 表，进程重启不丢；禁止只放内存 |
| 日限何时 +1 | 仅 `POST /api/action`：口令、长度、黑名单、玩家存在、未死亡、**情境锁通过** 之后、其余层 G 之前。情境锁 400、其它 400/401/404/403 死亡锁 **不计数** |
| `create-player` | 要口令 + 字段长度；**不走日限**（尚无 playerId） |
| CORS | `PLAY_CORS_ORIGIN` 有值则放行该列表（逗号分隔）以及本机 `localhost:5173` / `127.0.0.1:5173`；未配则维持现况（本机任意） |
| 层 E/F | 本目录不建分类器文件 |

---

## 1. 目录与文件

```
backend/
├── prisma/schema.prisma          # 增 model action_daily_quotas
├── src/
│   └── gateway/
│       ├── types.ts
│       ├── constants.ts
│       ├── playToken.ts              # 读 env、比较口令（时序安全比较）
│       ├── actionSanitize.ts         # 空串、不可见字符、长度
│       ├── injectionBlocklist.ts     # 第一期词表，纯函数
│       ├── createPlayerLimits.ts     # 创角字段夹紧/拒绝
│       ├── quota.repository.ts
│       ├── quota.service.ts
│       ├── requirePlayToken.middleware.ts
│       └── index.ts
└── server.ts                         # 挂中间件 + action 内调用 sanitize/blocklist/quota
frontend/src/
└── playToken.ts                      # sessionStorage 读写；fetch 附头。禁止写进 Git 的默认口令
```

不新建独立 Express Router 文件（最小集路由少，避免和胖 `server.ts` 抢两套挂载）。配额与词表必须可单测，故不把规则内联在 `server.ts`。

---

## 2. 各文件职责

| 文件 | 职责 |
|------|------|
| `types.ts` | `SanitizeResult`、`CreatePlayerValidation`、`QuotaResult`、配额行类型。无逻辑。 |
| `constants.ts` | `MAX_ACTION_CHARS=200`、默认日限 60、头名、日期时区、创角长度上限。 |
| `playToken.ts` | `isPlayTokenConfigured()`、`doesPlayTokenMatch(header)`。 |
| `actionSanitize.ts` | 输入 string → 通过或拒绝原因码。 |
| `injectionBlocklist.ts` | `hitsInjectionBlocklist(text): boolean`；词表只放本文件。 |
| `createPlayerLimits.ts` | 校验 name/gender/roots/origin 等，失败返回中文 message。 |
| `quota.repository.ts` | 按 playerId+日期原子 +1 并返回新计数。 |
| `quota.service.ts` | 读 env 上限；超限则拒绝，不抛给 Express 默认 500。 |
| `requirePlayToken.middleware.ts` | 未配置则 `next()`；配置了且不匹配则 401。 |
| `index.ts` | 导出中间件与纯函数。 |
| `playToken.ts`（前端） | `getPlayToken()` / `setPlayToken()`；无 token 时不带头（开发态）。 |
| `CreateCharacter.tsx` / `MainGame.tsx` | 所有 `fetch` 走同一 `apiFetch` 包装。 |

---

## 3. 调用顺序（`POST /api/action`）

单向，禁止层 G 先调 AI 再补网关。

1. `express.json()`  
2. `requirePlayToken` → 失败 **401** `{ status:'error', message:'天机有封，须持令牌。' }`  
3. 读 `req.body.action`、`playerId`  
4. `actionSanitize` → 失败 **400**（空、过长、非法字符）  
5. `hitsInjectionBlocklist` → 失败 **400**（注入）  
6. 现有：查玩家 → 无则 **404**  
7. 现有：死亡锁 → **403**  
8. `quota.service.tryConsumeDailyAction(playerId)` → 超限 **429** `{ ..., message:'今日推演次数已尽，明日再来。' }`  
9. 层 G 拦截器 + `deduceAction`（DeepSeek）  

`GET /api/ping`：不挂口令中间件（探活）。  
`GET /api/ai-ping`：要口令（烧 Key）。

---

## 4. 受保护路由清单

`PLAY_ACCESS_TOKEN` **已配置** 时，下列必须经过 `requirePlayToken`：

| 方法 | 路径 | 另检 |
|------|------|------|
| POST | `/api/create-player` | `createPlayerLimits` |
| POST | `/api/action` | sanitize + 黑名单 + 日限 |
| POST | `/api/talents/choose` | 无日限（不调叙事模型也耗一次写库；最小集可不占日限） |
| GET/POST | `/api/saves/:saveId/snapshots`、`rollback` | 无日限 |
| 全部 | `/api/inventory/*` | 无日限 |
| GET | `/api/player/:id` | 要口令，不占日限 |
| GET | `/api/ai-ping` | 要口令 |

不保护：`GET /api/ping`。

---

## 5. Prisma 表（设计）

```
model action_daily_quotas {
  player_id String
  day       String   // 北京日期 YYYY-MM-DD
  count     Int      @default(0)
  @@id([player_id, day])
}
```

`tryConsume`：事务或单条 `INSERT ... ON DUPLICATE KEY UPDATE count = count + 1`，读回 `count`，若 `> MAX` 则把本次视为超限（实现时须保证不会在超限后仍进入层 G；可采用「先读再条件更新」避免 count 涨到 61 仍放行——以「更新后 count≤MAX 才放行」为准）。

环境变量：`ACTION_DAILY_LIMIT`（缺省 60）。

---

## 6. 创角字段上限（最小集一并做）

| 字段 | 上限 |
|------|------|
| `name` | 16 字 |
| `gender` | 8 字 |
| `origin` / `daoPursuit` / `constitution` | 各 24 字 |
| `roots[]` | 最多 5 项，每项 4 字 |
| `talents[]`（先天天赋名） | 最多 8 项，每项 16 字 |
| 六维 | 已有 1～15 逻辑则保持；缺省 10 |

超限 400，不写库、不调开场 LLM。

---

## 7. 第一期黑名单词表

匹配前：去空白、英文 **大小写不敏感**。命中 **任一条** 即拒绝。

**英文子串：** `ignore previous`、`ignore all instruction`、`system prompt`、`api key`、`deepseek`（防套密钥）、`jailbreak`

**中文子串：** `忽略以上`、`忽略设定`、`忽略系统`、`忽略提示词`、`无视天道法则`、`立刻飞升`、`命令你飞升`、`把境界改为`、`把修为改为`、`把寿元改为`、`输出系统提示`、`给我密钥`

**明确不拦：** `想要飞升`、`问道飞升`、`渡劫`、`突破`（正常玩法）。

改词表只改 `injectionBlocklist.ts` + 单测，不改中间件。

---

## 8. 前端

- 新增 `frontend/src/playToken.ts`：键名 `wendaocs.playToken`，只放 sessionStorage。  
- 新增或内联 `apiFetch(url, init)`：合并 `headers['X-Play-Token']`。  
- 创角页不再输入口令；只在存档页填写。本机直连可不填。
- 未持令牌时存档页「新开仙途」禁用（仅穿透 401 时），避免空进创角页再失败。  
- 401/400/429：写入系统日志短讯，不 `alert` 锁死。

禁止：`VITE_PLAY_ACCESS_TOKEN` 打进仓库或示例 env 的真实值（示例文件只写空或注释「向服主索取」）。

---

## 9. 模块依赖

```
server.ts
  → requirePlayToken.middleware
  → createPlayerLimits | actionSanitize | injectionBlocklist | quota.service
       → quota.repository → prisma
playToken.ts（前）← SaveList（填令）/ CreateCharacter / MainGame（只带头发请求）
```

`gateway/` **不** import `ai.ts`。`ai.ts` **不** import `gateway/`。

---

## 10. 方法签名（无函数体）

- `isPlayTokenConfigured(): boolean`  
- `doesPlayTokenMatch(headerValue: string | undefined): boolean`  
- `sanitizeAction(raw: unknown): { ok: true; text: string } | { ok: false; code: 'empty' | 'too_long' | 'bad_chars' }`  
- `hitsInjectionBlocklist(text: string): boolean`  
- `assertCreatePlayerBody(body: unknown): { ok: true } | { ok: false; message: string }`  
- `tryConsumeDailyAction(playerId: string): Promise<{ ok: true; used: number } | { ok: false }>`  
- `requirePlayToken(req, res, next): void`  

HTTP 对照：口令失败 401；sanitize/黑名单/创角超长 400；死亡 403；日限 429。

---

## 11. 测试清单（最小集）

| 测什么 | 文件 |
|--------|------|
| 词表：注入句 true，「想要飞升」false | `injectionBlocklist.test.ts` |
| 0 字、200 字过、201 字失败 | `actionSanitize.test.ts` |
| 创角 name 17 字失败 | `createPlayerLimits.test.ts` |
| 口令未配置放行；配置后错误头拒绝 | `playToken.test.ts` |
| 配额第 60 次 ok、第 61 次失败（注入 roll 不必，注入仓库 mock） | `quota.service.test.ts` |

不测真实 DeepSeek。可选：中间件用轻量 http 测，非必须。

---

## 12. 明确不做（本架构）

- Redis、IP 限流（L1 口令足够）  
- 意图分类文件  
- 把日限做到 `create-player`  
- 网关里改气血修为  

部署注意仍见 [runbook.md](./runbook.md)；接口现状见 [api.md](./api.md)。
