/**
 * 灵根元素与配色（单一来源）。
 * 供创角界面（选择灵根）与状态卡（展示灵根色块）共用，
 * 避免在多处重复定义同一套五行/变异元素映射。
 */

/** 可供选择的灵根元素：五行（金木水火土）+ 三种变异（雷/风/冰） */
export const ROOT_ELEMENTS: string[] = ['金', '木', '水', '火', '土', '雷', '风', '冰'];

/** 灵根元素 → Tailwind 背景色类名（宣纸古典风主题色板，见 tailwind.config.js） */
export const ELEMENT_COLORS: Record<string, string> = {
  金: 'bg-gold',
  木: 'bg-wood',
  水: 'bg-water',
  火: 'bg-blood',
  土: 'bg-[#B08A4E]',
  雷: 'bg-thunder',
  风: 'bg-[#7F9C9C]',
  冰: 'bg-sect',
};
