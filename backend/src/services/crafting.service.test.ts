import { describe, it, expect } from 'vitest';
import { detectCraftingAttempt, resolveCrafting, CRAFT_RECIPES } from './crafting.service';

describe('detectCraftingAttempt（识别玩家是否在尝试炼制某个具体配方）', () => {
  it('正常路径：同时提到技艺关键词与配方物品名时应命中对应配方', () => {
    const recipe = detectCraftingAttempt('找个安静地方炼丹，尝试炼制聚气丹');
    expect(recipe?.resultName).toBe('聚气丹');
    expect(recipe?.discipline).toBe('炼丹');
  });

  it('正常路径：炼器/阵法/灵植关键词也应能正确命中对应配方', () => {
    expect(detectCraftingAttempt('在铁匠铺打造一把玄铁剑')?.resultName).toBe('玄铁剑');
    expect(detectCraftingAttempt('布阵制作传音符')?.resultName).toBe('传音符');
    expect(detectCraftingAttempt('在洞府外种植灵草')?.resultName).toBe('灵草');
  });

  it('边界情况：只提到技艺关键词但没有具体配方名称时，不应误判为炼制行为', () => {
    expect(detectCraftingAttempt('炼丹炉坏了，得找人修一修')).toBeNull();
  });

  it('边界情况：只提到物品名称但没有炼制类动作时，不应误判（如"服下聚气丹"是使用而非炼制）', () => {
    expect(detectCraftingAttempt('服下一颗聚气丹恢复灵力')).toBeNull();
  });

  it('边界情况：空字符串或无关行动应返回 null', () => {
    expect(detectCraftingAttempt('')).toBeNull();
    expect(detectCraftingAttempt('出城闲逛')).toBeNull();
  });

  it('健全性检查：配方表里每个配方都应能被自己的关键词+名称组合正确识别', () => {
    for (const recipe of CRAFT_RECIPES) {
      const detected = detectCraftingAttempt(`我要${recipe.discipline}一份${recipe.resultName}`);
      expect(detected?.resultName).toBe(recipe.resultName);
    }
  });
});

describe('resolveCrafting（炼制的确定性成败判定，六维属性差异化生效）', () => {
  const recipe = CRAFT_RECIPES.find((r) => r.resultName === '聚气丹')!; // primaryStat: comprehension, baseSuccessRate 0.7

  it('正常路径：骰子落在成功率区间内时应判定成功', () => {
    const result = resolveCrafting({ recipe, comprehension: 10, divineSense: 0 }, () => 0);
    expect(result.success).toBe(true);
  });

  it('正常路径：骰子落在成功率区间外时应判定失败', () => {
    const result = resolveCrafting({ recipe, comprehension: 10, divineSense: 0 }, () => 0.99);
    expect(result.success).toBe(false);
  });

  it('核心场景（六维差异化）：悟性越高，炼丹成功率越高——同一个骰子结果，高悟性能成功、低悟性会失败', () => {
    // baseSuccessRate 0.7，悟性加成 0.02/点
    // comprehension=10 -> 0.7+0.2=0.9；comprehension=0 -> 0.7+0=0.7
    const roll = 0.85;
    const highComprehension = resolveCrafting({ recipe, comprehension: 10, divineSense: 0 }, () => roll);
    const lowComprehension = resolveCrafting({ recipe, comprehension: 0, divineSense: 0 }, () => roll);
    expect(highComprehension.success).toBe(true);
    expect(lowComprehension.success).toBe(false);
  });

  it('核心场景（六维差异化）：炼器配方应该看神识而非悟性——神识高低才会影响成功率', () => {
    const weaponRecipe = CRAFT_RECIPES.find((r) => r.resultName === '玄铁剑')!; // primaryStat: divine_sense
    const roll = 0.6; // baseSuccessRate 0.5，需要神识加成才能突破 0.6
    const highDivineSense = resolveCrafting({ recipe: weaponRecipe, comprehension: 0, divineSense: 10 }, () => roll);
    const lowDivineSense = resolveCrafting({ recipe: weaponRecipe, comprehension: 100, divineSense: 0 }, () => roll);
    expect(highDivineSense.success).toBe(true); // 0.5 + 10*0.02 = 0.7 >= 0.6
    expect(lowDivineSense.success).toBe(false); // 悟性再高也帮不上炼器，成功率仍是 0.5 < 0.6
  });

  it('边界情况：成功率不会无限提升，夹在 [0.05, 0.95] 之间', () => {
    const result = resolveCrafting({ recipe, comprehension: 99999, divineSense: 0 }, () => 0.94);
    expect(result.success).toBe(true); // 成功率封顶 0.95，仍应命中 0.94
    const failResult = resolveCrafting({ recipe, comprehension: 99999, divineSense: 0 }, () => 0.96);
    expect(failResult.success).toBe(false); // 超过封顶的 0.95，必定失败
  });

  it('正常路径：结果文案应区分成功/失败两种叙事', () => {
    const success = resolveCrafting({ recipe, comprehension: 10, divineSense: 0 }, () => 0);
    const failure = resolveCrafting({ recipe, comprehension: 10, divineSense: 0 }, () => 0.99);
    expect(success.forcedOutcomeText).toContain('成功炼成');
    expect(failure.forcedOutcomeText).toContain('失败');
  });
});
