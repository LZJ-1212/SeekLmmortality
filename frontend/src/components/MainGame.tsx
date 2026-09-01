import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../playToken';
import { CommandMenu, type Command } from './CommandMenu';
import { InfoModal, type InfoPanelType } from './InfoModal';
import { LoadModal } from './LoadModal';

// 定义每条日志的格式
interface LogEntry {
  id: number;
  type: 'system' | 'player' | 'narrative';
  content: string;
}

interface OpeningOption {
  tag: string;
  text: string;
}
interface Opening {
  paragraphs: string[];
  options: OpeningOption[];
}

const FONT_SIZE_KEY = 'sl_font_size';
const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 24;

// 指令 → 标准行动文本（行动类指令点击即发对应文本，触发后端确定性拦截器）
const COMMAND_ACTION_TEXT: Partial<Record<Command, string>> = {
  修炼: '闭关修炼',
  突破: '尝试突破境界',
  悟道: '参悟道法',
  地图: '查看九州地图',
  坊市: '前往坊市',
  技艺: '研习修仙百艺',
  对话: '寻人交谈',
};

// 信息类指令（打开详情弹窗）
const INFO_COMMANDS: ReadonlySet<Command> = new Set(['面板', '背包', '洞府', '宗门', '情缘']);

interface Props {
  playerId: string;
  opening: Opening;
  onExitToList: () => void;
}

export const MainGame: React.FC<Props> = ({ playerId, opening, onExitToList }) => {
  const [inputText, setInputText] = useState('');
  const [playerData, setPlayerData] = useState<any>(null);
  const [loadError, setLoadError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeCommand, setActiveCommand] = useState<Command | null>(null);

  // 字体大小：读取本地持久化的偏好，越界则回退到默认 15px
  const [fontSize, setFontSize] = useState<number>(() => {
    const saved = Number(localStorage.getItem(FONT_SIZE_KEY));
    return saved >= FONT_SIZE_MIN && saved <= FONT_SIZE_MAX ? saved : 15;
  });
  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  // 初始默认的三个动态选项
  const [actionOptions, setActionOptions] = useState([
    { tag: '平和', text: '闭关修炼' },
    { tag: '机缘', text: '四处打听' },
    { tag: '风险', text: '出城历练' }
  ]);

  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, type: 'system', content: '—— 仙路已开，凡尘录入 ——' }
  ]);

  // 逆天改命：大境界渡劫成功后的天赋三选一（Rogue-like），非空时需强制玩家先选择
  const [talentChoices, setTalentChoices] = useState<{ id: string; name: string; description: string }[]>([]);
  const [isChoosingTalent, setIsChoosingTalent] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // 开局剧情：把玩家创角定下的命格织成的身世写进日志，并按剧情给出的方向初始化起步选项
  useEffect(() => {
    if (opening.paragraphs.length > 0) {
      const base: LogEntry[] = [{ id: 1, type: 'system', content: '—— 仙路已开，凡尘录入 ——' }];
      const storyLogs: LogEntry[] = opening.paragraphs.map((p, i) => ({ id: i + 2, type: 'narrative', content: p }));
      setLogs([...base, ...storyLogs]);
    }
    if (opening.options.length > 0) {
      setActionOptions(opening.options);
    }
  }, [opening]);

  // 初次加载数据
  useEffect(() => {
    setLoadError('');
    apiFetch(`/api/player/${playerId}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          const parsedData = {
            ...data.data,  // 保留所有字段（包括 inventory）
            spiritual_roots: JSON.parse(data.data.spiritual_roots),
            talents: JSON.parse(data.data.talents)
          };
          setPlayerData(parsedData);
        } else {
          setLoadError(data.message || '无法读取修士档案。');
        }
      })
      .catch(() => setLoadError('无法沟通天道引擎。'));
  }, [playerId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 判断是否死亡：气血耗尽 或 寿元耗尽（年龄超过寿元上限），二者任一成立即为陨落/坐化
  const isDead = playerData
    ? playerData.hp <= 0 || playerData.age > playerData.max_lifespan
    : false;

  const handleAction = async (actionDesc: string) => {
    if (!actionDesc.trim() || isProcessing || isDead || talentChoices.length > 0) return;

    setLogs(prev => [...prev, { id: Date.now(), type: 'player', content: `> ${actionDesc}` }]);
    setInputText('');
    setIsProcessing(true);

    try {
      const response = await apiFetch('/api/action', {
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

        // 如果死亡，追加天道提示（区分气血耗尽 / 寿元耗尽 / 渡劫陨落三种死因）
        if (result.data.isDead) {
          const deathMessages: Record<string, string> = {
            lifespan_exhausted: '【天道无情】 寿元耗尽，大限已至，你已坐化飞灰...',
            tribulation_failure: '【天道无情】 渡劫失败，雷霆加身，道消身陨于这场九死一生的天劫之中...',
            realm_suppression: '【境界压制】 敌人境界远超于你，如遭天神降世，绝无反抗之力，当场陨落...',
            karma_retribution: '【天理难容】 业力反噬彻底降临，恶贯满盈终有此报，当场被天罚轰灭...',
            region_danger: '【去之即死】 强闯远超自身境界的绝地禁区，天地法则本身便足以碾碎凡躯，当场殒命...',
            hp_exhausted: '【天道无情】 气血耗尽，你已身陨道消...',
          };
          const deathMessage = deathMessages[result.data.deathReason] ?? deathMessages.hp_exhausted;
          setLogs(prev => [...prev, { id: Date.now() + 2, type: 'system', content: deathMessage }]);
        }

        // 逆天改命：大境界渡劫成功，弹出天赋三选一，强制玩家先做出抉择
        if (result.data.talentChoices && result.data.talentChoices.length > 0) {
          setTalentChoices(result.data.talentChoices);
        }

        // 宗门势力：晋升喜讯 / 叛宗警示
        if (result.data.sectPromotion) {
          setLogs(prev => [...prev, {
            id: Date.now() + 3, type: 'system',
            content: `【宗门喜讯】 凭借声望积累，职位由「${result.data.sectPromotion.fromRank}」晋升为「${result.data.sectPromotion.toRank}」！`
          }]);
        }
        if (result.data.sectBetrayed) {
          setLogs(prev => [...prev, {
            id: Date.now() + 4, type: 'system',
            content: '【叛出师门】 你已彻底叛出宗门，从此背负叛徒之名，执法堂的缉杀令将随时降临，再无宁日……'
          }]);
        }

        // 更新动态按钮
        if (result.data.options && result.data.options.length > 0) {
          setActionOptions(result.data.options);
        }

        // ===== 方案 B：重新获取完整玩家数据（包含背包） =====
        const refreshResponse = await apiFetch(`/api/player/${playerId}`);
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
            talents: JSON.parse(result.data.player.talents),
            lifespanStatus: result.data.lifespanStatus,
            cave: result.data.cave,
            sect: result.data.sect,
            relationships: result.data.relationships
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

  const handleChooseTalent = async (talentId: string, talentName: string) => {
    if (isChoosingTalent) return;
    setIsChoosingTalent(true);
    try {
      const response = await apiFetch('/api/talents/choose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, talentId })
      });
      const result = await response.json();

      if (result.status === 'success') {
        setLogs(prev => [...prev, {
          id: Date.now(), type: 'system',
          content: `【逆天改命】 天道垂青，你选择了天赋「${talentName}」，从此道途更进一步！`
        }]);
        setTalentChoices([]);

        const refreshResponse = await apiFetch(`/api/player/${playerId}`);
        const refreshData = await refreshResponse.json();
        if (refreshData.status === 'success') {
          setPlayerData({
            ...refreshData.data,
            spiritual_roots: JSON.parse(refreshData.data.spiritual_roots),
            talents: JSON.parse(refreshData.data.talents)
          });
        }
      } else {
        setLogs(prev => [...prev, { id: Date.now(), type: 'system', content: `【天道反噬】 ${result.message}` }]);
      }
    } catch (error) {
      setLogs(prev => [...prev, { id: Date.now(), type: 'system', content: '【天机中断】 天赋选择失败，无法沟通天道引擎。' }]);
    } finally {
      setIsChoosingTalent(false);
    }
  };

  // 左侧指令菜单分发
  const handleCommand = (cmd: Command) => {
    if (INFO_COMMANDS.has(cmd)) {
      setActiveCommand(cmd);
      return;
    }
    switch (cmd) {
      case '读档':
        setActiveCommand('读档');
        break;
      case '存档':
        onExitToList();
        break;
      default: {
        const text = COMMAND_ACTION_TEXT[cmd];
        if (text) handleAction(text);
      }
    }
  };

  // 读档回滚成功后：刷新玩家数据 + 重置日志与天赋选择
  const handleRolledBack = async () => {
    const refreshResponse = await apiFetch(`/api/player/${playerId}`);
    const refreshData = await refreshResponse.json();
    if (refreshData.status === 'success') {
      setPlayerData({
        ...refreshData.data,
        spiritual_roots: JSON.parse(refreshData.data.spiritual_roots),
        talents: JSON.parse(refreshData.data.talents)
      });
    }
    setTalentChoices([]);
    setLogs([{ id: Date.now(), type: 'system', content: '—— 时光倒流，回到存档的那一刻 ——' }]);
    setActiveCommand(null);
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

  if (loadError) {
    return (
      <div className="p-10 text-center font-serif">
        <div className="text-blood mb-3">【天道反噬】 {loadError}</div>
        <p className="text-textSub text-sm">若提示须持令牌，请回到存档页下方填写一次即可。</p>
      </div>
    );
  }

  if (!playerData) return <div className="p-10 text-center font-serif">天道演算中...</div>;

  return (
    <div className="flex h-screen bg-[#EFECE6] p-4 gap-3">
      {/* 左侧竖排指令菜单（传统 MUD 风） */}
      <CommandMenu
        activeCommand={activeCommand}
        onCommand={handleCommand}
        disabledAction={isProcessing || isDead}
      />

      {/* 逆天改命：天赋三选一弹层，出现时遮罩全屏，强制玩家先做出抉择 */}
      {talentChoices.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-paper border-2 border-gold rounded-md shadow-lg p-5 w-[560px] font-serif">
            <div className="bg-gold text-white text-center py-2 rounded-sm font-bold tracking-widest text-lg shadow-sm mb-4">
              逆天改命 · 天道垂青
            </div>
            <p className="text-center text-textSub text-sm mb-4">大境界渡劫已成，天道赐下三条机缘，请择其一，从此镶入道途，再不可更改：</p>
            <div className="space-y-2">
              {talentChoices.map((talent) => (
                <button
                  key={talent.id}
                  onClick={() => handleChooseTalent(talent.id, talent.name)}
                  disabled={isChoosingTalent}
                  className="w-full text-left bg-[#F5EFF9] border border-mystic rounded p-3 hover:bg-mystic hover:text-white transition-colors disabled:opacity-50"
                >
                  <div className="font-bold text-mystic">{talent.name}</div>
                  <div className="text-xs text-textSub mt-1">{talent.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 信息详情弹窗（面板/背包/洞府/宗门/情缘） */}
      {activeCommand && INFO_COMMANDS.has(activeCommand) && (
        <InfoModal
          type={activeCommand as InfoPanelType}
          player={playerData}
          onClose={() => setActiveCommand(null)}
        />
      )}

      {/* 读档弹窗 */}
      {activeCommand === '读档' && playerData.save_id && (
        <LoadModal
          saveId={playerData.save_id}
          onClose={() => setActiveCommand(null)}
          onRolledBack={handleRolledBack}
        />
      )}

      <div className="flex-1 flex flex-col bg-paper border-2 border-jade rounded-md shadow-lg font-serif overflow-hidden">

        <div className="bg-jade text-white px-4 py-2 font-bold tracking-widest text-lg shadow-sm flex justify-between items-center">
          <span>九州大世界</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs font-normal">
              <button
                onClick={() => setFontSize(f => Math.max(FONT_SIZE_MIN, f - 1))}
                disabled={fontSize <= FONT_SIZE_MIN}
                className="w-7 h-7 rounded border border-white/40 hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed leading-none"
                title="缩小字体"
              >
                A-
              </button>
              <span className="opacity-90 w-5 text-center">{fontSize}</span>
              <button
                onClick={() => setFontSize(f => Math.min(FONT_SIZE_MAX, f + 1))}
                disabled={fontSize >= FONT_SIZE_MAX}
                className="w-7 h-7 rounded border border-white/40 hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed leading-none"
                title="放大字体"
              >
                A+
              </button>
            </div>
            <span className="text-sm font-normal opacity-80">{isDead ? '寂灭' : '天玄历'}</span>
          </div>
        </div>

        {/* 精简状态条：核心数值常驻可见，详情点左侧「面板」查看 */}
        <div className="bg-[#F4EFE6] border-b border-gold border-opacity-50 px-4 py-1.5 text-xs text-textSub flex flex-wrap gap-x-4 gap-y-1">
          <span><strong className="text-textDark">{playerData.name}</strong> {playerData.gender} · {playerData.age} 岁</span>
          <span>{playerData.realm_major}·{playerData.realm_minor}</span>
          <span>气血 {playerData.hp}/{playerData.max_hp}</span>
          <span>灵力 {playerData.mp}/{playerData.max_mp}</span>
          <span>寿元 {playerData.age}/{playerData.max_lifespan}</span>
          <span>灵石 {playerData.spirit_stones}</span>
          {isDead && <span className="text-blood font-bold">〔已陨落〕</span>}
        </div>

        <div
          className="flex-1 overflow-y-auto p-6 space-y-3 text-textMain leading-relaxed"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
        >
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
