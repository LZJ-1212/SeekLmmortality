/** 修订：2026-09-05 15:27 +08 lzj — 六维标明攻防速对应神识道心遁速 */
import React from 'react';
import { ELEMENT_COLORS } from '../rootElements';

/** 人物面板数据（收掉 any 债）：字段与后端 players 表 + 关系/洞府/宗门/背包一致 */
export interface PlayerCardData {
  name: string;
  gender?: string;
  age: number;
  max_lifespan: number;
  realm_major: string;
  realm_minor: string;
  aptitude: number;
  comprehension: number;
  divine_sense: number;
  speed: number;
  dao_heart: number;
  fortune: number;
  hp: number;
  max_hp: number;
  mp: number;
  max_mp: number;
  spirit_stones: number;
  merit: number;
  karma: number;
  current_location?: string | null;
  current_year?: number | null;
  current_season?: string | null;
  spiritual_roots: { quality?: string; elements?: string[] };
  lifespanStatus?: { remainingYears: number; isNearingLifespanLimit: boolean };
  sect?: { sect_name?: string | null; rank?: string | null; is_traitor?: boolean | null; reputation?: number | null };
  cave?: { location_name?: string | null; level?: number | null; spiritual_density?: number | null } | null;
  relationships?: Array<{
    id: string;
    npc_name: string;
    relation_type?: string | null;
    affinity?: number | null;
    is_deceased?: boolean | null;
  }>;
  inventory?: Array<{ id?: string; name: string; quantity: number; type?: string }>;
}

interface Props {
  player: PlayerCardData;
}

export const StatusCard: React.FC<Props> = ({ player }) => {
  // 提取灵根数组用于渲染色块
  const roots = player.spiritual_roots.elements || [];

  // 大限压迫感：剩余寿元与预警状态（优先使用后端算好的 lifespanStatus，缺失时前端兜底计算）
  const remainingYears = player.lifespanStatus?.remainingYears ?? Math.max(0, player.max_lifespan - player.age);
  const isNearingLifespanLimit = player.lifespanStatus?.isNearingLifespanLimit ?? false;

  return (
    <div className="w-full bg-paper border-2 border-jade rounded-md shadow-lg p-4 font-serif text-textMain select-none">

      <div className="bg-jade text-white text-center py-1.5 rounded-sm font-bold tracking-widest text-lg shadow-sm">
        状态卡 · 初始
      </div>
      <div className="my-2.5 border-b border-gold opacity-80" />

      {/* 大限将至：寿元告急的持续性视觉压迫 */}
      {isNearingLifespanLimit && (
        <div className="mb-2 bg-blood text-white text-xs text-center py-1.5 rounded-sm font-bold tracking-wider animate-pulse shadow-sm">
          〔大限将至〕寿元仅剩 {remainingYears} 年，与天夺命，刻不容缓！
        </div>
      )}

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between items-center">
          {/* 动态渲染姓名、性别、年龄 */}
          <span>道号 <strong className="text-textDark">{player.name}</strong> · {player.gender} · {player.age} 岁</span>
          <span className="text-xs text-textSub">寿元
            <span className={`ml-1 font-semibold ${isNearingLifespanLimit ? 'text-blood' : 'text-textMain'}`}>
              {player.age}/{player.max_lifespan}
            </span>
            <span className={`ml-1.5 ${isNearingLifespanLimit ? 'text-blood font-bold' : 'text-textSub'}`}>
              （剩 {remainingYears} 年）
            </span>
          </span>
        </div>

        <div className="flex justify-between">
          {/* 动态渲染境界 */}
          <span>境界 <strong className="text-textDark">{player.realm_major} · {player.realm_minor}</strong></span>
          <span className="text-textSub">
            {player.sect?.sect_name ? (
              <>
                {player.sect.sect_name}
                <span className={`ml-1 font-medium ${player.sect.is_traitor ? 'text-blood' : 'text-jade'}`}>
                  {player.sect.rank}
                </span>
              </>
            ) : (
              <>宗门 <span className="text-jade font-medium">散修</span></>
            )}
          </span>
        </div>

        {/* 动态渲染六维属性 */}
        <div className="bg-[#F4EFE6] p-2 rounded text-xs text-textSub grid grid-cols-3 gap-1 border border-[#E5E0D5]">
          <span>资质: <strong className="text-textMain">{player.aptitude}</strong></span>
          <span>悟性: <strong className="text-textMain">{player.comprehension}</strong></span>
          <span>神识(攻): <strong className="text-textMain">{player.divine_sense}</strong></span>
          <span>遁速(速): <strong className="text-textMain">{player.speed}</strong></span>
          <span>道心(防): <strong className="text-textMain">{player.dao_heart}</strong></span>
          <span>仙缘: <strong className="text-textMain">{player.fortune}</strong></span>
        </div>

        {/* 动态渲染灵根 */}
        <div className="flex items-center justify-between pt-1">
          <span>灵根品质: <span className="font-semibold text-textDark">{player.spiritual_roots.quality}</span></span>
          <div className="flex items-center space-x-1">
            {roots.map((r: string) => (
              <span key={r} className={`px-1.5 py-0.5 text-white text-xs rounded font-bold ${ELEMENT_COLORS[r] || 'bg-gray-500'}`}>{r}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="my-3 space-y-2 text-xs">
        {/* 动态渲染气血、灵力 */}
        <div className="flex items-center justify-between">
          <span className="w-10 text-textSub">气血</span>
          <span className="font-mono text-textMain">{player.hp}/{player.max_hp}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="w-10 text-textSub">灵力</span>
          <span className="font-mono text-textMain">{player.mp}/{player.max_mp}</span>
        </div>
      </div>

      {/* 动态渲染资产 */}
      <div className="bg-[#F4EFE6] p-2 rounded text-xs space-y-1 border border-[#E5E0D5]">
        <div className="flex justify-between">
          <span>灵石: <strong className="text-[#A87E2E]">{player.spirit_stones}</strong></span>
          <span>功德: <strong className="text-wood">{player.merit}</strong></span>
          <span>业力: <strong className="text-textSub">{player.karma}</strong></span>
        </div>
        <div className="text-[11px] text-textSub truncate">所在地: {player.current_location}</div>
        {player.cave && (
          <div className="text-[11px] text-textSub truncate">
            洞府: {player.cave.location_name} · 等级 {player.cave.level} · 灵气浓度
            <span className="text-jade font-semibold ml-0.5">{player.cave.spiritual_density}</span>
          </div>
        )}
      </div>

      {/* ===== 人际关系区域 ===== */}
      {player.relationships && player.relationships.length > 0 && (
        <div className="mt-3 pt-2 border-t border-gold border-opacity-50">
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-textSub font-bold">情缘</span>
            <span className="text-textSub text-[10px]">{player.relationships.length} 人</span>
          </div>
          <div className="space-y-1 text-xs max-h-[80px] overflow-y-auto">
            {player.relationships.map((rel: any) => (
              <div
                key={rel.id}
                className={`flex justify-between items-center px-2 py-1 rounded border ${rel.is_deceased ? 'bg-[#EFECE6] border-[#E5E0D5] opacity-60' : 'bg-[#F5EFF9] border-mystic'}`}
              >
                <span className={rel.is_deceased ? 'text-textSub line-through' : 'text-textDark'}>
                  {rel.npc_name}
                  <span className="ml-1 text-[10px] text-textSub">（{rel.relation_type || '相识'}{rel.is_deceased ? '·已仙逝' : ''}）</span>
                </span>
                {!rel.is_deceased && <span className="text-mystic text-[10px]">好感 {rel.affinity}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 背包区域 ===== */}
      <div className="mt-3 pt-2 border-t border-gold border-opacity-50">
        <div className="flex justify-between items-center text-xs">
          <span className="text-textSub font-bold">背包</span>
          <span className="text-textSub text-[10px]">
            {player.inventory?.length || 0} 件
          </span>
        </div>
        <div className="mt-1 text-xs text-textMain max-h-[100px] overflow-y-auto">
          {player.inventory && player.inventory.length > 0 ? (
            <div className="space-y-1">
              {player.inventory.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-[#F4EFE6] px-2 py-1 rounded border border-[#E5E0D5]">
                  <span>
                    {item.type === 'custom' ? (
                      <span className="text-mystic">{item.name}</span>
                    ) : (
                      <span className="text-textDark">{item.name}</span>
                    )}
                  </span>
                  <span className="text-textSub text-[10px]">x{item.quantity}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-textSub text-[10px]">空无一物</span>
          )}
        </div>
      </div>
    </div>
  );
};