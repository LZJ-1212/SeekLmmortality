# I11 手机适配架构（只设计不实现）

依据 [mobile.md](./mobile.md) 的 **L1 最小集**。不改 Express / Prisma / 网关。只改前端布局与视口。

---

## 0. 本架构拍板

| 项 | 决议 |
|----|------|
| 断点 | Tailwind `md:` = **768px**。`< md` 窄屏；`md+` 现桌面。 |
| 指令 UI | **同一套** `COMMANDS` / `handleCommand`。窄屏换位置（底栏），不换语义。 |
| 检测方式 | **CSS 为主**（`md:flex` / `md:hidden`）。不另做 `window.innerWidth` 状态机，除非键盘高度必须用 JS。 |
| 键盘 | 局内根节点用 `100dvh`（或 `visualViewport` 写入 CSS 变量 `--app-height`）。优先 `dvh`；iOS 仍挡输入再补 `visualViewport` 监听。 |
| 安全区 | 底栏 `padding-bottom: env(safe-area-inset-bottom)`。 |
| 点击目标 | 窄屏指令格 **最小约 44×36 CSS 像素**（可略扁）；主按钮（行动、踏入仙途）高度 ≥ 40px。 |
| 前端单测 | L1 不强制。`npm run build` 必过。 |

---

## 1. 目录与职责

现有文件，开工时改这些，**不要**新建第二套页面路由：

```
frontend/index.html              # viewport 可加 viewport-fit=cover
frontend/src/App.tsx             # 一般不用动
frontend/src/components/
  CommandMenu.tsx                # 抽 variant：sidebar | dock；或窄屏用同一数据在 MainGame 底栏 map
  MainGame.tsx                   # 窄屏列布局；宽屏保持左栏
  SaveList.tsx                   # w-full max-w-lg，去掉死宽 560
  CreateCharacter.tsx            # 同上 520；外层改为可滚动、底按钮始终能滚到
  InfoModal.tsx / LoadModal.tsx  # w-[calc(100%-2rem)] max-w-lg
  StatusCard.tsx                 # 去掉 w-[420px]，改为 w-full
```

禁止新建 `MobileMainGame.tsx` 复制一份局内逻辑。

---

## 2. 局内窄屏结构（示意）

```
┌─────────────────────────────┐
│ 顶栏 九州 · 字号 · 天玄历     │
│ 精简状态条（可换行）           │
├─────────────────────────────┤
│ 日志（flex-1 overflow-y-auto）│
├─────────────────────────────┤
│ 动态选项（flex-wrap）         │
│ 输入 + 行动                   │
│ 指令底栏 4 列 × n 行          │
│ + safe-area                   │
└─────────────────────────────┘
```

宽屏（`md:`）：

```
[ CommandMenu sidebar 104px ] [ 顶栏 + 状态条 + 日志 + 选项 + 输入 ]
```

窄屏 **隐藏** 左侧 `CommandMenu`，在输入行下方渲染同一 `COMMANDS` 数组。

---

## 3. 键盘

1. 根：`h-[100dvh] min-h-0 overflow-hidden`（局内），日志 `min-h-0 flex-1`。
2. 若 iOS Safari 仍把输入顶出屏：在 `MainGame` 用 `visualViewport` 把 `height` 设为 `visualViewport.height`，`resize`/`scroll` 时更新；卸载时移除监听。
3. 不要对 `body` 锁死 `position:fixed` 导致完全不能滚创角页（创角页要整页滚）。

---

## 4. 开工顺序

1. 死宽改 `w-full max-w-*`：`SaveList`、`CreateCharacter`、弹窗、`StatusCard`。
2. `MainGame`：`md` 切换左栏 / 底栏；窄屏 `dvh` 列布局。
3. `index.html` viewport-fit；底栏 safe-area。
4. 真机或 DevTools 390 宽走完 [mobile.md](./mobile.md) 第 7 节；再 `md` 回归桌面。
5. `frontend` `npm run build`。

禁止先做 PWA manifest、禁止为 I11 改 `server.ts`。

---

## 5. 测试清单

| 测什么 | 方式 |
|--------|------|
| 宽屏布局未丢左栏 | DevTools ≥768 |
| 窄屏无整页横向滚动 | 390 宽走三页 |
| 14 指令都能点且语义未改 | 对照桌面点同一指令 |
| 键盘下能提交行动 | 真机优先；次选 DevTools 设备模式 |
| `npm run build` | 必做 |

不测原生包。不测微信内置浏览器的全部 quirk（能打开即可；挡输入再补 `visualViewport`）。
