import React from 'react';

// 定义接收的数据结构
interface Props {
  player: any;
}

export const StatusCard: React.FC<Props> = ({ player }) => {
  // 提取灵根数组用于渲染色块
  const roots = player.spiritual_roots.elements || [];
  const elementColors: Record<string, string> = { '金':'bg-gold', '木':'bg-wood', '水':'bg-water', '火':'bg-blood', '土':'bg-[#B08A4E]', '雷':'bg-thunder', '风':'bg-[#7F9C9C]', '冰':'bg-sect' };

  return (
    <div className="w-[420px] bg-paper border-2 border-jade rounded-md shadow-lg p-4 font-serif text-textMain select-none flex-shrink-0 h-fit">
      
      <div className="bg-jade text-white text-center py-1.5 rounded-sm font-bold tracking-widest text-lg shadow-sm">
        状态卡 · 初始
      </div>
      <div className="my-2.5 border-b border-gold opacity-80" />

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between items-center">
          {/* 动态渲染姓名、性别、年龄 */}
          <span>道号 <strong className="text-textDark">{player.name}</strong> · {player.gender} · {player.age} 岁</span>
          <span className="text-xs text-textSub">寿元 
            <span className="ml-1 text-textMain font-semibold">{player.age}/{player.max_lifespan}</span>
          </span>
        </div>

        <div className="flex justify-between">
          {/* 动态渲染境界 */}
          <span>境界 <strong className="text-textDark">{player.realm_major} · {player.realm_minor}</strong></span>
          <span className="text-textSub">宗门 <span className="text-jade font-medium">散修</span></span>
        </div>

        {/* 动态渲染六维属性 */}
        <div className="bg-[#F4EFE6] p-2 rounded text-xs text-textSub grid grid-cols-3 gap-1 border border-[#E5E0D5]">
          <span>资质: <strong className="text-textMain">{player.aptitude}</strong></span>
          <span>悟性: <strong className="text-textMain">{player.comprehension}</strong></span>
          <span>神识: <strong className="text-textMain">{player.divine_sense}</strong></span>
          <span>遁速: <strong className="text-textMain">{player.speed}</strong></span>
          <span>道心: <strong className="text-textMain">{player.dao_heart}</strong></span>
          <span>仙缘: <strong className="text-textMain">{player.fortune}</strong></span>
        </div>

        {/* 动态渲染灵根 */}
        <div className="flex items-center justify-between pt-1">
          <span>灵根品质: <span className="font-semibold text-textDark">{player.spiritual_roots.quality}</span></span>
          <div className="flex items-center space-x-1">
            {roots.map((r: string) => (
              <span key={r} className={`px-1.5 py-0.5 text-white text-xs rounded font-bold ${elementColors[r] || 'bg-gray-500'}`}>{r}</span>
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
      </div>
    </div>
  );
};