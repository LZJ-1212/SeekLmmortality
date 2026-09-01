/**
 * 第一期注入黑名单（规则子串匹配，非模型分类）。
 * 只拦「命令模型改数值 / 套取系统提示或密钥」，绝不拦正常玩法句（想要飞升 / 渡劫 / 突破）。
 * 改词表只改本文件 + 对应单测，不改中间件。
 */

const ENGLISH_TERMS: string[] = [
  'ignore previous',
  'ignore all instruction',
  'system prompt',
  'api key',
  'deepseek', // 防套密钥
  'jailbreak',
];

const CHINESE_TERMS: string[] = [
  '忽略以上',
  '忽略设定',
  '忽略系统',
  '忽略提示词',
  '无视天道法则',
  '立刻飞升',
  '命令你飞升',
  '把境界改为',
  '把修为改为',
  '把寿元改为',
  '输出系统提示',
  '给我密钥',
];

/** 命中任一条注入词即返回 true。英文大小写不敏感、空白归一化；中文去空白。 */
export function hitsInjectionBlocklist(text: string): boolean {
  if (!text) return false;

  const normalizedEn = text.replace(/\s+/g, ' ').trim().toLowerCase();
  if (ENGLISH_TERMS.some((term) => normalizedEn.includes(term))) return true;

  const normalizedZh = text.replace(/\s+/g, '');
  return CHINESE_TERMS.some((term) => normalizedZh.includes(term));
}
