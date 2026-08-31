import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { wakeUpHeaven, deduceAction } from './ai';
import { prisma } from './src/db/prisma';
import { InventoryService } from './src/services/inventory.service';
import inventoryRoutes from './src/routes/inventory.routes';
import {
  REALM_LAWS,
  resolveBreakthroughAttempt,
  clampResource,
  applyCultivationDelta,
  advanceAge,
  advanceWorldTime,
  getDeathReason,
} from './src/services/playerState.service';

// 加载 .env 环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 背包业务逻辑统一走 Service 层，路由/AI 结算代码不直接拼 Prisma 查询
const inventoryService = new InventoryService(prisma);

// 中间件配置：允许跨域请求和解析 JSON
app.use(cors());
app.use(express.json());

// 背包 CRUD 独立路由（增/删/改/查）
app.use('/api/inventory', inventoryRoutes);

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
    
    // 背包数据统一走 Service 层查询与格式化
    const inventoryData = await inventoryService.getInventory(player.save_id);

    res.json({
      status: 'success',
      data: {
        ...player,
        inventory: inventoryData
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: '天道探查失败' });
  }
});

// 天道推演：处理玩家行动
app.post('/api/action', async (req: Request, res: Response) => {
  try {
    const { playerId, action } = req.body;
    const player = await prisma.players.findUnique({
      where: { id: playerId },
      include: { saves: true },
    });
    if (!player) return res.status(404).json({ status: 'error', message: '修士不存在' });

    // 【死亡锁】：存档一旦被标记为终结（气血耗尽或寿元耗尽），无论如何都不允许再有任何行动
    const alreadyDead = player.saves?.is_game_over
      || getDeathReason(player.hp ?? 100, player.age ?? 16, player.max_lifespan ?? 100) !== null;
    if (alreadyDead) {
      return res.status(403).json({ status: 'error', message: '大限已至，道消身陨，万事皆休。' });
    }

    let forcedOutcome = "";

    // 【核心拦截器 1】：境界突破——所有数值变化由后端硬计算，不依赖 AI 自己填写 hp_delta/cultivation_delta
    const attemptingBreakthrough = action.includes("突破") || action.includes("破境") || action.includes("结丹");
    const breakthroughResult = attemptingBreakthrough
      ? resolveBreakthroughAttempt(
          {
            realmMajor: player.realm_major,
            realmMinor: player.realm_minor,
            cultivation: player.cultivation ?? 0,
            hp: player.hp ?? 100,
            maxHp: player.max_hp ?? 100,
            maxLifespan: player.max_lifespan ?? 100,
            daoHeart: player.dao_heart ?? 10,
          },
          REALM_LAWS,
        )
      : null;
    if (breakthroughResult) {
      forcedOutcome = breakthroughResult.forcedOutcomeText;
    }

    // 【核心拦截器 2】：物品真实性校验——防止 AI 凭空编造玩家使用了背包里没有的字典物品
    const fabricationWarning = await inventoryService.detectFabricatedItemUsage(player.save_id, action);
    if (fabricationWarning) {
      forcedOutcome = forcedOutcome ? `${forcedOutcome}\n${fabricationWarning}` : fabricationWarning;
    }

    // 查询背包（用于传递给 AI），统一走 Service 层
    const inventoryStr = await inventoryService.getInventoryPromptString(player.save_id);

    // 丢给 DeepSeek 进行推演（叙事 + 非关键数值，如 mp/功德/业力/物品变化）
    const deduction = await deduceAction(player, action, forcedOutcome, inventoryStr);

    // ==================== 核心状态机：气血/灵力/修为结算 ====================
    // 若本次触发了境界突破，气血与修为的最终值完全由 breakthroughResult 决定，
    // AI 返回的 hp_delta/cultivation_delta 一律忽略，避免关键数值被 AI 篡改或算错。
    const maxHp = breakthroughResult ? breakthroughResult.patch.maxHp : (player.max_hp ?? 100);
    const maxLifespan = breakthroughResult ? breakthroughResult.patch.maxLifespan : (player.max_lifespan ?? 100);
    const realmMajor = breakthroughResult ? breakthroughResult.patch.realmMajor : player.realm_major;
    const realmMinor = breakthroughResult ? breakthroughResult.patch.realmMinor : player.realm_minor;

    const newHp = breakthroughResult
      ? breakthroughResult.patch.hp
      : clampResource(player.hp ?? 100, deduction.hp_delta || 0, maxHp);
    const newMp = clampResource(player.mp ?? 100, deduction.mp_delta || 0, player.max_mp ?? 100);
    const newCultivation = breakthroughResult
      ? breakthroughResult.patch.cultivation
      : applyCultivationDelta(player.cultivation ?? 0, deduction.cultivation_delta || 0);

    // ==================== 核心状态机：时间流逝（修复“角色永远不会变老”的 Bug） ====================
    const monthsPassed = deduction.time_cost_months || 1;
    const { newAge, newPendingMonths } = advanceAge(player.age ?? 16, player.pending_months ?? 0, monthsPassed);

    // ==================== 核心状态机：死亡判定（新增寿元耗尽判定） ====================
    const deathReason = getDeathReason(newHp, newAge, maxLifespan);
    const isDeadNow = deathReason !== null;

    // ==================== 构建统一事务 ====================
    const transactionOps: any[] = [];

    // 1. 玩家属性更新
    transactionOps.push(
      prisma.players.update({
        where: { id: playerId },
        data: {
          hp: newHp,
          mp: newMp,
          cultivation: newCultivation,
          age: newAge,
          pending_months: newPendingMonths,
          realm_major: realmMajor,
          realm_minor: realmMinor,
          max_hp: maxHp,
          max_lifespan: maxLifespan,
          merit: Math.max(0, (player.merit || 0) + (deduction.merit_delta || 0)),
          karma: Math.max(0, (player.karma || 0) + (deduction.karma_delta || 0)),
        }
      })
    );

    // 2. 世界时间推进（年份/季节随月份流逝同步更新）
    const worldState = await prisma.world_state.findUnique({ where: { save_id: player.save_id } });
    if (worldState) {
      const { newYear, newSeason, newPendingMonths: newWorldPendingMonths } = advanceWorldTime(
        worldState.current_year ?? 387,
        worldState.current_season ?? '春',
        worldState.pending_months ?? 0,
        monthsPassed,
      );
      transactionOps.push(
        prisma.world_state.update({
          where: { save_id: player.save_id },
          data: { current_year: newYear, current_season: newSeason, pending_months: newWorldPendingMonths },
        })
      );
    }

    // 3. 死亡结算：一旦判定死亡，永久锁死该存档
    if (isDeadNow) {
      transactionOps.push(
        prisma.saves.update({ where: { id: player.save_id }, data: { is_game_over: true } })
      );
    }

    // ==================== 处理背包物品变更（含自定义物品熔断） ====================
    // 物品增删逻辑统一走 Service 层（内部自带事务），必须先于玩家属性事务执行：
    // 一旦物品变更失败（如库存不足），直接抛出异常，玩家属性事务不会被执行。
    const itemChanges = deduction.item_changes || [];
    await inventoryService.applyItemChanges(player.save_id, itemChanges);

    // 执行玩家属性更新事务
    const [updatedPlayer] = await prisma.$transaction(transactionOps);

    res.json({
      status: 'success',
      data: {
        narrative: deduction.narrative,
        options: deduction.next_options,
        monthsPassed: monthsPassed,
        isDead: isDeadNow,
        deathReason: deathReason,
        player: updatedPlayer
      }
    });

  } catch (error) {
    console.error("Action接口报错:", error);
    res.status(500).json({ status: 'error', message: '天机反噬，推演失败。' });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`天道服务器已启动，正监听端口: ${PORT}`);
});