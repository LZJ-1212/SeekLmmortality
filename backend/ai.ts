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