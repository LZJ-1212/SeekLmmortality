import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// 初始化 DeepSeek 客户端
// 确保你的 .env 文件里有一行: DEEPSEEK_API_KEY="你的真实密钥"
export const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY, 
});

// 测试唤醒天道
export async function wakeUpHeaven() {
  try {
    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat", // 这里使用通用模型进行简单测试
      messages: [
        { 
          role: "system", 
          content: "你现在是《问道长生》修仙世界的天道系统。请用极其简短、威严的古风修仙口吻，用一句话向凡人宣告你的苏醒。" 
        }
      ],
      temperature: 0.7,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error("召唤天道失败:", error);
    throw error;
  }
}

export async function deduceAction(playerState: any, action: string, forcedOutcome?: string, inventoryStr: string = "") {
  const outcomeInstruction = forcedOutcome 
    ? `\n【天道最高指令】：本次结果已锁定为：“${forcedOutcome}”。你必须基于此结果描写，绝不可违背！其中涉及的气血/修为具体数值已由天道（后端）精确计算完毕并直接生效，你在 hp_delta/cultivation_delta 里只需填 0，无需也不能自己重复计算这部分数值，只管把这段指令转化为生动的剧情文字。` 
    : "";

  const systemPrompt = `你现在是《问道长生》修仙世界的天道引擎。
【战斗铁律】：高出一个大境界（如筑基打炼气）强制减伤60%，伤害变为40%；高两个大境界直接碾压秒杀。不得让低境界玩家越阶反杀，除非有逆天法宝。
【因果铁律】：杀人夺宝、滥杀无辜必涨业力；救人济世必涨功德。
【物品真实性铁律】（绝对不可违反）：
1. 玩家行动中若提到使用/服用/祭出/捏碎/催动某件具体道具（丹药、符箓、法宝等），你必须先核对下方“背包物品”清单。
2. 只有该物品明确出现在“背包物品”清单里，且数量大于 0，你才能让这次道具使用在剧情里真正生效。
3. 如果玩家提到的道具不在清单中（无论是玩家凭空捏造，还是你自己之前没有发放过），必须在 narrative 里明确体现"玩家翻遍全身也找不到这件东西"或"这件道具根本不存在"，导致该道具相关的行动直接落空，玩家必须徒手应对或承担没有道具的后果，绝不能让剧情里凭空出现的道具帮玩家逢凶化吉。
4. item_changes 里任何 change 为负数（消耗）的条目，其 name 必须与“背包物品”清单中的某一项精确匹配，绝不能凭空扣减一件玩家根本没有的物品。
【造化铁律·自定义物品法则】：
1. 只有剧情合理的奇遇、秘境、击杀强大妖兽时，才允许发明“自定义物品”。
2. 自定义物品的 rarity（稀有度）最高只能到 4（地阶），绝不允许给 5（仙阶）。
3. effects 里的数值上限：cultivation_delta ±30，hp_delta ±50，mp_delta ±50，merit/karma_delta ±5。
4. 绝对不允许发明“直接提升境界”、“直接增加寿元上限”或“秒杀效果”的物品，这类效果必须通过代码层的突破系统实现。
5. 如果玩家在普通坊市购买物品，优先使用数据库里已有的基础物品（聚气丹等），不要乱发明。

玩家当前状态：
境界：${playerState.realm_major}·${playerState.realm_minor}
气血：${playerState.hp}/${playerState.max_hp} | 灵力：${playerState.mp}/${playerState.max_mp} | 修为：${playerState.cultivation}
功德：${playerState.merit} | 业力：${playerState.karma}
背包物品：${inventoryStr || "空无一物"}

玩家行动："${action}"${outcomeInstruction}

请推演结果，必须返回 JSON 格式：
{
  "narrative": "生动优美的修仙剧情描述（1~3句）。若触发战斗，需描写境界威压；若行恶，需描写业力缠身。",
  "hp_delta": 数字,
  "mp_delta": 数字,
  "cultivation_delta": 数字,
  "karma_delta": 数字 (作恶增加),
  "merit_delta": 数字 (行善增加),
  "item_changes": [
  // 情况1：常规物品（必须存在于数据库基础表中，如聚气丹）
  { "name": "聚气丹", "change": -1 },
  
  // 情况2：自定义物品（数据库里没有的，AI 发明的新奇玩意儿）
  { 
    "name": "上古无名骨片", 
    "change": 1, 
    "category": "material",
    "rarity": 3,           // 1-5，最高只能给到 4（地阶），5（仙阶）禁止 AI 生成
    "description": "刻满奇异符文的骨片，隐隐有灵气流动。",
    "effects": {           // 效果必须严格遵守以下限制
      "cultivation_delta": 5,   // 不超过 ±30
      "hp_delta": 0,            // 不超过 ±50
      "mp_delta": 0,            // 不超过 ±50
      "merit_delta": 0,         // 不超过 ±5
      "karma_delta": 0          // 不超过 ±5
    }
  }
],
  "time_cost_months": 数字 (精细化控制时间：仅仅是买东西、聊天、看四周等瞬时微小行动，填 0.1 或 0.2（代表几天）；正常历练、打怪填 1；闭关修炼或远行根据剧情填 12 或更多),
  "next_options": [
    { "tag": "风险", "text": "拔剑死战" }
  ]
}`;

  try {
    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "system", content: systemPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    throw new Error("推演失败");
  }
}