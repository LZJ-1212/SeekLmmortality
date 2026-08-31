import React, { useState, useEffect, useRef } from 'react';
import { StatusCard } from './StatusCard';

// 定义每条日志的格式
interface LogEntry {
  id: number;
  type: 'system' | 'player' | 'narrative';
  content: string;
}

export const MainGame: React.FC<{ playerId: string }> = ({ playerId }) => {
  const [inputText, setInputText] = useState('');
  const [playerData, setPlayerData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 初始默认的三个动态选项
  const [actionOptions, setActionOptions] = useState([
    { tag: '平和', text: '闭关修炼' },
    { tag: '机缘', text: '四处打听' },
    { tag: '风险', text: '出城历练' }
  ]);

  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, type: 'system', content: '—— 仙路已开，凡尘录入 ——' }
  ]);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // 初次加载数据
  useEffect(() => {
    fetch(`http://localhost:3000/api/player/${playerId}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          const parsedData = {
            ...data.data,  // 保留所有字段（包括 inventory）
            spiritual_roots: JSON.parse(data.data.spiritual_roots),
            talents: JSON.parse(data.data.talents)
          };
          setPlayerData(parsedData);
        }
      });
  }, [playerId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 判断是否死亡：气血耗尽 或 寿元耗尽（年龄超过寿元上限），二者任一成立即为陨落/坐化
  const isDead = playerData
    ? playerData.hp <= 0 || playerData.age > playerData.max_lifespan
    : false;

  const handleAction = async (actionDesc: string) => {
    if (!actionDesc.trim() || isProcessing || isDead) return;

    setLogs(prev => [...prev, { id: Date.now(), type: 'player', content: `> ${actionDesc}` }]);
    setInputText('');
    setIsProcessing(true);

    try {
      const response = await fetch('http://localhost:3000/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, action: actionDesc })
      });
      const result = await response.json();

      if (result.status === 'success') {
        // 渲染剧情与岁月流逝
        let finalNarrative = result.data.narrative;
        if (result.data.monthsPassed > 0) {
          finalNarrative += ` (流逝 ${result.data.monthsPassed} 个月)`;
        }

        setLogs(prev => [...prev, { id: Date.now() + 1, type: 'narrative', content: finalNarrative }]);

        // 如果死亡，追加天道提示（区分气血耗尽 / 寿元耗尽两种死因）
        if (result.data.isDead) {
          const deathMessage = result.data.deathReason === 'lifespan_exhausted'
            ? '【天道无情】 寿元耗尽，大限已至，你已坐化飞灰...'
            : '【天道无情】 气血耗尽，你已身陨道消...';
          setLogs(prev => [...prev, { id: Date.now() + 2, type: 'system', content: deathMessage }]);
        }

        // 更新动态按钮
        if (result.data.options && result.data.options.length > 0) {
          setActionOptions(result.data.options);
        }

        // ===== 方案 B：重新获取完整玩家数据（包含背包） =====
        const refreshResponse = await fetch(`http://localhost:3000/api/player/${playerId}`);
        const refreshData = await refreshResponse.json();

        if (refreshData.status === 'success') {
          const refreshedData = {
            ...refreshData.data,
            spiritual_roots: JSON.parse(refreshData.data.spiritual_roots),
            talents: JSON.parse(refreshData.data.talents)
          };
          setPlayerData(refreshedData);
        } else {
          // 如果刷新失败，降级使用 action 返回的数据（但会丢失 inventory）
          console.warn('刷新玩家数据失败，使用降级数据');
          setPlayerData({
            ...result.data.player,
            spiritual_roots: JSON.parse(result.data.player.spiritual_roots),
            talents: JSON.parse(result.data.player.talents)
          });
        }
        // ======================================================

      } else {
        setLogs(prev => [...prev, { id: Date.now() + 1, type: 'system', content: `【天道反噬】 ${result.message}` }]);
      }
    } catch (error) {
      setLogs(prev => [...prev, { id: Date.now() + 1, type: 'system', content: '【天机中断】 无法沟通天道引擎。' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 映射 Tag 对应的 Tailwind 颜色
  const getTagColor = (tag: string) => {
    switch (tag) {
      case '平和': return 'bg-jade hover:bg-[#5C8C6E]';
      case '风险': return 'bg-blood hover:bg-[#A84F45]';
      case '机缘': return 'bg-mystic hover:bg-[#8B75B8]';
      case '情缘': return 'bg-romance hover:bg-[#C27A90]';
      case '魔道': return 'bg-thunder hover:bg-[#725A8F]';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  if (!playerData) return <div className="p-10 text-center font-serif">天道演算中...</div>;

  return (
    <div className="flex h-screen bg-[#EFECE6] p-4 gap-4">
      <StatusCard player={playerData} />

      <div className="flex-1 flex flex-col bg-paper border-2 border-jade rounded-md shadow-lg font-serif overflow-hidden">

        <div className="bg-jade text-white px-4 py-2 font-bold tracking-widest text-lg shadow-sm flex justify-between">
          <span>九州大世界</span>
          <span className="text-sm font-normal opacity-80">{isDead ? '寂灭' : '天玄历'}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3 text-textMain leading-relaxed text-sm">
          {logs.map(log => (
            <div key={log.id} className={`
              ${log.type === 'system' ? 'text-center text-mystic font-bold bg-mysticBg p-2 rounded' : ''}
              ${log.type === 'player' ? 'text-textSub italic mt-4' : ''}
              ${log.type === 'narrative' ? 'text-textMain' : ''}
            `}>
              {log.content}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>

        <div className="bg-[#F4EFE6] border-t-2 border-gold border-opacity-50 p-4">
          {/* 动态按钮渲染区 */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {actionOptions.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleAction(opt.text)}
                disabled={isProcessing || isDead}
                className={`px-3 py-1 text-white text-sm rounded shadow-sm disabled:opacity-50 transition-colors ${getTagColor(opt.tag)}`}
              >
                〔{opt.tag}〕{opt.text}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAction(inputText)}
              disabled={isProcessing || isDead}
              placeholder={isDead ? "道死身灭，诸法皆空..." : (isProcessing ? "天道演算中..." : "输入行动...")}
              className="flex-1 bg-white border border-[#E5E0D5] px-3 py-2 rounded outline-none focus:border-jade disabled:bg-gray-200 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => handleAction(inputText)}
              disabled={isProcessing || isDead}
              className="px-6 py-2 bg-textDark text-white font-bold rounded hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              行 动
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};