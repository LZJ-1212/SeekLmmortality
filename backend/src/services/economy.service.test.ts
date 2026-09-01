import { describe, it, expect } from 'vitest';
import {
  clampSpiritStonesDelta,
  MAX_SPIRIT_STONES_DELTA_PER_ACTION,
  detectShopActionType,
  findMentionedTemplateName,
  detectTradeQuantity,
  resolveShopTransaction,
  detectAuctionBidAmount,
  resolveAuctionBid,
  SELL_PRICE_RATIO,
} from './economy.service';

describe('clampSpiritStonesDelta（防止 AI 一次性发放/扣除离谱数量的灵石）', () => {
  it('正常路径：范围内的数值原样保留', () => {
    expect(clampSpiritStonesDelta(100)).toBe(100);
  });

  it('边界情况：超出上限的数值应被夹紧', () => {
    expect(clampSpiritStonesDelta(999999)).toBe(MAX_SPIRIT_STONES_DELTA_PER_ACTION);
    expect(clampSpiritStonesDelta(-999999)).toBe(-MAX_SPIRIT_STONES_DELTA_PER_ACTION);
  });
});

describe('detectShopActionType（识别买/卖行动）', () => {
  it('正常路径：应正确识别购买行动', () => {
    expect(detectShopActionType('去坊市购买一把玄铁剑')).toBe('buy');
  });

  it('正常路径：应正确识别出售行动', () => {
    expect(detectShopActionType('把多余的灵草卖掉换灵石')).toBe('sell');
  });

  it('边界情况：既不买也不卖的普通行动应返回 null', () => {
    expect(detectShopActionType('在坊市里随便逛逛')).toBeNull();
  });

  it('边界情况：同时出现买卖关键词时优先判定为卖', () => {
    expect(detectShopActionType('把买来的丹药卖掉')).toBe('sell');
  });
});

describe('findMentionedTemplateName（从候选物品名里挑出真正提及的那一个）', () => {
  const templateNames = ['聚气丹', '筑基丹', '回春散'];

  it('正常路径：应正确匹配到提到的物品', () => {
    expect(findMentionedTemplateName('我要买一颗聚气丹', templateNames)).toBe('聚气丹');
  });

  it('边界情况：多个候选名字都是子串时应优先选最长的，避免"丹"字误命中', () => {
    // 假设候选里有"丹"这种短名字（真实数据不会有，这里模拟极端情况）
    expect(findMentionedTemplateName('买一颗聚气丹', ['丹', '聚气丹'])).toBe('聚气丹');
  });

  it('边界情况：没有任何候选名字出现在文本里时应返回 null', () => {
    expect(findMentionedTemplateName('买一把剑', templateNames)).toBeNull();
  });
});

describe('detectTradeQuantity（解析交易数量，未指明时默认为 1）', () => {
  it('正常路径：应正确解析阿拉伯数字数量', () => {
    expect(detectTradeQuantity('买3份聚气丹')).toBe(3);
  });

  it('正常路径：应正确解析中文数字数量', () => {
    expect(detectTradeQuantity('买十瓶回春散')).toBe(10);
  });

  it('边界情况：未指明数量时应默认为 1', () => {
    expect(detectTradeQuantity('买一颗聚气丹')).toBe(1); // "一"没有紧跟计量单位组合被解析，退化为默认 1 也可接受
    expect(detectTradeQuantity('买聚气丹')).toBe(1);
  });
});

describe('resolveShopTransaction（坊市买卖的确定性结算，价格完全取决于物品图鉴 base_price）', () => {
  it('正常路径：购买时灵石充足应交易成功，花费 = 单价 × 数量', () => {
    const result = resolveShopTransaction({
      type: 'buy', itemName: '聚气丹', basePrice: 20, quantity: 3, playerSpiritStones: 100,
    });
    expect(result.success).toBe(true);
    expect(result.spiritStonesDelta).toBe(-60);
  });

  it('异常路径：购买时灵石不足应交易失败，不产生任何灵石变动', () => {
    const result = resolveShopTransaction({
      type: 'buy', itemName: '筑基丹', basePrice: 500, quantity: 1, playerSpiritStones: 100,
    });
    expect(result.success).toBe(false);
    expect(result.spiritStonesDelta).toBe(0);
  });

  it('正常路径：出售时背包库存充足应交易成功，收入 = 单价 × 回收比例 × 数量', () => {
    const result = resolveShopTransaction({
      type: 'sell', itemName: '聚气丹', basePrice: 20, quantity: 2, playerSpiritStones: 0, playerOwnedQuantity: 5,
    });
    expect(result.success).toBe(true);
    expect(result.spiritStonesDelta).toBe(Math.round(20 * SELL_PRICE_RATIO * 2));
  });

  it('异常路径：出售数量超过背包实际持有量应交易失败', () => {
    const result = resolveShopTransaction({
      type: 'sell', itemName: '聚气丹', basePrice: 20, quantity: 5, playerSpiritStones: 0, playerOwnedQuantity: 2,
    });
    expect(result.success).toBe(false);
    expect(result.spiritStonesDelta).toBe(0);
  });
});

describe('detectAuctionBidAmount（解析拍卖喊价金额）', () => {
  it('正常路径：应正确解析"拍卖"+"喊价"场景下的金额', () => {
    expect(detectAuctionBidAmount('在拍卖会上为那件法宝喊价500灵石')).toBe(500);
  });

  it('边界情况：没有提到拍卖场景时应返回 null', () => {
    expect(detectAuctionBidAmount('花500灵石买一把剑')).toBeNull();
  });

  it('边界情况：提到拍卖但没有具体金额时应返回 null', () => {
    expect(detectAuctionBidAmount('去参加拍卖会看看有什么好东西')).toBeNull();
  });
});

describe('resolveAuctionBid（拍卖喊价的确定性竞价结算）', () => {
  it('异常路径：灵石不足以支付喊价金额时应直接判定失败，不掷骰', () => {
    const result = resolveAuctionBid({ bidAmount: 1000, itemBaseValue: 500, rarity: 3, playerSpiritStones: 100 });
    expect(result.won).toBe(false);
    expect(result.finalPrice).toBe(0);
  });

  it('核心场景：出价远超物品估值上限时应必定中标', () => {
    const result = resolveAuctionBid(
      { bidAmount: 100000, itemBaseValue: 500, rarity: 5, playerSpiritStones: 200000 },
      () => 0.999, // 即便对手加价到理论最高幅度，玩家的出价依然碾压性地更高
    );
    expect(result.won).toBe(true);
    expect(result.finalPrice).toBe(100000);
  });

  it('核心场景：出价远低于估值时应必定被截胡', () => {
    const result = resolveAuctionBid(
      { bidAmount: 10, itemBaseValue: 500, rarity: 3, playerSpiritStones: 10000 },
      () => 0, // 即便对手完全不加价，估值本身也远高于玩家出价
    );
    expect(result.won).toBe(false);
    expect(result.finalPrice).toBe(0);
  });

  it('边界情况：稀有度越高，竞价对手越激进（相同随机数下，高稀有度更容易让玩家落败）', () => {
    const roll = () => 0.9;
    const lowRarity = resolveAuctionBid({ bidAmount: 600, itemBaseValue: 500, rarity: 1, playerSpiritStones: 10000 }, roll);
    const highRarity = resolveAuctionBid({ bidAmount: 600, itemBaseValue: 500, rarity: 5, playerSpiritStones: 10000 }, roll);
    // 稀有度 1：rivalCeiling = 500*(1+0.9*0.3)=635 > 600，玩家出价 600 会落败
    // 稀有度 5：rivalCeiling = 500*(1+0.9*1.8)=1310 > 600，玩家出价 600 更加落败（此处主要验证不会反过来变成中标）
    expect(lowRarity.won).toBe(false);
    expect(highRarity.won).toBe(false);
  });
});
