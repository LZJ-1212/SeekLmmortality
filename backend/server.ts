import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { wakeUpHeaven } from './ai';
import crypto from 'crypto';

// 加载 .env 环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 极简启动，无需适配器
const prisma = new PrismaClient();

// 中间件配置：允许跨域请求和解析 JSON
app.use(cors());
app.use(express.json());

// 测试路由：探查天地灵气（数据库连接测试）
app.get('/api/ping', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'success', 
      message: '天地之桥已打通！天道系统（数据库）连接成功。' 
    });
  } catch (error) {
    console.error('数据库连接失败:', error);
    res.status(500).json({ 
      status: 'error', 
      message: '灵气涣散，数据库连接失败，请检查 XAMPP 是否开启。' 
    });
  }
});

// AI 灵魂测试路由
app.get('/api/ai-ping', async (req: Request, res: Response) => {
  try {
    const heavenlyVoice = await wakeUpHeaven();
    res.json({
      status: 'success',
      message: heavenlyVoice
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: '天道失联，请检查 .env 中的 DEEPSEEK_API_KEY 是否正确配置。'
    });
  }
});

// 创角系统：完全体降临
app.post('/api/create-player', async (req: Request, res: Response) => {
  try {
    // 接收完整的创角数据
    const { 
      name, gender, attributes, 
      roots,         // 灵根数组 (如 ['水', '木'])
      origin,        // 出身
      daoPursuit,    // 道途追求
      constitution,  // 先天体质
      talents        // 先天天赋数组
    } = req.body;

    const saveId = crypto.randomUUID();
    const playerId = crypto.randomUUID();

    // 组合灵根 JSON
    let rootQuality = "伪灵根";
    if (roots.length === 1) rootQuality = "天灵根";
    if (roots.length === 2) rootQuality = "地灵根";
    if (roots.length === 3) rootQuality = "真灵根";
    if (roots.length >= 4) rootQuality = "杂灵根";
    const spiritualRootsData = { quality: rootQuality, elements: roots };

    // 将出身、体质、道途、天赋统一打包进 talents JSON 字段
    const talentsData = {
      origin: origin,
      daoPursuit: daoPursuit,
      constitution: constitution,
      innateTalents: talents
    };

    await prisma.$transaction([
      prisma.saves.create({
        data: {
          id: saveId,
          save_slot: 1,
          save_name: `${name}的修仙录`,
        }
      }),
      prisma.world_state.create({
        data: {
          save_id: saveId,
          current_year: 387,
          current_season: "春",
        }
      }),
      prisma.players.create({
        data: {
          id: playerId,
          save_id: saveId,
          name: name || "无名氏",
          dao_name: "未定",
          gender: gender || "男",
          age: 16,
          max_lifespan: 100,
          realm_major: "炼气",
          realm_minor: "初期",
          hp: 100, max_hp: 100, mp: 100, max_mp: 100,
          aptitude: attributes?.aptitude || 10,
          comprehension: attributes?.comprehension || 10,
          divine_sense: attributes?.divine_sense || 10,
          speed: attributes?.speed || 10,
          dao_heart: attributes?.dao_heart || 10,
          fortune: attributes?.fortune || 10,
          appearance: 3,
          // 存入高度定制化的 JSON 数据
          spiritual_roots: JSON.stringify(spiritualRootsData),
          talents: JSON.stringify(talentsData),
          status_effects: JSON.stringify([]),
          current_location: "青岳·天机坊市"
        }
      })
    ]);

    res.json({
      status: 'success',
      message: `道音轰鸣！【${origin}】出身的【${rootQuality}】修士降生九州。`,
      data: {
        playerId: playerId,
        saveId: saveId
      }
    });

  } catch (error) {
    console.error("创角失败:", error);
    res.status(500).json({ status: 'error', message: '天机混乱，命格凝聚失败。' });
  }
});

// 天道探查：获取修士真实状态
app.get('/api/player/:id', async (req: Request, res: Response) => {
  try {
    const player = await prisma.players.findUnique({
      where: { id: req.params.id }
    });
    
    if (!player) {
      return res.status(404).json({ status: 'error', message: '查无此人，该修士恐已陨落。' });
    }
    
    res.json({ status: 'success', data: player });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '天道探查失败' });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`天道服务器已启动，正监听端口: ${PORT}`);
});