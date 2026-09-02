# 《问道长生》项目工作记录

维护约定：每完成一个系统或重大决议，更新本表「完成度 / 测试 / 下一动作 / 日期」。本文件只做项目管理，不写实现代码。

- 仓库：`https://github.com/LZJ-1212/SeekLmmortality`（当前公开，许可证 MIT，见仓库根目录 `LICENSE`）
- 技术栈：前端 `frontend/`（React + Vite + Tailwind v3）；后端 `backend/`（Express + TypeScript + Prisma 5 + MySQL `wendaocs`）；叙事引擎 DeepSeek（密钥仅 `.env`）
- 总设计：[docs/game_design.md](./game_design.md)
- 文档总目：[docs/README.md](./README.md)
- 声音规格：[docs/audio_system.md](./audio_system.md) · 声音架构：[docs/audio_architecture.md](./audio_architecture.md)
- 本记录最后更新：2026-09-02（B1 / I20 成册 + 加深落地 `player_state.md`）

完成度含义：0 未开工；1–39 规格或骨架；40–69 能跑但不完整；70–89 主路径可用、有缺口；90–99 测试较全、仅打磨；100 含上线验收（本项目尚无 100）。

工时与金钱为 **量级估算**（一人兼职 + AI 协作），不是报价单；上线前请用当时官网价复核 API/托管费。

---

## 1. 项目总览

| 维度 | 现状 |
|------|------|
| 产品形态 | 浏览器文字修仙；后端硬算数值，AI 只叙事 |
| 可玩性 | 本机可创角、行动、十二系统主路径可跑 |
| 声音 | 规格已确认，代码未写；**人声可延后**，BGM/SFX 可先做 |
| 上线 | 未上线；公开 GitHub + MIT；无账号、无支付、无限流；**API Key 未进仓库** |
| 测试 | 后端 Vitest（以 `backend` 下 `npm test` 为准；2026-09 起含情境锁）；前端无自动化测试；无正式 E2E |
| 文档 | 见 [README.md](./README.md)；含 [player_agency.md](./player_agency.md) 自由度总则 |
| 已知最大试玩风险 | 公网暴露 `/api` 且用你的 DeepSeek Key、无限流 |

整体（已实现玩法代码）：约 **78%**。  
整体（把规划中的功法/安检/记忆/灵兽/大势/结局算进去）：约 **45%**。  
整体（含托管、内容、声音、当「可给陌生人玩的产品」）：约 **35%**。

---

## 2. 系统清单（要开发什么、文档在哪、完成度、测试）

### 2.1 玩法十二系统 + 已落地配套

| ID | 系统 | 要做什么 | 技术文档 | 主要代码 | 完成度 | 测试 | 缺口 / 下一动作 |
|----|------|----------|----------|----------|--------|------|-----------------|
| S01 | 核心状态机 | HP/MP/修为/寿元/死亡锁 | [player_state.md](./player_state.md)（I20）；铁律 [game_design.md](./game_design.md) 一、四 | `playerState.service.ts`，`action.service.ts` `/api/action` | 92% | 有单测；行动接口手测过 | **成册+加深已完成**（日段/时辰/按场）；死后读档按钮仍属 S16 |
| S02 | 境界突破与雷劫 | 小境无风险、大境掷骰、功德加成 | 同上文件内有突破函数；成册待 **I21** `realms.md` | `playerState.service.ts` `REALM_LAWS` | 90% | 有单测 | 独立规格 **I21**；全境界手玩未铺满 |
| S03 | 时间与岁月 | 闭关月数、pending_months、大限预警、日段/时辰 | 并入 [player_state.md](./player_state.md) | `detectSeclusionMonths`、`advanceAge`、`resolveActionClock` | 92% | 有单测 | **成册+加深已完成**；微行按场扣时辰，不再默认 1 月 |
| S04 | 战斗与境界压制 | 差 1 级 40% 输出、差 2 级秒杀、五行 | 同上第三节；自由度 [player_agency.md](./player_agency.md)；成册待 **I22** `combat.md` | `combat.service.ts` | 85% | 有单测 | 独立规格 **I22**；AI 报的敌人境界仍靠 prompt；战中「捡神器反杀」已由 A5 封闭骰拦 |
| S05 | 功德业力 | 夹紧增量、天罚掷骰 | 同上；成册待 **I23** `karma.md` | `karma.service.ts` | 85% | 有单测 | 独立规格 **I23** |
| S06 | 百艺与洞府 | 炼丹器阵植、洞府灵气×闭关 | 同上；技艺 **I15** / 洞府 **I17** | `crafting.service.ts` `cave.service.ts` `cultivationFormula.service.ts` | 85% | 有单测 | 创角不送府；无府借地闭关灵气六成；技艺 UI 未习。功法系数仍占位 1.0 |
| S07 | 经济坊市 | 买卖/拍卖硬计价 | 成册待 **I24** `market.md` | `economy.service.ts` | 80% | 有单测 | 独立规格 **I24**；无真实玩家市场 |
| S08 | 宗门 | 声望职位、叛宗追杀 | 代码即规格；成册待 **I14** | `sect.service.ts` | 80% | 有单测 | 独立规格 **I14**；宗门内容薄 |
| S09 | 人际双修 | NPC 寿元、双修、传音符 | 代码即规格 | `npc.service.ts` `relationship.service.ts` | 82% | 有单测 | 仙逝不得拜访已拦；独立规格待 **I16** |
| S10 | 探索奇遇 | 1d100、地区分级 | 成册待 **I25** `exploration.md`；示意图 **I13** | `exploration.service.ts` | 80% | 有单测 | 独立规格 **I25**；九州地区表未填满 |
| S11 | 逆天改命 | 大境三选一天赋乘数 | 成册待 **I26** `talents.md` | `talent.service.ts` | 85% | 有单测 | 独立规格 **I26**；天赋池偏少 |
| S12 | 轮回与读档 | 轮回池遗泽、快照回滚 | 成册待 **I27** `reincarnation.md` | `reincarnation*.ts` `snapshot.service.ts` `LoadModal.tsx` | 85% | 有单测；手测过池与回滚 | 独立规格 **I27**；局内「读档」弹窗已有；账号级云存档仍缺 |
| S13 | 背包物品 | 字典+自定义物品、防幻觉使用 | 无独立 md | `inventory.service.ts` 路由 | 85% | 有单测 | 独立规格待 **I18** |
| S14 | 创角命格 | 六维/出身/体质/天赋数值落地 | 成册待 **I28** `character.md` | `characterBuild.service.ts`；HTTP 编排 `characterCreation.service.ts` | 85% | 有单测 | 独立规格 **I28** |
| S15 | 开场剧情 | 命格生成开场并起步 | 成册并入 **I28** | `opening.service.ts` | 85% | 有单测 | 独立规格 **I28** |
| S16 | 前端主界面 | 日志、选项、指令、字号 | [ui.md](./ui.md) · [command_ui.md](./command_ui.md) · [command_ui_architecture.md](./command_ui_architecture.md) | `MainGame.tsx` `StatusCard.tsx` `CommandMenu.tsx` `rootElements.ts` | 88% | 无单测；构建通过 | 设置页未做；**I11 L1 底栏已落地**；死亡后读档按钮仍被灰掉（规格要求可开） |
| S17 | AI 叙事约束 | json_object + forcedOutcome | [game_design.md](./game_design.md) 一 | `ai.ts`（`PlayerStateForAi` / `DeducedAction`） | 75% | 无隔离单测 | 偶发不守铁律，靠拦截器兜底 |
| S18 | 声音（人声） | 旁白/天道/NPC 朗读 | [audio_system.md](./audio_system.md) | 无 | 规格 95% / 代码 0% | 无 | **可延后** |
| S19 | BGM 与 SFX | 配乐循环、情境切换、打击/雷/点击 | [audio_system.md](./audio_system.md) 一、八；架构混音器仍适用 | 无 | 0% | 无 | **可先于人声做**（创角+局内 BGM + 少量特效） |
| S20 | 功法与神通构筑 | 主修+辅修槽、招式、参悟残卷 | [combat_build.md](./combat_build.md) | 公式占位 1.0；未习术法薄拦截 `technique.service.ts` | 规格 90% / 招式库 0% / 未习熔断已做 | 熔断有测 | **阶段 C**；B 未收束不开招式库 |
| S21 | 意图识别与安全网关 | 口令、日限、防注入、超长拒绝；意图分类后做 | [intent_gateway.md](./intent_gateway.md) · [架构](./intent_gateway_architecture.md) | `backend/src/gateway/`；净化/黑名单在 `action.routes.ts`；日限在 `ActionService` | 最小集代码已落地；层 E/F 0% | 网关单测已有 | **L1 最小集已做**；分类器可后做 |
| S22 | 长效记忆与大事记 | chronicles 表、30 回合压缩备忘录；**A6 近事 + pending** | [chronicle.md](./chronicle.md) | `sceneMemory.service.ts` | 规格 90% / A6 代码已落地（全表 0%） | 单测有 | **A6 已完成**（试玩叙事割裂已补）；**D1** 再做表与 30 回合备忘录 |
| S23 | 灵兽与傀儡 | 神识占用、战斗协同 | [beasts.md](./beasts.md) | 无 | 规格 85% / 代码 0% | 无 | 阶段 F |
| S24 | 天下大势与传闻 | NPC 后台演化、坊市风闻 | [world_sim.md](./world_sim.md) | NPC 寿元已有，无世界推演 | 规格 85% / 代码 15% | NPC 寿元有测 | 阶段 D |
| S25 | 多结局与图鉴成就 | 结局引擎、天道点、二周目天赋 | [endings.md](./endings.md) | 死亡锁有，无结局分支 | 规格 85% / 代码 10% | 死亡有测 | 阶段 E |
| S26 | 心魔与走火 | 与雷劫分轨的检定与假选项 | [heart_demon.md](./heart_demon.md) | 无 | 规格 85% / 代码 0% | 无 | 阶段 C |
| S27 | 毒誓与禁术 | 起誓违约、燃寿噬血；夺舍不做 | [oaths.md](./oaths.md) | 无 | 规格 85% / 代码 0% | 无 | 阶段 E |
| S28 | 师徒与衣钵 | 拜师传功、叛师私仇 | [mentorship.md](./mentorship.md) | 无 | 规格 85% / 代码 0% | 无 | 阶段 D |
| S29 | 凡人亲缘 | 1～3 凡人、归乡见丧 | [mortal_kin.md](./mortal_kin.md) | 无 | 规格 85% / 代码 0% | 无 | 阶段 D |
| S30 | 丹毒与口粮 | 连服惩罚、炼气吃饭 | [alchemy_toxin.md](./alchemy_toxin.md) | 炼丹成功已有 | 规格 85% / 代码 0% | 无 | 阶段 C |
| S31 | 地理赶路 | 邻接、遁速、关隘、秘境档期 | [geography.md](./geography.md) | 地点字符串 | 规格 85% / 代码 0% | 无 | 阶段 D |
| S32 | 名声与律法 | 与业力分账、坊市追缉 | [reputation.md](./reputation.md) | 无 | 规格 85% / 代码 0% | 无 | 阶段 E |
| S33 | 情报天机 | 买线索、真假骰 | [intelligence.md](./intelligence.md) | 无 | 规格 80% / 代码 0% | 无 | 阶段 F |
| S34 | 伪装与神识 | 藏境、识破；战斗用真境 | [disguise.md](./disguise.md) | 无 | 规格 80% / 代码 0% | 无 | 阶段 F |
| S35 | 灵脉争夺 | 占山门槛、征用、搬迁 | [spirit_veins.md](./spirit_veins.md) | 洞府已有 | 规格 80% / 代码 0% | 无 | 阶段 D |
| S36 | 玩家自由度与宣称奇迹 | 三圈边界；战中神器/反杀走封闭仙缘骰，不破秒杀 | [player_agency.md](./player_agency.md) · [plausibility.md](./plausibility.md) · [situation.md](./situation.md) | 情境锁 `situation.service.ts`；奇迹骰 `miracle.service.ts` 均已做 | 规格 90% / 层 1 + 层 3 代码有 | 情境锁、奇迹骰均有测 | 敌境缓存、凡器掉落、承伤×0.7、脱身留待完整档 |

### 2.2 上线与工程（尚未当「游戏系统」但必须有）

| ID | 项 | 完成度 | 说明 |
|----|----|--------|------|
| I01 | 本地运行（XAMPP MySQL + 双 npm） | 90% | [runbook.md](./runbook.md) + `.cursor/rules/project.mdc` |
| I02 | Git / GitHub | 90% | 公开库 + MIT；`.env` 已忽略；Key 未上传 |
| I03 | 密钥安全 | 85% | 从未把 API Key 推上 GitHub；L1 仍须防公网刷接口 |
| I04 | 接口鉴权 / 限流 | 90% | 口令 `PLAY_ACCESS_TOKEN` + `X-Play-Token`；每日行动上限。给朋友玩必须**配置口令**。本机直连即使配了口令也不验；穿透必验。 |
| I05 | 存档列表 | 70% | 薄做已落地：`GET /api/saves` + 前端存档列表页，免手抄 UUID；单删/清空。局内快照回滚见 `LoadModal`（S12）。账号仍缺 |
| I06 | 托管 | 规格 90% / 代码 50% | 前端 API 基址已抽 `apiBase.ts`（`VITE_API_BASE`）+ `.env.example`；隧道与 NSSM 保活待真机。规格 [hosting.md](./hosting.md) · 架构 [hosting_architecture.md](./hosting_architecture.md)。不要裸映射 3000 |
| I07 | 内容填充 | 30% | 机制有、世界薄；L1 可先薄 |
| I08 | 法律：BGM/隐私 | 10% | 朋友试玩用 CC0 曲即可 |
| I09 | 商业：支付与回本 | 0% | **不必为 L1 做** |
| I10 | 启动说明 | 90% | [runbook.md](./runbook.md)；L1 口令须另给朋友，勿写入公开 README |
| I11 | 手机浏览器适配 | 规格 90% / L1 代码已落地 | 竖屏能创角、行动、点指令；不改后端。视觉 [ui.md](./ui.md)；必做项 [mobile.md](./mobile.md) · [mobile_architecture.md](./mobile_architecture.md) |
| I12 | 地图美术 | 规格记入路线图 / 代码 0% | 精细九州图替换 `RegionMap` 线稿；点图仍不赶路。**不挡阶段 B 成册** |
| I13 | 地图设计与系统 | 规格散落 / 代码薄 | 只读图 + 探索骰已有；邻接赶路 S31。待补对照规格 |
| I14 | 宗门设计与系统 | 无独立 md / 代码有 | `sect.service.ts`；待 `sect.md` |
| I15 | 技艺设计与系统 | 无独立 md / 代码有 | 配方在内容表；待 `crafts.md`（等级、拜师） |
| I16 | 情缘设计与系统 | 无独立 md / 代码有 | 好感双修仙逝已有；待 `bonds.md` |
| I17 | 洞府设计与系统 | 无独立 md / 代码有 | 开辟已有；争夺 S35。待 `cave.md` |
| I18 | 物品设计与系统 | 无独立 md / 代码有 | 字典+熔断已有；待 `items.md` |
| I19 | UI 设计 | 现状有色板与分栏 / 无完整界面规格 | 不是纯文字指令+日志；信息架构与视觉。窄屏仍 I11；地图美术 I12 |

### 2.3 规划中的玩法（规格已写）

六套原规划 + 真实感十套 + **S36 自由度**。完成度见各 md 与 [roadmap.md](./roadmap.md)。**公网试玩门槛是 A1–A3**（网关、口令日限、部署）；**A5** 已拦「一句话反杀」被模型圆过去，不挡开隧道。**A6** 挡「下一句丢掉上一场戏」，不挡开隧道。

索引：[docs/README.md](./README.md)「规划中的玩法」表。

### 2.4 提前实现（试玩已挡，从后阶段抽到 A 末）

权威表在 [roadmap.md](./roadmap.md) 阶段 A「提前实现」小表。此处只记完成度。

| 原排期 | ID | 薄做什么 | 完成度 | 文档 |
|--------|-----|----------|--------|------|
| D1 | S22 / **A6** | 近事摘要 + pending；搜寻机缘不算离开。**不做** chronicles 表 | 规格第 0 节 / **代码已落地** | [chronicle.md](./chronicle.md) 第 0 节 |

---

## 3. 建议开发顺序与工时

**权威排期（阶段 A→F、依赖、不要做的）：** [roadmap.md](./roadmap.md)。**当前主线：A6 → 阶段 B（补已有雏形）。** B 未收束禁止开 C～F。

L1 最低集仍是路线 **A1–A3**。**A1（S21 过滤）与 A2（I04 口令日限）已落地**；A3 部署仍须真机。存档 UI 为 A4（已落地）。**A5（S36 宣称奇迹封闭骰）已落地。** **A6（S22 短记忆）属补行动环**，见第 2.4 节。BGM 可插在 B 末，不得推迟 B1–B16 或 A3。禁止为新系统（功法、心魔、灵兽）跳过已有雏形成册。禁止用模型当「合不合理」裁判。

---

## 4. 运行成本（每月，上线后）

| 科目 | 开发期 | 小规模试玩（自己的 Key） | 公开给陌生人且用你的 Key |
|------|--------|--------------------------|---------------------------|
| DeepSeek 叙事 | 你个人额度 | 同左，可能突然涨 | **不可控，可能被刷爆** |
| 浏览器朗读 | 0 | 0 | 0 |
| 云 TTS（若上） | 0 | Azure 约 50 万字符/月免费档；中文按 2 倍计；超出约 16 美元/百万英文字符当量 | 必须限额或玩家自备 Key |
| MySQL / 主机 | 本机 0 | 轻量云 0–50 元 | 随人数 |
| RVC GPU | 0 | 本机显卡电费 | 云 GPU 常见数百～数千元/月 |

结论：公开 GitHub + 不鉴权 API + 你的 DeepSeek Key = **还没商用就会亏**。试玩请只给信任的人，或强制每人自备 Key。

---

## 5. 声音专项：免费商用吗、20 条从哪来、够不够

（补全 [audio_system.md](./audio_system.md) 第 7 节问答。）

### 5.1 RVC 有没有免费可商用？

要拆成三层，不能混：

| 层 | 是否免费可商用 | 钱 |
|----|----------------|----|
| RVC **软件**（WebUI） | 一般是 **MIT**，软件本身可商用 | 0 |
| RVC **底模**（官方用 VCTK 等开源集训的底座） | 官方 README 称底模版权相对放心；仍以模型卡为准 | 0 |
| 网上随便下的 **「某某角色.pth」** | **几乎都不能商用** | 侵权风险，不是省钱 |

「公开原声」≠ 授权你商用。公开视频/语音不能拿来训商用克隆。

若要 **合法的「像真人」的定制声**：

- 自己或朋友录音 + 书面授权，用 RVC/GPT-SoVITS 自训：钱 = 0～请人录音（常见 **每条声 200–2000 元** 含商用授权，看是否职业配音）。
- 云厂商定制声（如 Azure Custom Neural）：要申请，推理大约 **24+ 美元/百万字符** 量级，还有审核，不适合个人第一期。
- 用 **厂商预置中文神经声**（Azure/微软音色）：软件与音色按 **云服务条款** 商用，不是 RVC；有免费档（约每月 50 万计费字符，**汉字常按 2 字符计**），超出约 **16 美元/百万计费字符**（以官网为准）。

**建议：** 第一期 0 元浏览器声。不要为「免费 RVC 角色模型」赌上线。

### 5.2 8～20 条合法声线去哪找？20 够不够？

**够。** 第二期目标是「同一 NPC 名永远同一声」，不是「九州每个人声都不同」。20 条做哈希池：同一次游玩里几十个名字会有重复音色，只要 **同名不变** 即可。以后可扩到 40 也只是改表。

从哪找（由稳到险）：

1. **浏览器 / 系统中文声**（第一期）：0 元，条数少（常 2–6），够旁白+天道，不够 20 NPC。
2. **云 TTS 官方音色列表**（微软、阿里云、讯飞等）：每种预置声一条，条款允许应用内播放；要 Key + 后端代理。中文预置往往 **十几到几十条**，20 条够凑。
3. **开源 TTS 官方说话人**（如 CosyVoice 官方权重，代码 Apache-2.0）：部署在你机器上，0 推理费，耗电/显卡；**须读该模型卡片是否禁商用**。
4. **约配音 + 书面商用授权** 录 20 句种子再本地克隆：最干净，有预算再做。
5. **HuggingFace/群文件角色模型**：只适合关着门自嗨，**不要进上线包**。

不需要先找 20 个 RVC。第二期用「官方 TTS 说话人 ID 表」即可。

### 5.3 和 GitHub 公开库的关系

见第 7 节。声音素材不要把侵权 `.pth` 推进公开仓库。

---

## 6. 可上线方案（具体）

前提：玩法已在本机可跑。上线是 **分发与钱** 问题，不是再做一个游戏。

### 方案 L0 — 继续公开源码 + 仅自己玩（当前）

- 保持 GitHub 公开、MIT。
- 不把 `.env` 推上去；DeepSeek 只在你电脑。
- 适合：作品集、找合作、开源社区。
- 不要：把公网 IP 裸奔映射 3000 端口还开着你的 Key。

### 方案 L1 — 给朋友试玩

**还差什么（你未上传 Key 的前提下）：**

1. **不要把 3000 端口裸开到公网。** 用内网穿透带密码、或 VPS + Nginx，只给朋友 URL。  
2. **接口口令**：给朋友的实例必须在 `.env` 配置 `PLAY_ACCESS_TOKEN`；未配置时本机仍放行。  
3. **每日行动次数上限**已实现（默认 60，`ACTION_DAILY_LIMIT` 可改）。  
4. **输入最长限制 + 拒绝明显注入句**（S21 最小集）已实现。  
5. **进程保活**：朋友打开时后端/MySQL 必须在跑（你电脑开机，或云上一份）。  
6. **说明文档**：前端地址、创角页填令牌、出问题找你。  
7. **CC0 BGM 可选**；人声不必。

不需要：支付、账号系统、改 MIT、私有仓库、RVC、功法/灵兽/大势（体验会薄，但能玩）。

**GitHub 设置和协议要不要改？**

| 项 | L1 建议 |
|----|---------|
| 许可证 MIT | **不用改。** 朋友试玩不靠卖拷贝。想以后卖游戏再考虑；改许可证 **管不到已经 clone 的人**。 |
| 公开 / 私有 | **公开可以。** 代码公开 ≠ 你的服务器公开。若不想被人看见尚未完成的项目，可改私有，对 L1 **非必须**。 |
| README | 建议加一句：本仓库不含 API Key；请勿对不明服务器压测。 |
| Issues / Discussions | 可关可开，与试玩无关。 |
| GitHub Pages | **不要**把带后端的游戏纯静态托管上去（没有 Express/MySQL）。 |
| Secrets | 无 CI 则不用设；**不要**把 DeepSeek Key 填进 GitHub Secrets 再写进前端。 |
| `.gitignore` | 保持忽略 `.env`、`node_modules`、`mcp.json` 即可。 |

---

### 方案 L2 — 公网试玩但不想爆账单

- 玩家 **填写自己的 DeepSeek Key**（只存在该浏览器或该存档加密字段，不进 Git）。
- 或：你提供 Key 但必须登录 + 严格限额 + 验证码。
- 声音继续浏览器。
- GitHub 公开无妨，因为算力不是你的。

### 方案 L3 — 想卖钱（Steam / 网站买断 / 内购）

- 需要：隐私政策、付费通道、存档账号、限额、可商用 BGM、声线授权。
- MIT 公开源码 **允许别人复制你的游戏**。若要卖：可继续开源（靠更新与服务器）；或对「官方服务器」收费、客户端免费；或将来改许可证（对 **已经 clone 走的副本无效**）。
- 用你的 API 给全体买家无限叙事 = 必亏。买断价要覆盖服务器，或叙事改本地小模型，或玩家自备 Key。

不建议的上线：网页里写死你的 Key、或把 RVC 明星模型打进安装包。

---

## 7. 公开 GitHub 有没有影响？

**有，但是「开源常见影响」，不是立刻违法。**

| 影响 | 说明 | 该做什么 |
|------|------|----------|
| 别人能抄走玩法与代码 | MIT 明确允许使用、修改、再发布甚至卖 | 能接受再保持公开；不能接受就改私有或双许可（管不了旧 fork） |
| 作弊 | 战斗公式在前端看不到也在后端仓库里 | 数值本就在服务端算；公开后高手能读懂规则，修仙游戏通常可接受 |
| 密钥泄漏 | 若 `.env` 进过历史提交，爬虫会扫 | `git log` 查 Key；泄漏则 **立刻在 DeepSeek 控制台作废并换新** |
| 本机路径 | 已用 `mcp.example.json`，真路径未入库 | 保持忽略 `mcp.json` |
| 侵权素材 | 若将来把无授权 mp3/pth 推进 public | 公开仓库 = 证据链，更危险 |
| 作品集加分 | 招聘/合作方能直接看架构 | 对本项目是优点 |

结论：**库公开本身不阻止你上线**；阻止你的是 **密钥、限流、版权素材**。公开 + L1/L2 可以同时存在。

---

## 8. 质量与风险台账

| 风险 | 等级 | 缓解 |
|------|------|------|
| AI 不守物品/数值铁律 | 中 | 已有拦截器；继续加单测与 prompt |
| 无前端测试 | 中 | 声音与存档 UI 上线前补关键路径 |
| Prisma 引擎 Windows 文件锁 | 低 | 改 schema 时停 `tsx watch` |
| 白皮书与实现再漂移 | 中 | 改机制必须改 `game_design.md` + 本表完成度 |
| 声音版权 | 高（若乱下模型） | 只走第 5 节合法来源 |

---

## 9. 文档地图

完整索引：[README.md](./README.md)。

| 文档 | 用途 |
|------|------|
| [game_design.md](./game_design.md) | 天道法则、UI 短铁律、十二系统、修炼公式 |
| [ui.md](./ui.md) | 电脑/手机 UI：宣纸、断点、书房 vs 掌中 |
| [command_ui.md](./command_ui.md) | 14 指令功能规格 |
| [command_ui_architecture.md](./command_ui_architecture.md) | 指令前端分发与接口 |
| [architecture.md](./architecture.md) | 已实现代码怎么分层 |
| [api.md](./api.md) | HTTP 契约 |
| [runbook.md](./runbook.md) | XAMPP / 前后端启动 |
| [hosting.md](./hosting.md) | I06 L1 托管功能规格 |
| [hosting_architecture.md](./hosting_architecture.md) | I06 隧道拓扑、基址、保活 |
| [player_agency.md](./player_agency.md) | S36 自由度总则：三圈边界 |
| [player_state.md](./player_state.md) | I20 / B1：状态机与岁月（成册） |
| [situation.md](./situation.md) | 层 1 情境锁（已实现） |
| [plausibility.md](./plausibility.md) | 层 3 宣称奇迹骰（A5，已落地） |
| [roadmap.md](./roadmap.md) | 完善顺序 A→F（权威；B=补雏形） |
| [content_catalog.md](./content_catalog.md) | 地区、配方、命格、天赋 |
| [audio_system.md](./audio_system.md) | 声音实体、决议、RVC/代理答疑 |
| [audio_architecture.md](./audio_architecture.md) | 声音目录、事件、接口签名 |
| S20–S36 各 md | 规划系统规格，见 [README.md](./README.md) |
| [project_status.md](./project_status.md) | 本文件：进度、测试、成本、上线、GitHub |
| `.cursor/rules/project.mdc` | Cursor 开发红线 |
| `.cursor/mcp.example.json` | MCP 模板 |

---

## 10. 当前下一动作

**A6（S22 薄做）已落地：** `sceneMemory.service.ts` + `world_state` 两列已入库；近事注入 `deduceAction`；未收束跳过探索骰。「搜寻机缘」不算离开。规格 [chronicle.md](./chronicle.md) 第 0 节。`chronicles` 表仍属 **D1**。

**阶段 B（当前主线）：** 下一刀成册 **B2 / I21** `realms.md`。**I20** 已成册 [player_state.md](./player_state.md)。**I13–I18、I22–I28** 仍待成册并加深；**I07** 随册薄补。**I19 / I12** 不挡成册。B 未收束不开 S20。

**真机下一刀（A3 / I06）：** 穿透/保活仍须在你电脑上做（API 基址已抽）。不挡阶段 B。

S21 最小集、I04、I05、情境锁、**A5 奇迹骰**、**A6 短记忆**均已落地。公网门槛仍是 A3 真机。完整顺序：A（安全 + A5【已落地】 + **A6 短记忆【已落地】**）→ **B 成册加深已有系统** → C 功法/丹毒/心魔 → D 大事记全表/亲缘/师徒/大势/地理/灵脉 → E 结局/毒誓/名声 → F 声音/灵兽/情报/伪装。

---

## 11. 距离「真正的游戏」还差什么

现在更像 **机制完整的文字修仙原型 / 技术演示**，还不是商店里那种「买完能玩几十小时」的产品。

| 真正的游戏通常有 | 现在 | 缺的体感 |
|------------------|------|----------|
| 开局到终局一条心流 | 有创角、行动、死亡 | 没有飞升/魔尊等 **结局演出**，死了像程序结束 |
| 战斗有构筑 | 境界压制 + 天赋乘数 | **没有功法槽和招式**，打起来像掷骰+叙事 |
| 世界在动 | 时间流逝、NPC 会老死 | **没有宗门战争、NPC 自己突破** |
| 长线记忆 | 单回合 context | **A6 短记忆已接线**；玩久了仍忘前仇（D1 备忘录） |
| 防捣乱 | 网关 + 情境锁 + A5 封闭骰 | 「立刻飞升」浪费 Key 仍可能；**战中神器反杀**已由 A5 封闭骰拦 |
| 内容量 | 机制表偏短 | 地区、物品、事件 **不够撑一周目** |
| 包装 | 宣纸 UI 雏形 | 无主菜单、存档栏、设置、音效氛围 |
| 运营 | 无 | 无账号、客服、版本更新节奏 |

S20–S25 补「构筑、安全、记忆、宠物、活世界、结局」；S26–S35 补「心魔、誓、师徒、凡人、丹毒、地理、人账、情报、伪装、灵脉」；**S36** 补「自由度边界与宣称奇迹」。做完会 **像一款能过日子的修仙**；现在已经 **像一个很好的内核**。排期见 [roadmap.md](./roadmap.md)。

---

## 12. 有没有上线前景？会不会回本？

**结论先说：当业余作品 / 给朋友玩 / 写进作品集，很值。当作要回本的商业项目，现在不要指望。**

原因（不是否定项目，是账）：

1. **每回合都在花大模型钱。** 朋友 5 人还扛得住；陌生人无限玩，你的 DeepSeek 账单是无底洞，卖 30 元买断也难覆盖。  
2. **MIT + 公开源码** = 别人能自己架一套。收费卖客户端说服力弱，除非你卖「官方服务器额度」。  
3. **AI 文字游戏市场** 已有大量 ChatGPT 套皮；差异在你的硬核数值，但大众更认包装与内容量。  
4. 六套系统 + 内容 + 托管，还要再投入 **几十人天**，机会成本往往高于可能收入。

适合的定位：

- **自己玩 + 找 3～10 个懂修仙的朋友 L1**：验证爽点和漏洞，快乐优先。  
- **GitHub 公开当作品集**：展示「后端硬算 + AI 叙事」架构，对找工作/合作有用，这是另一种回本。  
- **以后若真要上线**：走 L2（玩家自备 Key）或「月卡额度」，不要幻想靠你的 Key 养全体玩家。

不必为「会不会回本」而停更内核；也 **不必** 为上线去改许可证、上架 Steam。等 L1 朋友说「还想玩」再考虑 L2。

---

## 13. 代码有、独立规格没有（对照 2026-09-02）

「没有文档」分两种：规划中系统已有 md 但代码未写；**已在玩的系统只有代码、没有成册规格**。深化前先补对应 md（待办 **I13–I18**、**I21–I28**；**I20 已成册**）。界面不停留在纯文字凑合，走 **I19**。`game_design.md` 只保留铁律与修炼公式摘要，不替代成册。

| 已有代码 | 文档现状 | 缺口 |
|----------|----------|------|
| 气血/灵力/修为/寿元/死亡锁 + 闭关岁月 | 成册 [player_state.md](./player_state.md) | **I20 成册已完成**；加深见该册第 10 节 |
| 小境/大境/雷劫 `REALM_LAWS` | 白皮书第四节短句 | **无** `realms.md` → **I21** |
| 战斗压制 `combat.service.ts` | 白皮书第三节；招式库规划 [combat_build.md](./combat_build.md) | **无** `combat.md` → **I22** |
| 功德业力 `karma.service.ts` | 白皮书第三节一句；人账规划 S32 | **无** `karma.md` → **I23** |
| 洞府开辟/借地闭关 `cave.service.ts` | 白皮书 S06 一句；争夺规划 [spirit_veins.md](./spirit_veins.md) | **无** `cave.md` → **I17** |
| 宗门声望职位叛宗 `sect.service.ts` | 进度表写「代码即规格」 | **无** `sect.md` → **I14** |
| 百艺炼制 `crafting.service.ts` + 技艺弹层 | [content_catalog.md](./content_catalog.md) 配方表；丹毒规划 S30 | **无** 技艺等级/拜师规格 → **I15** |
| 情缘好感双修仙逝 `relationship`/`npc` | 白皮书第 9 条一句；凡人亲缘规划 S29 | **无** `bonds.md` → **I16** |
| 只读地图 `RegionMap` | [command_ui.md](./command_ui.md)；赶路规划 [geography.md](./geography.md) | 当前图与 S31 未对照 → **I13**；美术 **I12** |
| 探索奇遇骰 `exploration.service.ts` | 代码即规格 | **无** `exploration.md` → **I25** |
| 坊市拍卖 `economy.service.ts` | 无独立 md | **无** `market.md` → **I24** |
| 逆天改命 `talent.service.ts` | 内容表有天赋名 | **无** `talents.md` → **I26** |
| 轮回池/快照 `reincarnation*` `snapshot.service.ts` | 代码即规格 | **无** `reincarnation.md` → **I27** |
| 创角命格 + 开场 `characterBuild` / `opening` | 创角页文案 + 内容表 | **无** `character.md` → **I28** |
| 背包熔断 `inventory.service.ts` | api / 铁律散落 | **无** `items.md` → **I18** |
| 天玄历 `world_state` 年季 | 并入 [player_state.md](./player_state.md) 第 5.3 节 | 不另立历法册 |
| 未习术法 `technique.service.ts` | [combat_build.md](./combat_build.md) 已记薄拦截 | 招式库仍待 S20 |
| 情境锁、网关、自由度 | [situation.md](./situation.md) [intent_gateway.md](./intent_gateway.md) [player_agency.md](./player_agency.md) | 已有规格 |
| S20、S22–S36、S18/S19 | 各有 md | **规格有、代码无**（S21 最小集除外） |

结论：十二系统主路径能玩，但多数只有白皮书短句或代码。成册规格分两批：**I13–I18**（洞府/宗门/技艺/情缘/地图/物品）、**I20–I28**（状态机岁月/境界/战斗/功德/坊市/探索/逆天改命/轮回/创角开场）。规划中的功法、大事记等相反（有册无代码）。界面现状是指令+日志，终局设计走 **I19**。

