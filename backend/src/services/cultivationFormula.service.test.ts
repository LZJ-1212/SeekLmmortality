import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyCultivationGain,
  calculateSeclusionCultivationGain,
  getRootQualityCoefficient,
  getRegionBaseSpiritualDensity,
} from './cultivationFormula.service';

describe('getRootQualityCoefficient（灵根系数）', () => {
  it('正常路径：品质越高系数越高，严格递增', () => {
    const order = ['伪灵根', '杂灵根', '真灵根', '地灵根', '天灵根'];
    for (let i = 1; i < order.length; i++) {
      expect(getRootQualityCoefficient(order[i]!)).toBeGreaterThan(getRootQualityCoefficient(order[i - 1]!));
    }
  });

  it('边界情况：未知灵根品质应退化为中性系数 1.0', () => {
    expect(getRootQualityCoefficient('未知品质')).toBe(1.0);
  });
});

describe('getRegionBaseSpiritualDensity（地区基础灵气浓度——地区数据的差异化效果）', () => {
  it('正常路径：不同地区应有不同的基础灵气浓度', () => {
    const capital = getRegionBaseSpiritualDensity('青岳·天机坊市');
    const sectPeak = getRegionBaseSpiritualDensity('天机峰');
    expect(sectPeak).toBeGreaterThan(capital);
  });

  it('边界情况：未收录的地区应退化为默认浓度，不产生异常的天灵地宝效果', () => {
    expect(getRegionBaseSpiritualDensity('某个从未去过的地方')).toBe(10);
  });
});

describe('calculateMonthlyCultivationGain（月修为增长公式：10 × 资质系数 × 灵根系数 × 功法系数 × 灵气系数 × 心境系数）', () => {
  const baseline = { aptitude: 10, rootQuality: '真灵根', daoHeart: 10, caveSpiritualDensity: 10 };

  it('正常路径：全部数值都在基准值(10)时，月修为增长应恰好为 10（公式里的基准倍数）', () => {
    expect(calculateMonthlyCultivationGain(baseline)).toBe(10);
  });

  it('核心场景（洞府灵气浓度决定收益倍率）：灵气浓度翻倍时，月修为增长应等比例翻倍', () => {
    const doubled = calculateMonthlyCultivationGain({ ...baseline, caveSpiritualDensity: 20 });
    expect(doubled).toBe(20);
  });

  it('核心场景：灵气浓度腰斩时，月修为增长应等比例减半', () => {
    const halved = calculateMonthlyCultivationGain({ ...baseline, caveSpiritualDensity: 5 });
    expect(halved).toBe(5);
  });

  it('正常路径：资质更高时，月修为增长应相应提升', () => {
    const highAptitude = calculateMonthlyCultivationGain({ ...baseline, aptitude: 15 });
    expect(highAptitude).toBeGreaterThan(calculateMonthlyCultivationGain(baseline));
  });

  it('正常路径：天灵根比伪灵根应有明显更高的修炼效率', () => {
    const heavenlyRoot = calculateMonthlyCultivationGain({ ...baseline, rootQuality: '天灵根' });
    const falseRoot = calculateMonthlyCultivationGain({ ...baseline, rootQuality: '伪灵根' });
    expect(heavenlyRoot).toBeGreaterThan(falseRoot);
  });

  it('边界情况：资质或灵气浓度为 0（或负数，脏数据）时应保底为 0 系数，不产生负增长', () => {
    expect(calculateMonthlyCultivationGain({ ...baseline, aptitude: 0 })).toBe(0);
    expect(calculateMonthlyCultivationGain({ ...baseline, caveSpiritualDensity: -5 })).toBe(0);
  });

  it('边界情况：可选的功法系数默认应为 1.0（暂无功法系统时的占位值）', () => {
    const withoutTechnique = calculateMonthlyCultivationGain(baseline);
    const withNeutralTechnique = calculateMonthlyCultivationGain({ ...baseline, techniqueCoefficient: 1.0 });
    expect(withoutTechnique).toBe(withNeutralTechnique);
  });

  it('核心场景（逆天改命天赋读取）：天赋系数应等比例提升月修为增长，默认值为 1.0 不影响结果', () => {
    const withoutTalent = calculateMonthlyCultivationGain(baseline);
    const withTalent = calculateMonthlyCultivationGain({ ...baseline, talentCoefficient: 1.25 }); // 对应"大道感悟"天赋
    expect(withTalent).toBeCloseTo(withoutTalent * 1.25);
  });
});

describe('calculateSeclusionCultivationGain（闭关修炼总收益 = 月增长 × 闭关月数）', () => {
  const baseline = { aptitude: 10, rootQuality: '真灵根', daoHeart: 10, caveSpiritualDensity: 10 };

  it('核心场景："闭关十年"应获得约 10（月增长）× 120（月数）的修为', () => {
    expect(calculateSeclusionCultivationGain(baseline, 120)).toBe(1200);
  });

  it('边界情况：0 个月或负数月份应返回 0，不产生异常收益', () => {
    expect(calculateSeclusionCultivationGain(baseline, 0)).toBe(0);
    expect(calculateSeclusionCultivationGain(baseline, -5)).toBe(0);
  });
});
