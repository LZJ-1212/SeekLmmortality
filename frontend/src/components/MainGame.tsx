import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../playToken';
import { CommandMenu, type Command } from './CommandMenu';
import { InfoModal, type InfoPanelType } from './InfoModal';
import { LoadModal } from './LoadModal';
import { StatusCard, type PlayerCardData } from './StatusCard';
import { formatHeavenCalendar } from '../catalogDisplay';

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
const LOGS_STORAGE_PREFIX = 'sl_action_logs_';
const OPTIONS_STORAGE_PREFIX = 'sl_action_options_';
const LOGS_MAX = 400;

/** I20 加深：日段 → 文案（与后端 playerState.describeDayPhase 一致） */
const DAY_PHASE_LABEL: Record<string, string> = {
  dawn: '晨',
  noon: '午',
  dusk: '晚',
  night: '夜',
};

const DEFAULT_ACTION_OPTIONS: OpeningOption[] = [
  { tag: '平和', text: '闭关修炼' },
  { tag: '机缘', text: '四处打听' },
  { tag: '风险', text: '出城历练' },
];

/** MainGame 持有的玩家数据：在状态卡类型基础上补齐存档 ID 与解析后的天赋 */
interface PlayerPayload extends PlayerCardData {
  /** 存档 ID（读档弹窗使用） */
  save_id: string;
  /** 天赋（含创角命格与逆天改命天赋），已从 JSON 字符串解析为对象 */
  talents?: unknown;
  /** I20 加深：当前日段 dawn/noon/dusk/night（后端 world_state.day_phase） */
  day_phase?: string;
}

/** 安全解析后端存为 JSON 字符串的字段；非字符串原样返回，解析失败退化为空对象 */
function parseJsonField(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * 把后端玩家载荷解析成前端可用结构：
 * 后端存库时 spiritual_roots / talents 是 JSON 字符串，这里统一解析为对象，
 * 避免在各处重复 JSON.parse 样板（并防御异常数据导致整组件崩溃）。
 */
function parsePlayerPayload(raw: unknown): PlayerPayload {
  const data = (raw ?? {}) as Record<string, unknown>;
  return {
    ...(data as unknown as PlayerPayload),
    spiritual_roots: (parseJsonField(data.spiritual_roots) || {}) as PlayerPayload['spiritual_roots'],
    talents: parseJsonField(data.talents),
  };
}

/** 拉取玩家最新状态的统一结果：成功携带解析后的载荷，失败携带提示语 */
type FetchPlayerResult =
  | { ok: true; payload: PlayerPayload }
  | { ok: false; message: string };

/** 拉取并解析某玩家的最新状态；网络/接口异常统一收敛为失败结果，由调用方决定降级或报错 */
async function fetchPlayerPayload(playerId: string): Promise<FetchPlayerResult> {
  try {
    const response = await apiFetch(`/api/player/${playerId}`);
    const json = await response.json();
    if (json.status === 'success') {
      return { ok: true, payload: parsePlayerPayload(json.data) };
    }
    return { ok: false, message: json.message || '无法读取修士档案。' };
  } catch {
    return { ok: false, message: '无法沟通天道引擎。' };
  }
}

function logsStorageKey(playerId: string) {
  return `${LOGS_STORAGE_PREFIX}${playerId}`;
}

function optionsStorageKey(playerId: string) {
  return `${OPTIONS_STORAGE_PREFIX}${playerId}`;
}

function readStoredLogs(playerId: string): LogEntry[] | null {
  try {
    const raw = localStorage.getItem(logsStorageKey(playerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const logs: LogEntry[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const entry = row as Partial<LogEntry>;
      if (
        typeof entry.id === 'number' &&
        (entry.type === 'system' || entry.type === 'player' || entry.type === 'narrative') &&
        typeof entry.content === 'string'
      ) {
        logs.push({ id: entry.id, type: entry.type, content: entry.content });
      }
    }
    return logs.length > 0 ? logs : null;
  } catch {
    return null;
  }
}

function writeStoredLogs(playerId: string, logs: LogEntry[]) {
  try {
    localStorage.setItem(logsStorageKey(playerId), JSON.stringify(logs.slice(-LOGS_MAX)));
  } catch {
    /* 配额满则放弃，不打断局内 */
  }
}

function readStoredOptions(playerId: string): OpeningOption[] | null {
  try {
    const raw = localStorage.getItem(optionsStorageKey(playerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const options: OpeningOption[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const option = row as Partial<OpeningOption>;
      if (typeof option.tag === 'string' && typeof option.text === 'string' && option.text.trim()) {
        options.push({ tag: option.tag, text: option.text });
      }
    }
    return options.length > 0 ? options : null;
  } catch {
    return null;
  }
}

function writeStoredOptions(playerId: string, options: OpeningOption[]) {
  try {
    localStorage.setItem(optionsStorageKey(playerId), JSON.stringify(options));
  } catch {
    /* 配额满则放弃 */
  }
}

const DEFAULT_LOGS: LogEntry[] = [
  { id: 1, type: 'system', content: '—— 仙路已开，凡尘录入 ——' },
];

// 指令 → 标准行动文本（行动类指令点击即发对应文本，触发后端确定性拦截器）
const COMMAND_ACTION_TEXT: Partial<Record<Command, string>> = {
  修炼: '闭关修炼',
  突破: '尝试突破境界',
  悟道: '参悟道法',
};

// 信息类指令（打开详情弹窗，不调 DeepSeek）
const INFO_COMMANDS: ReadonlySet<Command> = new Set(['面板', '背包', '洞府', '宗门', '情缘', '地图', '技艺']);

interface Props {
  playerId: string;
  opening: Opening;
  onExitToList: () => void;
}

export const MainGame: React.FC<Props> = ({ playerId, opening, onExitToList }) => {
  const [inputText, setInputText] = useState('');
  const [playerData, setPlayerData] = useState<PlayerPayload | null>(null);
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

  const [actionOptions, setActionOptions] = useState<OpeningOption[]>(
    () => readStoredOptions(playerId) ?? DEFAULT_ACTION_OPTIONS,
  );

  const [logs, setLogs] = useState<LogEntry[]>(() => readStoredLogs(playerId) ?? DEFAULT_LOGS);

  // 逆天改命：大境界渡劫成功后的天赋三选一（Rogue-like），非空时需强制玩家先选择
  const [talentChoices, setTalentChoices] = useState<{ id: string; name: string; description: string }[]>([]);
  const [isChoosingTalent, setIsChoosingTalent] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const [isWideLayout, setIsWideLayout] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsWideLayout(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const apply = () => {
      const palm = window.matchMedia('(max-width: 767px)').matches;
      const height = window.visualViewport?.height ?? window.innerHeight;
      if (palm) {
        document.documentElement.style.setProperty('--app-height', `${height}px`);
      } else {
        document.documentElement.style.removeProperty('--app-height');
      }
    };
    apply();
    const vv = window.visualViewport;
    window.addEventListener('resize', apply);
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    return () => {
      window.removeEventListener('resize', apply);
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      document.documentElement.style.removeProperty('--app-height');
    };
  }, []);

  // 开局剧情：已有本机历史（含叙事或玩家行动）则不覆盖，避免回列表/刷新丢日志
  useEffect(() => {
    const stored = readStoredLogs(playerId);
    const hasHistory = Boolean(stored?.some((row) => row.type === 'player' || row.type === 'narrative'));
    if (hasHistory) return;
    if (opening.paragraphs.length > 0) {
      const base: LogEntry[] = [{ id: 1, type: 'system', content: '—— 仙路已开，凡尘录入 ——' }];
      const storyLogs: LogEntry[] = opening.paragraphs.map((p, i) => ({ id: i + 2, type: 'narrative', content: p }));
      setLogs([...base, ...storyLogs]);
    }
    if (opening.options.length > 0) {
      setActionOptions(opening.options);
    }
  }, [opening, playerId]);

  useEffect(() => {
    writeStoredLogs(playerId, logs);
  }, [playerId, logs]);

  useEffect(() => {
    writeStoredOptions(playerId, actionOptions);
  }, [playerId, actionOptions]);

  // 初次加载数据
  useEffect(() => {
    setLoadError('');
    fetchPlayerPayload(playerId).then((result) => {
      if (result.ok) {
        setPlayerData(result.payload);
      } else {
        setLoadError(result.message);
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

        // ===== 重新获取完整玩家数据（包含背包） =====
        const refreshResult = await fetchPlayerPayload(playerId);

        if (refreshResult.ok) {
          setPlayerData(refreshResult.payload);
        } else {
          // 如果刷新失败，降级使用 action 返回的数据（但会丢失 inventory）
          console.warn('刷新玩家数据失败，使用降级数据');
          setPlayerData(parsePlayerPayload({
            ...result.data.player,
            lifespanStatus: result.data.lifespanStatus,
            cave: result.data.cave,
            sect: result.data.sect,
            relationships: result.data.relationships,
          }));
        }

      } else {
        setLogs(prev => [...prev, { id: Date.now() + 1, type: 'system', content: result.message ? `【天机】 ${result.message}` : '【天机】 推演未成。' }]);
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

        const refreshResult = await fetchPlayerPayload(playerId);
        if (refreshResult.ok) {
          setPlayerData(refreshResult.payload);
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
    if (cmd === '面板' && isWideLayout) return;
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

  // 读档回滚成功后：刷新人物；日志只追加一句，不抹掉历史行动
  const handleRolledBack = async () => {
    const refreshResult = await fetchPlayerPayload(playerId);
    if (refreshResult.ok) {
      setPlayerData(refreshResult.payload);
    }
    setTalentChoices([]);
    setLogs((prev) => [...prev, { id: Date.now(), type: 'system', content: '—— 时光倒流，回到该快照时刻（上文仍为当时见闻） ——' }]);
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
    <div className="flex h-[100dvh] max-md:h-[var(--app-height,100dvh)] bg-[#EFECE6] p-2 md:p-4 gap-3 min-h-0 overflow-hidden">
      {/* 宽屏（≥1024）：常驻面板 + 其下两列指令 */}
      <aside className="hidden lg:flex w-[420px] shrink-0 flex-col min-h-0 gap-3">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <StatusCard player={playerData} />
        </div>
        <CommandMenu
          variant="underPanel"
          activeCommand={activeCommand}
          onCommand={handleCommand}
          disabledAction={isProcessing || isDead}
        />
      </aside>

      {/* 768～1023：细竖条；&lt;768 改走底栏 dock */}
      <div className="hidden md:flex lg:hidden self-stretch shrink-0">
        <CommandMenu
          variant="rail"
          activeCommand={activeCommand}
          onCommand={handleCommand}
          disabledAction={isProcessing || isDead}
        />
      </div>

      {/* 逆天改命：天赋三选一弹层，出现时遮罩全屏，强制玩家先做出抉择 */}
      {talentChoices.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-paper border-2 border-gold rounded-md shadow-lg p-5 w-[calc(100%-2rem)] max-w-lg max-h-[85vh] overflow-y-auto font-serif">
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
      {activeCommand && INFO_COMMANDS.has(activeCommand) && !(activeCommand === '面板' && isWideLayout) && (
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

      <div className="flex-1 flex flex-col min-h-0 bg-paper border-2 border-jade rounded-md shadow-lg font-serif overflow-hidden">

        <div className="bg-jade text-white px-4 py-2 font-bold tracking-widest text-lg shadow-sm flex justify-between items-center">
          <span>九州大世界</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs font-normal">
              <button
                onClick={() => setFontSize(f => Math.max(FONT_SIZE_MIN, f - 1))}
                disabled={fontSize <= FONT_SIZE_MIN}
                className="w-9 h-9 md:w-7 md:h-7 rounded border border-white/40 hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed leading-none"
                title="缩小字体"
              >
                A-
              </button>
              <span className="opacity-90 w-5 text-center">{fontSize}</span>
              <button
                onClick={() => setFontSize(f => Math.min(FONT_SIZE_MAX, f + 1))}
                disabled={fontSize >= FONT_SIZE_MAX}
                className="w-9 h-9 md:w-7 md:h-7 rounded border border-white/40 hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed leading-none"
                title="放大字体"
              >
                A+
              </button>
            </div>
            <span className="text-sm font-normal opacity-90">
              {isDead ? '寂灭' : formatHeavenCalendar(playerData.current_year, playerData.current_season)}
              {!isDead && playerData.day_phase && <span className="ml-1 opacity-80">·{DAY_PHASE_LABEL[playerData.day_phase] ?? ''}</span>}
            </span>
          </div>
        </div>

        {/* 精简状态条：核心数值常驻可见，详情点左侧「面板」查看 */}
        <div className="lg:hidden bg-[#F4EFE6] border-b border-gold border-opacity-50 px-4 py-1.5 text-xs text-textSub flex flex-wrap gap-x-4 gap-y-1">
          <span><strong className="text-textDark">{playerData.name}</strong> {playerData.gender} · {playerData.age} 岁</span>
          <span>{playerData.realm_major}·{playerData.realm_minor}</span>
          <span>气血 {playerData.hp}/{playerData.max_hp}</span>
          <span>灵力 {playerData.mp}/{playerData.max_mp}</span>
          <span>寿元 {playerData.age}/{playerData.max_lifespan}</span>
          <span>灵石 {playerData.spirit_stones}</span>
          {isDead && <span className="text-blood font-bold">〔已陨落〕</span>}
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto p-3 md:p-6 space-y-3 text-textMain leading-relaxed"
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

        <div className="bg-[#F4EFE6] border-t-2 border-gold border-opacity-50 p-3 md:p-4 shrink-0">
          {/* 动态按钮渲染区 */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {actionOptions.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleAction(opt.text)}
                disabled={isProcessing || isDead}
                className={`min-h-10 px-3 py-2 text-white text-sm rounded shadow-sm disabled:opacity-50 transition-colors ${getTagColor(opt.tag)}`}
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
              className="flex-1 min-h-10 bg-white border border-[#E5E0D5] px-3 py-2 rounded outline-none focus:border-jade disabled:bg-gray-200 disabled:cursor-not-allowed"
            />
            <button
              onClick={() => handleAction(inputText)}
              disabled={isProcessing || isDead}
              className="min-h-10 px-5 md:px-6 py-2 bg-textDark text-white font-bold rounded hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              行 动
            </button>
          </div>

          <div className="md:hidden mt-3">
            <CommandMenu
              variant="dock"
              activeCommand={activeCommand}
              onCommand={handleCommand}
              disabledAction={isProcessing || isDead}
            />
          </div>
        </div>

      </div>
    </div>
  );
};
