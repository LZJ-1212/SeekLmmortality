export type SceneContext = 'none' | 'combat';

export type ActionIntent =
  | 'seclusion'
  | 'shop'
  | 'auction'
  | 'craft'
  | 'dual_cultivation'
  | 'other';

const COMBAT_BLOCKED: ReadonlySet<ActionIntent> = new Set([
  'seclusion',
  'shop',
  'auction',
  'craft',
  'dual_cultivation',
]);

const REJECT_MESSAGE: Record<Exclude<ActionIntent, 'other'>, string> = {
  seclusion: '刀剑未歇，岂能盘膝入定。',
  shop: '厮杀之间，坊市远在天边。',
  auction: '拍卖席上并无你的席位。',
  craft: '烽火之中，丹炉如何安放。',
  dual_cultivation: '生死一线，岂能双修。',
};

export function parseSceneContext(raw: unknown): SceneContext {
  return raw === 'combat' ? 'combat' : 'none';
}

/** 从玩家输入识别「会触发硬拦截器」的意图；未点名的句子一律 other（交手/逃/说话）。 */
export function detectActionIntent(actionText: string): ActionIntent {
  const t = actionText.replace(/\s+/g, '');
  if (!t) return 'other';
  if (t.includes('闭关')) return 'seclusion';
  if (t.includes('双修')) return 'dual_cultivation';
  if (t.includes('拍卖') || t.includes('喊价') || t.includes('竞价')) return 'auction';
  if (t.includes('炼丹') || t.includes('炼器') || t.includes('布置阵') || t.includes('灵植') || t.includes('炼制')) {
    return 'craft';
  }
  if (t.includes('坊市') || t.includes('购买') || t.includes('买入') || t.includes('出售') || t.includes('卖出')) {
    return 'shop';
  }
  return 'other';
}

export type SituationDecision = { ok: true } | { ok: false; message: string };

/**
 * 情境锁：交手未歇时禁止闭关/坊市等「抽身事外」的硬结算行动。
 * 拒绝必须发生在闭关公式之前，且调用方不得再调模型。
 */
export function evaluateSituation(scene: SceneContext, actionText: string): SituationDecision {
  if (scene !== 'combat') return { ok: true };
  const intent = detectActionIntent(actionText);
  if (!COMBAT_BLOCKED.has(intent)) return { ok: true };
  return { ok: false, message: REJECT_MESSAGE[intent] };
}

/** 本回合成功落定后的下一情境。被锁拒绝时不要调用，以免把交手清掉。 */
export function nextSceneContext(input: {
  inCombat: boolean;
  isDead: boolean;
}): SceneContext {
  if (input.isDead) return 'none';
  if (input.inCombat) return 'combat';
  return 'none';
}
