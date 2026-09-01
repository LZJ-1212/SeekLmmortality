# 《问道长生》声音系统代码架构（只设计，不实现）

依据 [audio_system.md](./audio_system.md) **已确认决议**：第一期纯前端浏览器朗读；同一 `AudioFacade` 供创角页（仅 BGM）与局内（BGM+朗读）；地点+全情境配乐；旁白/天道两声线；默认自动朗读；人声总闸 `voicesEnabled`；失败发非阻断短讯。RVC/NPC 专声/SFX 为后两期。

约定：下列「方法签名」为 TypeScript 设计契约，本文件不含函数体。

---

## 1. 目录结构和文件划分

```
frontend/
├── public/audio/bgm/                 # 可商用占位曲（曲目标识稳定，换文件不改 id）
│   └── .gitkeep
└── src/
    ├── audio/                        # 声音子系统（无 React 依赖，可单测）
    │   ├── types.ts                  # 全部实体类型与枚举
    │   ├── events.ts                 # 事件名常量与载荷类型
    │   ├── constants.ts              # 闪避默认值、淡入淡出毫秒、存储键名
    │   ├── catalogs/
    │   │   ├── bgmCatalog.ts         # 曲目表 + 场景配乐规则表（静态数据）
    │   │   └── voiceCatalog.ts       # 旁白/天道音色档案（静态数据）
    │   ├── mixer/
    │   │   ├── AudioMixer.ts         # 混音器：总音量、四通道、静音、有效音量
    │   │   └── DuckingController.ts  # 人声响起时压低 BGM、结束后回升
    │   ├── persist/
    │   │   └── PreferenceStore.ts    # 读写玩家音频偏好
    │   ├── bgm/
    │   │   ├── BgmResolver.ts        # 地点+情境 → 曲目标识（纯函数）
    │   │   └── BgmPlayer.ts          # HTMLAudio 循环、交叉淡化、执行切换指令
    │   ├── speech/
    │   │   ├── SpeechEngine.ts       # Web Speech API 适配器
    │   │   ├── HeavenClassifier.ts   # system 日志 → 天道宣告类别（纯函数）
    │   │   ├── CueBuilder.ts         # 日志/开场 → 台词列表（第一期不拆 NPC）
    │   │   └── SessionQueue.ts       # 播放会话：排队、打断、天道优先于旁白
    │   ├── AudioBus.ts               # 进程内事件总线（发出/订阅）
    │   ├── AudioFacade.ts            # 子系统对外唯一入口
    │   └── index.ts                  # 对外导出 Facade、类型、事件名
    └── components/
        ├── MainGame.tsx              # 局内：Facade 的 BGM+朗读
        ├── CreateCharacter.tsx       # 创角：同一 Facade，只 syncBgm(characterCreate)
        └── AudioControls.tsx         # 「声 / 乐」面板（可 SVG；两页复用）
```

第二期预留：`speech/NpcDialogueParser.ts`、`speech/NpcVoiceBinder.ts`（名字哈希→声线库）。第三期：`speech/TtsClient.ts`、`persist/SpeechCache.ts`、后端 `audio` 代理路由。第一期后端不建音频目录。

---

## 2. 每个文件 / 类的职责（一句话）

| 文件或类 | 职责 |
|----------|------|
| `types.ts` | 声明规格中全部名词对应的 TypeScript 类型，禁止业务逻辑。 |
| `events.ts` | 声明本系统发出的事件名与载荷形状。 |
| `constants.ts` | 集中闪避比例、淡入淡出时长、`localStorage` 键、默认音量。 |
| `bgmCatalog.ts` | 提供曲目与场景规则的只读表，不播音频。 |
| `voiceCatalog.ts` | 提供旁白/天道（第二期含路人）音色档案只读表。 |
| `AudioMixer` | 维护总音量、总静音、四通道音量/静音，并算出某通道最终音量。 |
| `DuckingController` | 根据人声占用状态对「背景乐通道」施加/解除闪避系数。 |
| `PreferenceStore` | 把玩家音频偏好序列化到本机键值，启动时读回并夹紧到合法区间。 |
| `BgmResolver` | 纯函数：输入地点与情境，按优先级命中一条规则，得到曲目标识。 |
| `BgmPlayer` | 按切换指令播放/停止循环曲，做淡入淡出，失败静默。 |
| `SpeechEngine` | Web Speech 适配；失败不 throw 到游戏，回 `failed` 供 Facade 发短讯。 |
| `HeavenClassifier` | 纯函数：根据 system 文本判断天道宣告类别。 |
| `CueBuilder` | 第一期：system→天道，narrative→旁白整段，忽略 player。 |
| `SessionQueue` | 排队、打断、天道先于旁白。 |
| `AudioBus` | 同步发布/订阅。 |
| `AudioFacade` | 游戏唯一入口。 |
| `index.ts` | 公开 API。 |
| `AudioControls.tsx` | 声/乐、音量、人声总闸、自动朗读；订阅失败短讯。 |
| `MainGame.tsx` | 开场/行动/点击日志调用 Facade。 |
| `CreateCharacter.tsx` | 挂载控件 + `syncBgm({ mood: 'characterCreate' })`，不朗读。 |

---

## 3. 模块依赖关系（谁调用谁）

单向依赖，禁止目录反向引用（`audio/` 不 import `components/`）。

- **CreateCharacter** 调用 **AudioFacade**：`hydrate`、`unlockAfterGesture`、`syncBgm({ locationName: '青岳·天机坊市', mood: 'characterCreate' })`、卸载 `dispose` 或与局内共享单例则不 dispose。
- **MainGame** 调用 **AudioFacade**：`unlockAfterGesture`、`syncBgm`、`playNewLogs`（默认自动）、`replayLog`、`interruptSpeech`、卸载策略与创角页约定同一单例则不重复 dispose。
- **AudioControls** 调用 **AudioFacade**：`getPreference`、`setMasterVolume` 等；订阅 **AudioBus** 的偏好/配乐变化以刷新控件。
- **AudioFacade** 持有并调用：**PreferenceStore**、**AudioMixer**、**DuckingController**、**BgmResolver**、**BgmPlayer**、**CueBuilder**、**HeavenClassifier**（经 CueBuilder）、**SessionQueue**、**SpeechEngine**、**AudioBus**。
- **SessionQueue** 调用 **SpeechEngine** `speak` / `cancel`；开始/结束说话时通知 **AudioFacade**（或直接 **DuckingController** + **AudioBus**，由 Facade 组装时注入回调，避免 Queue 依赖 Mixer）。
- **DuckingController** 只调用 **AudioMixer** `setDuckingFactor`（混音器内部字段，见第 6 节）。
- **BgmPlayer** 读取 **AudioMixer** `getEffectiveVolume('bgm')`；订阅混音变化以便改 `HTMLAudioElement.volume`。
- **BgmResolver** 只读 **bgmCatalog**；**CueBuilder** 只读 **voiceCatalog** 与调用 **HeavenClassifier**。
- **SpeechEngine** 不依赖 React、不依赖 Mixer（音量由引擎 `volume` 乘通道有效音量，由 Facade 在 `speak` 前传入）。
- **PreferenceStore** 不调用播放器；Facade 在 `set*` 时先写 Store 再改 Mixer 再 `AudioBus.emit`。

文字链：

`MainGame / AudioControls` → `AudioFacade` →（`PreferenceStore` + `AudioMixer` + `DuckingController` + `BgmResolver` + `BgmPlayer` + `CueBuilder` → `HeavenClassifier` + `voiceCatalog`）+ `SessionQueue` → `SpeechEngine`；全程旁路 `AudioBus` 发事件。

---

## 4. 事件 / 回调设计

总线：**AudioBus**（同步、单页内存）。游戏与控件只订阅，不直接 `new SpeechSynthesisUtterance`。

| 事件名 | 何时发出 | 载荷要点 | 谁监听 |
|--------|----------|----------|--------|
| `audio:unlocked` | 用户首次点击后 AudioContext/朗读策略允许出声 | 无 | AudioControls（解除「需点击后出声」提示） |
| `audio:preferenceChanged` | 任一音量/静音/自动朗读写入成功 | `AudioPreference` 全量快照 | AudioControls；BgmPlayer（改音量） |
| `audio:bgmChanged` | 实际开始播放新曲或淡出至无曲 | `trackId: string \| null`，`reason: BgmMood` | AudioControls 显示当前「乐」状态（可选） |
| `audio:sessionStarted` | 新播放会话入队 | `sessionId`，`trigger: SessionTrigger` | MainGame 可高亮正在读的日志（可选，第一期可不做 UI） |
| `audio:speechStarted` | 某条语音任务开始出声 | `jobId`，`channel: 'narration' \| 'heaven' \| 'npc'` | DuckingController（压 BGM）；AudioMixer 占通道 |
| `audio:speechEnded` | 正常读完一条 | `jobId` | DuckingController（若队列已空则回升）；SessionQueue 播下一条 |
| `audio:speechCancelled` | 打断或会话取消 | `jobId` | 同 speechEnded 的闪避结算 |
| `audio:speechFailed` | 引擎抛错或无中文声 | `jobId`，`reason: string`，`message: string` | **AudioControls** 显示非阻断短讯；**绝不**因此禁用行动按钮 |
| `audio:sessionFinished` | 队列耗尽 | `sessionId` | DuckingController 确认回升 |
| `audio:duckingChanged` | 闪避系数变化 | `factor: number` | BgmPlayer 立即重算有效音量 |

回调（不用总线、构造时注入，避免环依赖）：

- **SessionQueue** 构造参数 `onJobStart(job)` / `onJobEnd(job, endKind)`，由 Facade 转成 Bus 事件并驱动 Ducking。
- **SpeechEngine.speak** 返回的 Promise 在完成时由 Queue 调用上述回调；失败走 `audio:speechFailed` 后仍 `onJobEnd(..., 'failed')`，**不**用 `alert`、不锁 UI。

浏览器原生事件（不对外）：`HTMLAudioElement.ended`（循环曲不应 ended）、`speechSynthesis.onend` / `onerror`，仅 SpeechEngine / BgmPlayer 内部消化。

---

## 5. 数据持久化方案

| 存什么 | 存哪 | 格式 | 不存什么 |
|--------|------|------|----------|
| 玩家音频偏好（总音量、四通道音量、总静音、自动朗读默认开、人声总闸、解锁标记） | `localStorage` 键 `sl_audio_prefs` | 单条 JSON | 不入 MySQL、不进快照 |
| BGM 曲目与规则 | 源码 `bgmCatalog.ts` | TypeScript 常量 | 不持久化到浏览器 |
| 音色档案 | 源码 `voiceCatalog.ts` | TypeScript 常量 | 同上 |
| 占位 mp3 | `frontend/public/audio/bgm/{trackId}.mp3` | 静态文件 | Git 只收可商用曲 |
| 语音缓存 | 第一期不存 | — | 无 IndexedDB；无 wav 上传 |

`sl_audio_prefs` JSON 字段（全部必填，读失败则用默认）：

- `masterVolume`：数字 0～1  
- `channelVolumes`：对象 `{ bgm, narration, heaven, npc }` 各数字 0～1  
- `muted`：布尔（总静音）  
- `autoSpeak`：布尔（默认 `true`）  
- `voicesEnabled`：布尔（默认 `true`；`false` = 只开音乐、关闭人声）  
- `unlocked`：布尔  

夹紧：数字越界回退默认（总音量 0.8，BGM 0.4，人声 0.9，muted false，autoSpeak true，voicesEnabled true，unlocked false）。每次 Facade 的 set 成功后立刻写入。

---

## 6. 所有接口的方法签名

含义写在签名旁。`void` 表示无返回；失败静默的方法仍返回可忽略的结果供测试。

### 6.1 类型别名（契约用，非实现）

- `ChannelId` = `'bgm' | 'narration' | 'heaven' | 'npc'`
- `BgmMood` = `'normal' | 'characterCreate' | 'combat' | 'tribulation' | 'death' | 'opening' | 'seclusion' | 'lifespan'`
- `SessionTrigger` = `'opening' | 'action' | 'replay'`
- `SpeechEndKind` = `'completed' | 'cancelled' | 'failed'`
- `HeavenKind` = `'opening' | 'death' | 'tribulation' | 'lifespan' | 'karma' | 'enforcers' | 'talent' | 'generic'`

### 6.2 PreferenceStore

- `load(): AudioPreference`  
  从 `sl_audio_prefs` 读取并夹紧；无键或坏 JSON 则返回默认偏好。

- `save(pref: AudioPreference): void`  
  夹紧后写入 `localStorage`。

- `defaults(): AudioPreference`  
  返回规格默认值的新对象（不读盘）。

### 6.3 AudioMixer

- `applyPreference(pref: AudioPreference): void`  
  覆盖总音量、总静音、人声总闸、四通道音量。

- `setVoicesEnabled(enabled: boolean): void`  
  人声总闸。

- `getEffectiveVolume(id: ChannelId): number`  
  人声通道在 `voicesEnabled===false` 时为 0；BGM 另乘 duckingFactor；总静音则全 0。

- `setMasterVolume(value: number): void`  
  设置总音量（夹紧 0～1）。

- `setMuted(muted: boolean): void`  
  设置总静音。

- `setChannelVolume(id: ChannelId, value: number): void`  
  设置单通道音量。

- `setDuckingFactor(factor: number): void`  
  仅作用于 BGM 的额外乘数（1 为不闪避；闪避中为规格中的「压低到」值）。

- `snapshot(): MixerSnapshot`  
  返回当前总音量、静音、人声总闸、四通道音量、闪避系数，供 UI 与测试。

### 6.4 DuckingController

- `onSpeechOccupied(occupied: boolean): void`  
  人声任一通道开始为 true，会话全空为 false；内部对 Mixer 设置闪避并 `emit duckingChanged`。

- `configure(rule: DuckingRule): void`  
  替换压低比例与过渡毫秒（第一期可用 constants 默认，过渡由 BgmPlayer 插值或瞬时设置，架构允许瞬时）。

### 6.5 BgmResolver

- `resolve(locationName: string, mood: BgmMood): string | null`  
  情境规则优先于地点规则，返回曲目标识；全无命中返回 null（表示停 BGM）。

### 6.6 BgmPlayer

- `applyMixerVolume(volume: number): void`  
  把有效音量写到当前 `HTMLAudioElement`（含第二路淡出轨）。

- `transition(command: BgmTransitionCommand): Promise<void>`  
  执行淡出/淡入/强制打断；`trackId` 为空则只淡出；文件失败则静默停乐。

- `getCurrentTrackId(): string | null`  
  当前逻辑曲目（淡入完成后的目标）。

- `dispose(): void`  
  停止并释放音频元素。

### 6.7 SpeechEngine

- `isAvailable(): boolean`  
  浏览器是否支持 `speechSynthesis`。

- `resolveVoice(profile: VoiceProfile): SpeechSynthesisVoice | null`  
  按档案中的引擎声音名与中文 `lang` 选声；找不到则 null（仍尝试默认中文声）。

- `speak(job: SpeechJob, options: { volume: number }): Promise<SpeechEndKind>`  
  朗读台词全文；volume 为该人声通道有效音量；取消与失败也 resolve 为对应 EndKind，不 throw 到 UI。

- `cancel(): void`  
  立刻停止当前与挂起的浏览器朗读。

### 6.8 HeavenClassifier

- `classify(systemText: string): HeavenKind`  
  按关键词映射死亡/渡劫/大限/天罚/执法堂/逆天改命/开局，否则 `generic`。

### 6.9 CueBuilder

- `fromLogs(logs: ReadonlyArray<{ id: number; type: 'system' | 'player' | 'narrative'; content: string }>): SpeechLine[]`  
  player 丢弃；system → 天道台词；narrative → 旁白台词；顺序保持日志顺序，同批内稳定。

- `fromOpeningParagraphs(paragraphs: readonly string[]): SpeechLine[]`  
  全部作为旁白台词（开场）。

- `linesToJobs(lines: SpeechLine[]): SpeechJob[]`  
  绑定 voiceCatalog 中对应音色档案，状态为 `queued`。

### 6.10 SessionQueue

- `start(jobs: SpeechJob[], meta: { trigger: SessionTrigger; interruptible: boolean }): string`  
  若允许打断则先 `cancel`；入队并开始第一条；返回 `sessionId`。

- `interrupt(): void`  
  取消当前会话（新行动调用）。

- `replay(jobs: SpeechJob[]): string`  
  打断后只播这一批（单条日志重播）。

- `isBusy(): boolean`  
  是否有未完成会话。

- `dispose(): void`  
  打断并清空。

### 6.11 AudioBus

- `on<K extends AudioEventName>(name: K, listener: (payload: AudioEventMap[K]) => void): () => void`  
  订阅，返回取消函数。

- `emit<K extends AudioEventName>(name: K, payload: AudioEventMap[K]): void`  
  同步通知所有监听者；监听者抛错不影响其他监听者。

### 6.12 AudioFacade（游戏唯一入口）

- `hydrate(): AudioPreference`  
  读偏好并应用到 Mixer；不自动出声（须等用户手势 `unlockAfterGesture`）。创角页随后自己 `syncBgm`。

- `setVoicesEnabled(enabled: boolean): void`  
  人声总闸并持久化；立即作用于有效音量。

- `playNewLogs(logs: ReadonlyArray<LogEntryLite>, options?: { force?: boolean }): void`  
  默认 autoSpeak 为 true 即朗读；用户关掉后仅 `force` 才读。先 interrupt 再 start。

- `unlockAfterGesture(): void`  
  必须在用户点击后调用：尝试空朗读或 AudioContext.resume；成功则 `unlocked=true` 并 emit `audio:unlocked`。

- `setAutoSpeak(enabled: boolean): void`  
  改偏好并持久化；不补读历史日志。

- `syncBgm(input: { locationName: string; mood: BgmMood }): void`  
  Resolver + Player.transition；无手势解锁时只记「待播曲」，解锁后再播。

- `playNewLogs(logs: ReadonlyArray<LogEntryLite>, options?: { force?: boolean }): void`  
  `force` 或 `autoSpeak` 为真才构建会话；先 interrupt 再 start；空列表 no-op。

- `playOpening(paragraphs: readonly string[]): void`  
  仅当 autoSpeak 为真时把开场当旁白会话；BGM mood 由 MainGame 另行 `syncBgm(..., 'opening')`。

- `replayLog(log: LogEntryLite): void`  
  无论 autoSpeak，点击即 interrupt 后只读这一条。

- `interruptSpeech(): void`  
  新行动、关闭页面、切走前调用。

- `setMasterVolume(value: number): void`  
  Mixer + save + emit preferenceChanged。

- `setChannelVolume(id: ChannelId, value: number): void`  
  同上。

- `setMuted(muted: boolean): void`  
  同上。

- `getPreference(): AudioPreference`  
  当前内存偏好（与盘一致）。

- `getBus(): AudioBus`  
  供 AudioControls 订阅。

- `dispose(): void`  
  停 BGM、打断语音、卸监听。

### 6.13 AudioControls 与 MainGame（组件契约，非 class）

AudioControls 的 props：

- `facade: AudioFacade`

MainGame 不向 Facade 传 React state 以外的音频内部对象。行动流程约定：

1. `handleAction` 开头：`interruptSpeech()`  
2. 行动成功后：`syncBgm({ locationName, mood })`（由 `isDead` / combat / 突破文案 / 闭关关键字映射 mood，映射函数可放 `MainGame` 旁的纯函数 `mapActionToMood`，属游戏适配层，不算音频内核）  
3. 默认 `playNewLogs(本回合新增的 system+narrative)`（autoSpeak 默认开）  
4. 日志节点 `onClick`：`replayLog(log)`  
5. 根容器首次 `onClick`/`onKeyDown`：`unlockAfterGesture()`  

CreateCharacter：挂 `AudioControls`；首次手势后 `syncBgm({ locationName: '青岳·天机坊市', mood: 'characterCreate' })`。

`mapActionToMood(args): BgmMood` 签名（适配层 `audio/adapters/gameMood.ts`）：

- 参数：`{ isDead: boolean; inCombat: boolean; deathReason: string | null; actionText: string; isOpening: boolean; isCharacterCreate: boolean }`  
- 返回：`BgmMood`  

---

## 与规格的对应关系

- 已确认决议（两声线、打断、全文、创角 BGM、自动朗读、人声总闸、失败短讯、RVC 分期）落在 Facade/Mixer/事件上。  
- 实现顺序见 [audio_system.md](./audio_system.md) 第 6 节。  
- **本文仍不含实现代码。**
