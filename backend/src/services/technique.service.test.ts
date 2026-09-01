import { describe, it, expect } from 'vitest';
import { detectSpellClaim, unlearnedSpellForcedOutcome } from './technique.service';

describe('detectSpellClaim（声称催动术法）', () => {
  it('正常路径：木系法术缠绕再火系轰击应识别为术法宣称', () => {
    expect(detectSpellClaim('催动木系法术，缠绕妖狼四肢，再以火系法术轰击其要害')).toBe(true);
  });

  it('正常路径：挥剑砍狼不是术法宣称', () => {
    expect(detectSpellClaim('拔剑斩向眼前妖狼')).toBe(false);
  });

  it('边界：空串不是', () => {
    expect(detectSpellClaim('')).toBe(false);
  });
});

describe('unlearnedSpellForcedOutcome（未习则落空）', () => {
  it('失败/拒绝：未习任何招式时木火法术必须落空文案', () => {
    const text = unlearnedSpellForcedOutcome('催动木系法术轰击要害', []);
    expect(text).toContain('并未修习');
  });

  it('正常路径：已知招式名出现在句子里则不拦', () => {
    expect(unlearnedSpellForcedOutcome('催动青木缠丝术法', ['青木缠丝'])).toBeNull();
  });
});
