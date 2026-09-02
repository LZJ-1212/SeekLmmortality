/**
 * A6 短记忆（S22 薄做）：让「下一句」还记得「上一场」。
 *
 * 规格权威见 docs/chronicle.md 第 0 节。目标只解决当场割裂：
 *   玩家救完重伤者后写「继续前行，搜寻机缘」不得另开一场白狐。
 *
 * 铁律：
 *   - 只锁叙事，不锁数值：不掷骰、不改 hp/物品/胜负。
 *   - 明文子串，禁止正则、禁止模型判断「该不该继续救」。
 *   - 不建 chronicles 表、不入库整段剧情（那属阶段 D1）。
 *   - 本文件不调用任何 LLM；「不调第二次 LLM」是验收项。
 */

// ==================== 类型与常量 ====================

export type PendingScene = 'none' | 'wounded_expert' | 'secret_realm';

/** 上一回叙事摘要上限（Unicode 码位，与网关 200 字行动上限同量级、更短） */
export const DIGEST_MAX_CODE_POINTS = 120;

/** 「算离开」子串：命中任一条即在成功落库后清掉 pending（明文，禁止正则） */
const PENDING_LEAVE_KEYWORDS: readonly string[] = [
  '不管他',
  '弃之不顾',
  '抛下',
  '丢下',
  '告辞',
  '就此别过',
  '转身离去',
  '离开此地',
  '回府',
  '闭关',
];

/** 秘境专属「了结」子串：进入 / 放弃 / 不进，都清掉 secret_realm（不必穷尽小说） */
const SECRET_REALM_EXIT_KEYWORDS: readonly string[] = [
  '进入秘境',
  '踏入秘境',
  '放弃秘境',
  '不进秘境',
];

// ==================== 纯函数 ====================

/**
 * 截断上一回成功叙事：空串得 ''；超出 120 码位直接 slice（按 Unicode 码位，不用 UTF-16 单元）。
 */
export function truncateNarrativeDigest(text: string): string {
  if (!text) return '';
  return Array.from(text).slice(0, DIGEST_MAX_CODE_POINTS).join('');
}

/**
 * 解析库里的 pending_scene 列；未知值一律当 none，绝不 throw 把整次回合打 500。
 */
export function parsePendingScene(raw: unknown): PendingScene {
  return raw === 'wounded_expert' || raw === 'secret_realm' ? raw : 'none';
}

/**
 * 判断玩家是否「离开了」未收束场景。pending 为 none 时恒 false。
 * 「继续前行 / 搜寻机缘 / 历练 / 探索 / 游历 / 另寻」不含离开词，仍视为未收束（保持 pending）。
 */
export function detectPendingLeave(action: string, pending: PendingScene): boolean {
  if (pending === 'none') return false;
  const t = (action ?? '').replace(/\s+/g, '');
  if (!t) return false;
  return PENDING_LEAVE_KEYWORDS.some((k) => t.includes(k));
}

/** 秘境专属了结判定（进入 / 放弃 / 不进），只对 secret_realm 生效 */
function hasSecretRealmExit(action: string): boolean {
  const t = (action ?? '').replace(/\s+/g, '');
  if (!t) return false;
  return SECRET_REALM_EXIT_KEYWORDS.some((k) => t.includes(k));
}

/**
 * 计算本回合成功落库后应写回的 pending_scene：
 *   1. 本回合探索骰若触发了 wounded_expert / secret_realm → 覆盖为新类型；
 *   2. 否则 secret_realm 且命中秘境了结词 → 清 none；
 *   3. 否则命中离开词 → 清 none；
 *   4. 否则保持不变。
 */
export function nextPendingScene(input: {
  pending: PendingScene;
  /** 本回合探索骰触发的类型（none = 未触发） */
  encounterType: PendingScene;
  action: string;
  /** detectPendingLeave 的结果 */
  leave: boolean;
}): PendingScene {
  const { pending, encounterType, action, leave } = input;
  if (encounterType === 'wounded_expert' || encounterType === 'secret_realm') {
    return encounterType;
  }
  if (pending === 'secret_realm' && hasSecretRealmExit(action)) {
    return 'none';
  }
  if (leave) return 'none';
  return pending;
}

// ==================== 注入块 ====================

const WOUNDED_EXPERT_PENDING_TEXT =
  '场上仍有未了的重伤之人（或其所托之物）。叙事须接续此事；禁止另开互不相关的新奇遇（幼兽、另一路人、第二场秘境等）。next_options 须点名当前场（继续救治 / 检视所赠 / 明确抛下），禁止只给「搜寻机缘」万金油。';

const SECRET_REALM_PENDING_TEXT =
  '秘境仍在眼前未决。须写进入、放弃或观望；禁止假装没看见另起炉灶。选项同上理。';

/**
 * 拼给 deduceAction 的近事注入块（放在 system prompt「玩家行动」之前，与 A5 的 forcedOutcome 分段）。
 * 有 digest 无 pending 时只注入【近事】，不禁止新奇遇。
 */
export function buildSceneMemoryPrompt(digest: string, pending: PendingScene): string {
  const nearText = digest && digest.trim() ? digest : '无';
  const nearLine = `【近事】上一回：${nearText}`;
  if (pending === 'none') return nearLine;
  const pendingText = pending === 'wounded_expert' ? WOUNDED_EXPERT_PENDING_TEXT : SECRET_REALM_PENDING_TEXT;
  return `${nearLine}\n【未收束】${pendingText}`;
}
