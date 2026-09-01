import { describe, it, expect } from 'vitest';
import { buildOpeningNarrative, getGenderPronoun } from './opening.service';

const baseInput = {
  name: '林清玄',
  gender: '男',
  origin: '农家子',
  daoPursuit: '问道飞升',
  constitution: '凡体',
  roots: { quality: '地灵根', elements: ['木', '火'] },
  innateTalents: ['天资聪颖'],
  attributes: { aptitude: 12, comprehension: 10, divine_sense: 10, speed: 10, dao_heart: 13, fortune: 11 },
};

describe('getGenderPronoun（性别代称）', () => {
  it('男性应返回「他」', () => expect(getGenderPronoun('男')).toBe('他'));
  it('女性应返回「她」', () => expect(getGenderPronoun('女')).toBe('她'));
  it('妖/无相/缺失应返回「其」', () => {
    expect(getGenderPronoun('妖')).toBe('其');
    expect(getGenderPronoun('无相')).toBe('其');
    expect(getGenderPronoun(undefined)).toBe('其');
  });
});

describe('buildOpeningNarrative（开场剧情生成）', () => {
  it('正常路径：应生成非空的剧情段落与起步选项', () => {
    const result = buildOpeningNarrative(baseInput);
    expect(result.paragraphs.length).toBeGreaterThanOrEqual(4);
    expect(result.options.length).toBeGreaterThan(0);
    expect(result.options[0]).toHaveProperty('tag');
    expect(result.options[0]).toHaveProperty('text');
  });

  it('核心场景：剧情应包含玩家的名字、出身与灵根品质', () => {
    const result = buildOpeningNarrative(baseInput);
    const full = result.paragraphs.join('');
    expect(full).toContain('林清玄');
    expect(full).toContain('农家子');
    expect(full).toContain('地灵根');
    expect(full).toContain('木、火');
  });

  it('核心场景：剧情应包含体质与道途', () => {
    const result = buildOpeningNarrative({ ...baseInput, constitution: '先天道体', daoPursuit: '逍遥长生' });
    const full = result.paragraphs.join('');
    expect(full).toContain('先天道体');
    expect(full).toContain('逍遥');
  });

  it('核心场景：剧情应突出六维中最高的一项（道心坚毅）', () => {
    const result = buildOpeningNarrative(baseInput);
    const full = result.paragraphs.join('');
    expect(full).toContain('道心坚毅');
  });

  it('核心场景：性别决定代词，女性角色剧情应出现「她」', () => {
    const result = buildOpeningNarrative({ ...baseInput, gender: '女' });
    expect(result.paragraphs.join('')).toContain('她');
  });

  it('核心场景：触发前世遗泽时，应额外追加一段因果', () => {
    const withLegacy = buildOpeningNarrative({
      ...baseInput,
      legacyBlessing: { type: 'buried_treasure', narrativeText: '你冥冥中记起前世埋藏法宝的地点。' },
    });
    const withoutLegacy = buildOpeningNarrative(baseInput);
    expect(withLegacy.paragraphs.length).toBe(withoutLegacy.paragraphs.length + 1);
    expect(withLegacy.paragraphs.join('')).toContain('前世');
  });

  it('边界情况：未知出身/体质/道途/天赋应安全退化，不抛异常', () => {
    const result = buildOpeningNarrative({
      ...baseInput,
      origin: '不存在',
      constitution: '不存在',
      daoPursuit: '不存在',
      innateTalents: ['不存在'],
    });
    expect(result.paragraphs.length).toBeGreaterThanOrEqual(4);
  });

  it('边界情况：空名字应退化为「无名氏」，空灵根应显示「无」', () => {
    const result = buildOpeningNarrative({ ...baseInput, name: '', roots: { quality: '', elements: [] } });
    const full = result.paragraphs.join('');
    expect(full).toContain('无名氏');
    expect(full).toContain('无');
  });

  it('确定性：同一套命格生成两次结果应完全一致', () => {
    const a = buildOpeningNarrative(baseInput);
    const b = buildOpeningNarrative(baseInput);
    expect(a.paragraphs).toEqual(b.paragraphs);
    expect(a.options).toEqual(b.options);
  });
});
