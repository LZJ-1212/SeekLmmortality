import React, { useState, useEffect } from 'react';
import { StatusCard } from './StatusCard';

export const MainGame: React.FC<{ playerId: string }> = ({ playerId }) => {
  const [inputText, setInputText] = useState('');
  const [playerData, setPlayerData] = useState<any>(null);

  // 初次降临，获取修士命格
  useEffect(() => {
    fetch(`http://localhost:3000/api/player/${playerId}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          // 解析后端的 JSON 字符串字段
          const parsedData = {
            ...data.data,
            spiritual_roots: JSON.parse(data.data.spiritual_roots),
            talents: JSON.parse(data.data.talents)
          };
          setPlayerData(parsedData);
        }
      });
  }, [playerId]);

  if (!playerData) return <div className="p-10 text-center font-serif">天道演算中，请稍候...</div>;

  return (
    <div className="flex h-screen bg-[#EFECE6] p-4 gap-4">
      {/* 将真实数据作为 prop 传给状态卡 */}
      <StatusCard player={playerData} />

      {/* 右侧：天道演化视窗 */}
      <div className="flex-1 flex flex-col bg-paper border-2 border-jade rounded-md shadow-lg font-serif overflow-hidden">
        
        {/* 顶部标题 */}
        <div className="bg-jade text-white px-4 py-2 font-bold tracking-widest text-lg shadow-sm flex justify-between">
          <span>九州大世界</span>
          <span className="text-sm font-normal opacity-80">天玄历 387 年 · 春</span>
        </div>

        {/* 中间：剧情文本流 (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-textMain leading-relaxed">
          <div className="text-center text-textSub text-sm mb-6">—— 仙路已开，凡尘录入 ——</div>
          
          <div className="bg-mysticBg border border-mystic p-3 rounded text-sm">
            <span className="font-bold text-mystic">【天道提示】</span> 你降生于青岳山下的凡人市镇，冥冥中似有仙缘牵引，指引你前往天机坊市。
          </div>
          
          <p>坊市中人声鼎沸，两旁摆满了散发着微弱灵光的草药与破旧玉简。你环顾四周，心中盘算着下一步的打算。</p>
        </div>

        {/* 底部：交互与指令区 */}
        <div className="bg-[#F4EFE6] border-t-2 border-gold border-opacity-50 p-4">
          {/* 快捷指令按钮 */}
          <div className="flex gap-2 mb-3">
            <button className="px-3 py-1 bg-jade text-white text-sm rounded shadow-sm hover:bg-[#5C8C6E]">〔平和〕闭关修炼</button>
            <button className="px-3 py-1 bg-mystic text-white text-sm rounded shadow-sm hover:bg-[#8B75B8]">〔机缘〕四处闲逛</button>
            <button className="px-3 py-1 bg-blood text-white text-sm rounded shadow-sm hover:bg-[#A84F45]">〔风险〕离开坊市</button>
          </div>

          {/* 自由输入框 */}
          <div className="flex gap-2">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="或者输入你想做的任何事 (例如：夜探藏经阁、在坊市摆摊)..." 
              className="flex-1 bg-white border border-[#E5E0D5] px-3 py-2 rounded outline-none focus:border-jade"
            />
            <button className="px-6 py-2 bg-textDark text-white font-bold rounded hover:bg-black transition-colors">
              行 动
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};