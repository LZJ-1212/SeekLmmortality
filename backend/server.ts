import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { wakeUpHeaven, deduceAction } from './ai';

// 加载 .env 环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 极简启动，无需适配器
const prisma = new PrismaClient();

// 中间件配置：允许跨域请求和解析 JSON
app.use(cors());
app.use(express.json());

// 天地法则：境界突破阈值与雷劫数据
const REALM_LAWS: Record<string, any> = {
  "炼气·初期": { next: "炼气·中期", reqCultivation: 100, isMajor: false },
  "炼气·中期": { next: "炼气·后期", reqCultivation: 200, isMajor: false },
  "炼气·后期": { next: "炼气·圆满", reqCultivation: 400, isMajor: false },
  "炼气·圆满": { 
    next: "筑基·初期", reqCultivation: 800, isMajor: true, 
    baseSuccess: 0.7, // 基础成功率 70%
    tribulationDamage: 60, // 雷劫基础伤害
    newLifespan: 200 // 筑基期寿元上限
  }
  // 未来可以在这里继续补全金丹、元婴等数据...
};

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
    
    // 新增：查询背包
    const inventory = await prisma.player_inventory.findMany({
      where: { save_id: player.save_id },
      include: { items_template: true }
    });

    // 格式化背包数据（包含自定义物品）
    const inventoryData = inventory.map(i => {
      if (i.items_template) {
        return {
          name: i.items_template.name,
          quantity: i.quantity,
          type: 'template'
        };
      } else {
        const custom = i.custom_data as any;
        return {
          name: i.custom_name || '未知',
          quantity: i.quantity,
          type: 'custom',
          rarity: custom?.rarity || 1,
          description: custom?.description || ''
        };
      }
    });
    
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
    const player = await prisma.players.findUnique({ where: { id: playerId } });
    if (!player) return res.status(404).json({ status: 'error', message: '修士不存在' });
    if (player.hp !== null && player.hp <= 0) return res.status(403).json({ status: 'error', message: '已身陨道消' });

    let forcedOutcome = "";
    
    // 【核心拦截器】：判定玩家是否试图突破
    if (action.includes("突破") || action.includes("破境") || action.includes("结丹")) {
      const currentRealmKey = `${player.realm_major}·${player.realm_minor}`;
      const realmLaw = REALM_LAWS[currentRealmKey];

      if (!realmLaw) {
        forcedOutcome = "玩家试图突破，但前方境界未明，无法突破。扣除少量灵力。";
      } else if ((player.cultivation || 0) < realmLaw.reqCultivation) {
        forcedOutcome = `玩家试图突破，但修为不足（需要${realmLaw.reqCultivation}）。强行冲关导致灵力反噬，受轻伤（气血-10），突破失败。`;
      } else {
        if (realmLaw.isMajor) {
          const roll = Math.random();
          const actualSuccessRate = realmLaw.baseSuccess + ((player.dao_heart || 10) * 0.01);
          
          if (roll <= actualSuccessRate) {
            forcedOutcome = `玩家成功抵御雷劫，突破至【${realmLaw.next}】！气血上限增加，伤势完全恢复，寿元大涨。`;
            player.realm_major = realmLaw.next.split('·')[0];
            player.realm_minor = realmLaw.next.split('·')[1];
            player.max_hp = (player.max_hp || 100) + 100;
            player.hp = player.max_hp; 
            player.max_lifespan = realmLaw.newLifespan;
            player.cultivation = 0; 
          } else {
            forcedOutcome = `玩家突破失败，被雷劫劈中！受重伤（气血-${realmLaw.tribulationDamage}），修为大跌（修为-100）。`;
          }
        } else {
          forcedOutcome = `玩家水到渠成，突破至小境界【${realmLaw.next}】。修为清零重修。`;
          player.realm_minor = realmLaw.next.split('·')[1];
          player.cultivation = 0;
        }
      }
    }

    // 查询背包（用于传递给 AI）
        const inventory = await prisma.player_inventory.findMany({
      where: { save_id: player.save_id }, 
      include: { items_template: true }
    });
    const inventoryStr = inventory
      .map(i => {
        if (i.items_template) {
          return `${i.items_template.name} x${i.quantity}`;
        } else {
          // 自定义物品
          const custom = i.custom_data as any;
          const name = i.custom_name || '未知物品';
          const rarity = custom?.rarity ? `(${custom.rarity}阶)` : '';
          return `${name}${rarity} x${i.quantity}`;
        }
      })
      .join('，');

    // 丢给 DeepSeek 进行推演
    const deduction = await deduceAction(player, action, forcedOutcome, inventoryStr);

    // 结算数值 
    const newHp = Math.max(0, Math.min(player.max_hp || 100, (player.hp || 100) + (deduction.hp_delta || 0)));
    const newMp = Math.max(0, Math.min(player.max_mp || 100, (player.mp || 100) + (deduction.mp_delta || 0)));
    const newCultivation = action.includes("突破") && forcedOutcome.includes("成功") ? 0 
                         : Math.max(0, (player.cultivation || 0) + (deduction.cultivation_delta || 0));
    
    const monthsPassed = deduction.time_cost_months || 1;
    const addedAge = monthsPassed >= 12 ? Math.floor(monthsPassed / 12) : 0;

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
          age: (player.age || 16) + addedAge,
          realm_major: player.realm_major,
          realm_minor: player.realm_minor,
          max_hp: player.max_hp,
          max_lifespan: player.max_lifespan,
          merit: Math.max(0, (player.merit || 0) + (deduction.merit_delta || 0)),
          karma: Math.max(0, (player.karma || 0) + (deduction.karma_delta || 0)),
        }
      })
    );

    // ==================== 处理背包物品变更（含自定义物品熔断） ====================
    const itemChanges = deduction.item_changes || [];
    
    if (itemChanges.length > 0) {
      // 1. 先分离出“常规物品”和“自定义物品”
      const regularItemNames = itemChanges
        .filter((ic: any) => !ic.effects) // 没有 effects 字段的视为常规
        .map((ic: any) => ic.name);
      
      // 2. 查询常规物品的模板
      const templates = await prisma.items_template.findMany({
        where: { name: { in: regularItemNames } }
      });

       // 【重要】构建模板映射
      const templateMap = Object.fromEntries(
        templates.map(t => [t.name, t])
      );

      // 3. 遍历处理每一个变更
      for (const change of itemChanges) {
        const changeAmount = change.change || 0;
        if (changeAmount === 0) continue;

        // --- 分支 A：常规物品（数据库里有） ---
        const template = templateMap[change.name];
        if (template) {
          const existing = await prisma.player_inventory.findFirst({
            where: { save_id: player.save_id!, item_id: template.id }
          });
          
          if (changeAmount > 0) {
            if (existing) {
              transactionOps.push(
                prisma.player_inventory.update({
                  where: { id: existing.id },
                  data: { quantity: { increment: changeAmount } }
                })
              );
            } else {
              transactionOps.push(
                prisma.player_inventory.create({
                  data: {
                    id: crypto.randomUUID(),
                    save_id: player.save_id!,
                    item_id: template.id,
                    quantity: changeAmount,
                    is_equipped: false
                  }
                })
              );
            }
          } else {
            // 消耗逻辑（不变）
            if (!existing) continue;
            const newQty = (existing.quantity || 0) + changeAmount;
            if (newQty < 0) throw new Error(`物品 "${change.name}" 数量不足`);
            if (newQty === 0) {
              transactionOps.push(prisma.player_inventory.delete({ where: { id: existing.id } }));
            } else {
              transactionOps.push(
                prisma.player_inventory.update({
                  where: { id: existing.id },
                  data: { quantity: newQty }
                })
              );
            }
          }
          continue;
        }

        // --- 分支 B：自定义物品（数据库里没有的） ---
        // 验证稀有度：最高 4（地阶）
        const rarity = change.rarity || 1;
        if (rarity > 4) {
          console.warn(`⚠️ 自定义物品 "${change.name}" 稀有度 ${rarity} 超出上限(4)，已降级为地阶`);
        }

        // 验证效果数值（防作弊熔断）
        const effects = change.effects || {};
        const boundedEffects: any = {};
        
        // 硬上限阈值
        const MAX_CULTIVATION_DELTA = 30;
        const MAX_HP_DELTA = 50;
        const MAX_MP_DELTA = 50;
        const MAX_MERIT_DELTA = 5;
        const MAX_KARMA_DELTA = 5;

        if (effects.cultivation_delta) {
          boundedEffects.cultivation_delta = Math.max(-MAX_CULTIVATION_DELTA, Math.min(MAX_CULTIVATION_DELTA, effects.cultivation_delta));
        }
        if (effects.hp_delta) {
          boundedEffects.hp_delta = Math.max(-MAX_HP_DELTA, Math.min(MAX_HP_DELTA, effects.hp_delta));
        }
        if (effects.mp_delta) {
          boundedEffects.mp_delta = Math.max(-MAX_MP_DELTA, Math.min(MAX_MP_DELTA, effects.mp_delta));
        }
        if (effects.merit_delta) {
          boundedEffects.merit_delta = Math.max(-MAX_MERIT_DELTA, Math.min(MAX_MERIT_DELTA, effects.merit_delta));
        }
        if (effects.karma_delta) {
          boundedEffects.karma_delta = Math.max(-MAX_KARMA_DELTA, Math.min(MAX_KARMA_DELTA, effects.karma_delta));
        }

        // 如果效果全部为 0 且无特殊描述，仍可生成，但视为“凡品”
        const customData = {
          name: change.name,
          category: change.category || "misc",
          rarity: Math.min(rarity, 4),
          description: change.description || "一件来历不明的物品。",
          effects: boundedEffects
        };

        // 写入数据库（关联 item_id = null，只存 custom 数据）
        transactionOps.push(
          prisma.player_inventory.create({
            data: {
              id: crypto.randomUUID(),
              save_id: player.save_id!,
              item_id: null,
              custom_name: change.name,
              custom_data: customData,
              quantity: changeAmount > 0 ? changeAmount : 1, // 自定义物品只支持获得（不给消耗）
              is_equipped: false
            }
          })
        );
      }
    }

    // 执行统一事务
    const [updatedPlayer] = await prisma.$transaction(transactionOps);

    res.json({
      status: 'success',
      data: {
        narrative: deduction.narrative,
        options: deduction.next_options,
        monthsPassed: monthsPassed,
        isDead: newHp === 0,
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