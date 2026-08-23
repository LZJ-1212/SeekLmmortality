-- ==========================================
-- 问道长生 (Cultivation Simulator) 初始化脚本
-- Author: VincentDevHK
-- ==========================================

-- 1. 创建并使用数据库 (支持完整的中文字符集)
CREATE DATABASE IF NOT EXISTS wendaocs DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wendaocs;

-- ==========================================
-- 2. 系统核心表结构
-- ==========================================

-- 存档表 (Saves) 
-- 统筹多存档槽位，并记录是否已加入轮回池
CREATE TABLE IF NOT EXISTS saves (
    id VARCHAR(36) PRIMARY KEY,              -- 存档唯一ID (UUID)
    save_slot INT NOT NULL,                  -- 槽位号 (1, 2, 3...)
    save_name VARCHAR(50) NOT NULL,          -- 存档自定名称 (如：第一世·青云剑修)
    play_time_seconds INT DEFAULT 0,         -- 游玩总时长
    is_game_over BOOLEAN DEFAULT FALSE,      -- 是否已死亡/通关
    in_samsara_pool BOOLEAN DEFAULT FALSE,   -- 【轮回判定】死亡后是否被玩家选择加入轮回池
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 玩家核心状态表 (Players)
-- 与存档一对一绑定，承载所有硬核数值
CREATE TABLE IF NOT EXISTS players (
    id VARCHAR(36) PRIMARY KEY,
    save_id VARCHAR(36) NOT NULL UNIQUE,     -- 关联 saves 表
    
    -- 基础信息
    name VARCHAR(50) NOT NULL,               
    dao_name VARCHAR(50),                    
    gender VARCHAR(20) DEFAULT '男',         
    
    -- 岁月与境界 (回合制推进核心)
    age INT DEFAULT 16,                      
    max_lifespan INT DEFAULT 100,            
    realm_major VARCHAR(20) NOT NULL,        -- 大境界 (如：炼气)
    realm_minor VARCHAR(20) NOT NULL,        -- 小境界 (如：初期)
    sect_id VARCHAR(50),                     -- 宗门 (可记录为字符串或关联另表)
    
    -- 六维属性
    aptitude INT DEFAULT 10,                 -- 资质
    comprehension INT DEFAULT 10,            -- 悟性
    divine_sense INT DEFAULT 10,             -- 神识
    speed INT DEFAULT 10,                    -- 遁速
    dao_heart INT DEFAULT 10,                -- 道心
    fortune INT DEFAULT 10,                  -- 仙缘
    appearance INT DEFAULT 3,                -- 仙姿 (1-5)
    
    -- 资源池
    hp INT DEFAULT 100,                      
    max_hp INT DEFAULT 100,                  
    mp INT DEFAULT 100,                      
    max_mp INT DEFAULT 100,                  
    cultivation INT DEFAULT 0,               -- 修为进度
    spirit_stones INT DEFAULT 0,             -- 灵石
    merit INT DEFAULT 0,                     -- 功德
    karma INT DEFAULT 0,                     -- 业力
    
    -- 动态结构 (JSON 类型，极度契合 Node.js)
    spiritual_roots JSON NOT NULL,           -- 灵根权重 (如: {"wood":80, "fire":20})
    talents JSON,                            -- 先天天赋数组
    status_effects JSON,                     -- 异常状态与受伤情况
    
    current_location VARCHAR(50),            -- 当前地图位置
    
    FOREIGN KEY (save_id) REFERENCES saves(id) ON DELETE CASCADE
);

-- 世界状态表 (World State)
-- 记录游戏内的时间流逝和已触发的主线/机缘，保证剧情连贯
CREATE TABLE IF NOT EXISTS world_state (
    save_id VARCHAR(36) PRIMARY KEY,
    current_year INT DEFAULT 387,            -- 初始天玄历
    current_season VARCHAR(10) DEFAULT '春', -- 当前时节
    global_events JSON,                      -- 记录已发生的世界大事件
    triggered_clues JSON,                    -- 记录玩家已触发的线索/因果
    
    FOREIGN KEY (save_id) REFERENCES saves(id) ON DELETE CASCADE
);

-- ==========================================
-- 3. 静态模板表 (不随存档变动)
-- ==========================================

-- 物品模板字典表 (Item Templates)
CREATE TABLE IF NOT EXISTS items_template (
    id VARCHAR(50) PRIMARY KEY,              -- 建议使用语义化ID, 如 'item_pill_zhuji'
    name VARCHAR(50) NOT NULL,               
    category VARCHAR(20) NOT NULL,           -- consumable/weapon/manual/material
    rarity INT DEFAULT 1,                    -- 品阶 1-5 (黄玄地天仙)
    description TEXT,                        
    attributes JSON,                         -- 物品效果 {"hp_restore": 50, "base_damage": 120}
    base_price INT DEFAULT 10,               
    is_stackable BOOLEAN DEFAULT TRUE        
);

-- ==========================================
-- 4. 动态数据表 (随存档变动)
-- ==========================================

-- 玩家背包表 (Inventory)
CREATE TABLE IF NOT EXISTS player_inventory (
    id VARCHAR(36) PRIMARY KEY,
    save_id VARCHAR(36) NOT NULL,            -- 隔离不同存档的物品
    item_id VARCHAR(50) NOT NULL,            
    quantity INT DEFAULT 1,                  
    is_equipped BOOLEAN DEFAULT FALSE,       
    durability INT,                          
    
    FOREIGN KEY (save_id) REFERENCES saves(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items_template(id)
);

-- 人际与情缘表 (Relationships)
CREATE TABLE IF NOT EXISTS player_relationships (
    id VARCHAR(36) PRIMARY KEY,
    save_id VARCHAR(36) NOT NULL,            -- 隔离不同存档的NPC好感
    npc_name VARCHAR(50) NOT NULL,           
    affinity INT DEFAULT 0,                  -- 好感度 (-100 ~ 100)
    relation_type VARCHAR(20),               -- 关系类型 (道侣/死仇/师徒等)
    flags JSON,                              -- 特殊因果标记 {"has_given_token": true}
    
    FOREIGN KEY (save_id) REFERENCES saves(id) ON DELETE CASCADE
);