import React from 'react';

export const StatusCard: React.FC = () => {
  return (
    <div className="flex justify-center items-center min-h-screen bg-[#EFECE6] p-4">
      {/* 外层大面板：宣纸白底 + 青玉仙家玉简边框 + 细圆角与阴影 */}
      <div className="w-[420px] bg-paper border-2 border-jade rounded-md shadow-lg p-4 font-serif text-textMain select-none">
        
        {/* 1. 顶部标题条：青玉底色 + 白字加粗 */}
        <div className="bg-jade text-white text-center py-1.5 rounded-sm font-bold tracking-widest text-lg shadow-sm">
          \;\; 状态卡 · 入道三年 · 五月 \;\;
        </div>

        {/* 2. 鎏金分隔线 */}
        <div className="my-2.5 border-b border-gold opacity-80" />

        {/* 3. 基础身份与境界 */}
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between items-center">
            <span>道号 <strong className="text-textDark">清微</strong> · 男 · 21 岁</span>
            <span className="text-xs text-textSub">寿元 
              <span className="inline-block w-12 h-2.5 bg-lifespan mx-1 rounded-sm align-middle"></span>
              <span className="inline-block w-4 h-2.5 bg-progressBg rounded-sm align-middle"></span>
              <span className="ml-1 text-textMain font-semibold">79/100</span>
            </span>
          </div>

          <div className="flex justify-between">
            <span>境界 <strong className="text-textDark">炼气 · 中期</strong></span>
            <span className="text-textSub">宗门 <span className="text-jade font-medium">青云宗 · 外门</span></span>
          </div>

          {/* 六维属性 */}
          <div className="bg-[#F4EFE6] p-2 rounded text-xs text-textSub grid grid-cols-3 gap-1 border border-[#E5E0D5]">
            <span>资质: <strong className="text-textMain">12</strong></span>
            <span>悟性: <strong className="text-textMain">13</strong></span>
            <span>神识: <strong className="text-textMain">10</strong></span>
            <span>遁速: <strong className="text-textMain">9</strong></span>
            <span>道心: <strong className="text-textMain">14</strong></span>
            <span>仙缘: <strong className="text-textMain">11</strong></span>
          </div>

          {/* 仙姿与灵根（五行色块特色） */}
          <div className="flex items-center justify-between pt-1">
            <span>仙姿: <span className="text-blood font-semibold">出众</span></span>
            <div className="flex items-center space-x-1">
              <span className="text-xs text-textSub mr-1">灵根:</span>
              <span className="px-1.5 py-0.5 bg-wood text-white text-xs rounded font-bold">木</span>
              <span className="px-1.5 py-0.5 bg-blood text-white text-xs rounded font-bold">火</span>
            </div>
          </div>
        </div>

        {/* 4. 核心三条进度槽 (气血 / 灵力 / 修为) */}
        <div className="my-3 space-y-2 text-xs">
          {/* 气血条 */}
          <div className="flex items-center justify-between">
            <span className="w-10 text-textSub">气血</span>
            <div className="flex-1 mx-2 h-2.5 bg-progressBg rounded-full overflow-hidden flex">
              <div className="w-[70%] bg-blood h-full"></div>
              <div className="w-[30%] bg-progressBg h-full"></div>
            </div>
            <span className="font-mono text-textMain">76/100</span>
          </div>

          {/* 灵力条 */}
          <div className="flex items-center justify-between">
            <span className="w-10 text-textSub">灵力</span>
            <div className="flex-1 mx-2 h-2.5 bg-progressBg rounded-full overflow-hidden flex">
              <div className="w-[65%] bg-water h-full"></div>
              <div className="w-[35%] bg-progressBg h-full"></div>
            </div>
            <span className="font-mono text-textMain">67/100</span>
          </div>

          {/* 修为条 */}
          <div className="flex items-center justify-between">
            <span className="w-10 text-textSub">修为</span>
            <div className="flex-1 mx-2 h-2.5 bg-progressBg rounded-full overflow-hidden flex">
              <div className="w-[50%] bg-cultivation h-full"></div>
              <div className="w-[50%] bg-progressBg h-full"></div>
            </div>
            <span className="font-mono text-textMain">51/100</span>
          </div>
        </div>

        {/* 5. 资产与坐标底栏 */}
        <div className="bg-[#F4EFE6] p-2 rounded text-xs space-y-1 border border-[#E5E0D5]">
          <div className="flex justify-between">
            <span>灵石: <strong className="text-cultivation">480</strong></span>
            <span>功德: <strong className="text-wood">5</strong></span>
            <span>业力: <strong className="text-textSub">0</strong></span>
            <span>异常: <strong className="text-jade">无</strong></span>
          </div>
          <div className="text-[11px] text-textSub truncate">
            所在地: 青岳·青云宗 · 时节: 春
          </div>
          <div className="text-[11px] text-blood font-medium truncate">
            主线提示: 三年后升仙大会，夺魁可得筑基丹
          </div>
        </div>

        {/* 6. 鎏金分隔线 */}
        <div className="my-2.5 border-b border-gold opacity-80" />

        {/* 7. 底部指令行 */}
        <div className="text-[11px] text-textSub text-center leading-relaxed font-sans">
          指令：<span className="text-jade hover:underline cursor-pointer">面板</span> <span className="text-jade hover:underline cursor-pointer">修炼</span> <span className="text-jade hover:underline cursor-pointer">突破</span> <span className="text-jade hover:underline cursor-pointer">悟道</span> <span className="text-jade hover:underline cursor-pointer">洞府</span> <span className="text-jade hover:underline cursor-pointer">地图</span> <span className="text-jade hover:underline cursor-pointer">背包</span> <span className="text-jade hover:underline cursor-pointer">坊市</span> <span className="text-jade hover:underline cursor-pointer">宗门</span> <span className="text-jade hover:underline cursor-pointer">存档</span>
        </div>

      </div>
    </div>
  );
};