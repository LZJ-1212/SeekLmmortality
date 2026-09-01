/**
 * 中文数字/阿拉伯数字解析工具（纯函数，无副作用）。
 * 供闭关时长解析、坊市交易数量/金额解析、拍卖喊价金额解析等多个场景复用，
 * 避免同一段解析逻辑在各个 Service 里重复实现（DRY 原则）。
 */

const CHINESE_DIGITS: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
};
const CHINESE_UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000 };

/** 供正则表达式拼接使用的"数字 token"片段：阿拉伯数字或中文数字连写 */
export const NUMBER_TOKEN_PATTERN = '([0-9]+|[零一二两三四五六七八九十百千万]+)';

/** 把「十」「二十三」「一百二十」这类中文数字转换成阿拉伯数字，无法解析时返回 null */
export function parseChineseNumeral(text: string): number | null {
  let total = 0;
  let section = 0;
  let num = 0;
  let matched = false;
  for (const ch of text) {
    if (ch in CHINESE_DIGITS) {
      num = CHINESE_DIGITS[ch]!;
      matched = true;
    } else if (ch in CHINESE_UNITS) {
      const unit = CHINESE_UNITS[ch]!;
      if (unit === 10000) {
        total += (section + (num || 1)) * unit;
        section = 0;
        num = 0;
      } else {
        section += (num || 1) * unit;
        num = 0;
      }
      matched = true;
    } else {
      return null;
    }
  }
  return matched ? total + section + num : null;
}

/** 优先按阿拉伯数字解析，失败再尝试中文数字；两者都无法解析时返回 null */
export function parseNumberToken(token: string): number | null {
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  return parseChineseNumeral(token);
}
