/**
 * 经济与坊市交易（Service 层，纯函数，不依赖数据库）。
 * 设定核心：灵石体系、物品图鉴（items_template.base_price）、坊市买卖、拍卖会喊价。
 * 价格与成交结果全部由后端硬性计算，绝不采信 AI 自己编造的成交价——
 * 这是本次会话一贯的原则在"财"这个维度上的落地。
 */

import { parseNumberToken, NUMBER_TOKEN_PATTERN } from '../utils/numeral';
import { findLongestMatchingName } from '../utils/textMatch';

/** 单次行动里，AI 给出的灵石增减幅度上限，防止 AI 一次性发放/扣除离谱数量的灵石 */
export const MAX_SPIRIT_STONES_DELTA_PER_ACTION = 500;

export function clampSpiritStonesDelta(delta: number): number {
  return Math.max(-MAX_SPIRIT_STONES_DELTA_PER_ACTION, Math.min(MAX_SPIRIT_STONES_DELTA_PER_ACTION, delta));
}

// ==================== 坊市买卖：以物品图鉴（base_price）为唯一定价依据 ====================

/** 坊市回收价相对原价的折扣比例——低买高卖套利空间必须被压缩，符合基本商业常识 */
export const SELL_PRICE_RATIO = 0.5;

export type ShopActionType = 'buy' | 'sell';

const BUY_KEYWORDS = ['购买', '买下', '买入', '花钱买'];
const SELL_KEYWORDS = ['出售', '卖掉', '卖出', '售卖'];

/** 识别玩家是在"买"还是"卖"；同时命中时优先判定为卖（"卖"字通常更明确，避免"卖不出去只能自己买"之类误判） */
export function detectShopActionType(actionText: string): ShopActionType | null {
  if (!actionText) return null;
  if (SELL_KEYWORDS.some((k) => actionText.includes(k))) return 'sell';
  if (BUY_KEYWORDS.some((k) => actionText.includes(k))) return 'buy';
  return null;
}

/** 从若干候选物品名里，挑出真正出现在行动文本中的那一个（优先选最长的名字，避免子串误命中） */
export const findMentionedTemplateName = findLongestMatchingName;

/** 解析交易数量（如"买3份聚气丹"里的 3），未指明时默认为 1 */
export function detectTradeQuantity(actionText: string): number {
  const match = actionText.match(new RegExp(`${NUMBER_TOKEN_PATTERN}\\s*[个份枚瓶把件颗株]`));
  if (match?.[1]) {
    const parsed = parseNumberToken(match[1]);
    if (parsed !== null && parsed > 0) return parsed;
  }
  return 1;
}

export interface ShopTransactionInput {
  type: ShopActionType;
  itemName: string;
  basePrice: number;
  quantity: number;
  playerSpiritStones: number;
  /** 出售时需要校验背包里是否真的有这么多；购买场景不需要传 */
  playerOwnedQuantity?: number;
}

export interface ShopTransactionResult {
  success: boolean;
  /** 买入为花费的灵石（正数）；卖出为获得的灵石（正数） */
  spiritStonesDelta: number;
  forcedOutcomeText: string;
}

/**
 * 坊市买卖的确定性结算：成交价格完全由 items_template.base_price 决定，
 * 灵石够不够、库存够不够，全部在这里硬性校验，绝不依赖 AI 自行判断。
 */
export function resolveShopTransaction(input: ShopTransactionInput): ShopTransactionResult {
  if (input.type === 'buy') {
    const totalCost = Math.round(input.basePrice * input.quantity);
    if (totalCost > input.playerSpiritStones) {
      return {
        success: false,
        spiritStonesDelta: 0,
        forcedOutcomeText: `玩家想购买 ${input.quantity} 份「${input.itemName}」，需要 ${totalCost} 灵石，但囊中灵石仅剩 ${input.playerSpiritStones}，不足以支付，交易失败，坊市伙计婉拒了这单生意。`,
      };
    }
    return {
      success: true,
      spiritStonesDelta: -totalCost,
      forcedOutcomeText: `玩家花费 ${totalCost} 灵石，从坊市购得 ${input.quantity} 份「${input.itemName}」。`,
    };
  }

  const owned = input.playerOwnedQuantity ?? 0;
  if (input.quantity > owned) {
    return {
      success: false,
      spiritStonesDelta: 0,
      forcedOutcomeText: `玩家想出售 ${input.quantity} 份「${input.itemName}」，但背包里根本没有这么多，交易失败。`,
    };
  }
  const totalRevenue = Math.round(input.basePrice * SELL_PRICE_RATIO * input.quantity);
  return {
    success: true,
    spiritStonesDelta: totalRevenue,
    forcedOutcomeText: `玩家将 ${input.quantity} 份「${input.itemName}」卖给坊市商贩，得手 ${totalRevenue} 灵石。`,
  };
}

// ==================== 拍卖会喊价：与虚拟对手的竞价博弈 ====================

/** 从玩家行动文本里解析拍卖喊价金额（如"喊价500灵石"里的 500） */
export function detectAuctionBidAmount(actionText: string): number | null {
  if (!actionText || !(actionText.includes('拍卖') && (actionText.includes('喊价') || actionText.includes('出价') || actionText.includes('竞价')))) {
    return null;
  }
  const match = actionText.match(new RegExp(`${NUMBER_TOKEN_PATTERN}\\s*(灵石|块)`));
  if (match?.[1]) {
    const parsed = parseNumberToken(match[1]);
    if (parsed !== null && parsed > 0) return parsed;
  }
  return null;
}

/** 稀有度越高，虚拟竞价对手的加价幅度上限越夸张，体现"珍品必遭哄抢"的坊市生态 */
const RARITY_RIVAL_PREMIUM: Record<number, number> = { 1: 0.3, 2: 0.5, 3: 0.8, 4: 1.2, 5: 1.8 };
const DEFAULT_RIVAL_PREMIUM = 0.5;

export interface AuctionBidInput {
  bidAmount: number;
  /** 拍卖品的真实估值（字典物品用 base_price；自定义拍卖品用 AI 建议估值，经熔断） */
  itemBaseValue: number;
  /** 稀有度 1~5，决定竞价对手的疯狂程度 */
  rarity: number;
  playerSpiritStones: number;
}

export interface AuctionBidResult {
  won: boolean;
  /** 竞得价（=bidAmount，玩家不会被要求二次加价）；未竞得时为 0 */
  finalPrice: number;
  forcedOutcomeText: string;
}

/**
 * 拍卖喊价的确定性结算：虚拟对手的心理价位 = 估值 × (1 + 随机加价幅度)，
 * 玩家出价若超过这个心理价位即中标，否则被对手截胡——是否中标全部由后端掷骰决定。
 */
export function resolveAuctionBid(input: AuctionBidInput, rollFn: () => number = Math.random): AuctionBidResult {
  if (input.bidAmount > input.playerSpiritStones) {
    return {
      won: false,
      finalPrice: 0,
      forcedOutcomeText: `玩家想喊价 ${input.bidAmount} 灵石，但身上灵石根本不够，这个价码开不出口，只能眼巴巴地看着旁人竞价。`,
    };
  }

  const premium = RARITY_RIVAL_PREMIUM[Math.min(5, Math.max(1, Math.round(input.rarity)))] ?? DEFAULT_RIVAL_PREMIUM;
  const rivalCeiling = Math.round(input.itemBaseValue * (1 + rollFn() * premium));
  const won = input.bidAmount >= rivalCeiling;

  return {
    won,
    finalPrice: won ? input.bidAmount : 0,
    forcedOutcomeText: won
      ? `全场再无人加价，一声"成交"过后，玩家以 ${input.bidAmount} 灵石的价格击败所有对手，成功拍下此物！`
      : `场中另一位买家毫不犹豫地加价到更高，玩家的出价终究还是低了一线，最终与此物失之交臂，灵石分毫未损。`,
  };
}
