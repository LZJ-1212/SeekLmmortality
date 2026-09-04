/** 修订：2026-09-05 01:01 +08 lzj — 创角页共用局内字号 A- / A+ */
/** 修订：2026-09-05 01:39 +08 lzj — 创角页展示版本号 */
import React, { useState } from 'react';
import { apiFetch } from '../playToken';
import { ROOT_ELEMENTS, ELEMENT_COLORS } from '../rootElements';
import { FontSizeButtons, usePersistedFontSize } from '../fontSize';
import { GameVersionLabel } from '../GameVersionLabel';

// 1. 严格定义接收的 Props
interface OpeningOption {
  tag: string;
  text: string;
}
interface Opening {
  paragraphs: string[];
  options: OpeningOption[];
}
interface Props {
  onCreated: (playerId: string, opening: Opening) => void;
}

export const CreateCharacter: React.FC<Props> = ({ onCreated }) => {
  const [fontSize, setFontSize] = usePersistedFontSize();
  const [name, setName] = useState('');
  const [gender, setGender] = useState('男');
  
  const [attributes, setAttributes] = useState({
    aptitude: 10, comprehension: 10, divine_sense: 10, 
    speed: 10, dao_heart: 10, fortune: 10
  });
  const remainingPoints = 60 - Object.values(attributes).reduce((a, b) => a + b, 0);

  const [origin, setOrigin] = useState('农家子');
  const [daoPursuit, setDaoPursuit] = useState('问道飞升');
  const [constitution, setConstitution] = useState('凡体');
  const [roots, setRoots] = useState<string[]>(['木', '火']);
  const [selectedTalents, setSelectedTalents] = useState<string[]>([]);

  const origins = ['农家子', '猎户之后', '商贾之家', '官宦子弟', '将门之后', '没落世家', '市井孤儿', '书香门第', '方外遗孤', '妖族后裔'];
  const pursuits = ['问道飞升', '逍遥长生', '快意恩仇', '守护所爱', '问鼎天下', '随心所欲'];
  const constitutions = ['凡体', '先天道体', '剑灵体', '九阳圣体', '冰魄灵体', '玄阴体', '纯阳体', '混沌体'];
  const talentList = ['天资聪颖', '过目不忘', '身轻如燕', '天生道心', '气运加身', '百脉俱通'];

  // 命格影响说明：与后端 characterBuild.service.ts 的效果一一对应，让玩家一眼看懂每个选择会带来什么
  const originEffects: Record<string, string> = {
    '农家子': '仙缘+1 · 初始灵石+10',
    '猎户之后': '遁速+2',
    '商贾之家': '初始灵石+80',
    '官宦子弟': '悟性+1 · 灵石+50',
    '将门之后': '战斗伤害+10% · 气血上限+10',
    '没落世家': '悟性+2 · 灵石+20',
    '市井孤儿': '仙缘+2 · 道心+1',
    '书香门第': '悟性+3',
    '方外遗孤': '神识+3',
    '妖族后裔': '气血上限+30 · 遁速+1',
  };
  const pursuitEffects: Record<string, string> = {
    '问道飞升': '修炼速度+10%',
    '逍遥长生': '寿元上限+20年',
    '快意恩仇': '战斗伤害+10%',
    '守护所爱': '受伤减免10%',
    '问鼎天下': '修炼速度+5% · 伤害+5%',
    '随心所欲': '仙缘+2',
  };
  const constitutionEffects: Record<string, string> = {
    '凡体': '无特殊加成',
    '先天道体': '修炼速度+20% · 寿元+20年',
    '剑灵体': '战斗伤害+15%',
    '九阳圣体': '气血上限+50 · 伤害+10%',
    '冰魄灵体': '受伤减免10% · 神识+1',
    '玄阴体': '修炼速度+10%',
    '纯阳体': '战斗伤害+20%',
    '混沌体': '修炼速度+10% · 伤害+10%',
  };
  const talentEffects: Record<string, string> = {
    '天资聪颖': '修炼速度+10%',
    '过目不忘': '修炼速度+5% · 悟性+2',
    '身轻如燕': '受伤减免5% · 遁速+2',
    '天生道心': '修炼速度+10% · 道心+2',
    '气运加身': '仙缘+3',
    '百脉俱通': '修炼速度+10%',
  };

  const handleAttrChange = (key: keyof typeof attributes, delta: number) => {
    const newVal = attributes[key] + delta;
    if (newVal < 1 || newVal > 15 || (delta > 0 && remainingPoints <= 0)) return;
    setAttributes({ ...attributes, [key]: newVal });
  };

  const toggleRoot = (el: string) => {
    if (roots.includes(el)) {
      if (roots.length > 1) setRoots(roots.filter(r => r !== el)); 
    } else {
      if (roots.length < 5) setRoots([...roots, el]); 
    }
  };

  const toggleTalent = (t: string) => {
    if (selectedTalents.includes(t)) setSelectedTalents(selectedTalents.filter(x => x !== t));
    else if (selectedTalents.length < 3) setSelectedTalents([...selectedTalents, t]); 
  };

  const getRootQuality = () => {
    if (roots.length === 1) return { name: '天灵根', color: 'text-gold' };
    if (roots.length === 2) return { name: '地灵根', color: 'text-jade' };
    if (roots.length === 3) return { name: '真灵根', color: 'text-water' };
    return { name: '伪灵根', color: 'text-textSub' };
  };

  const handleSubmit = async () => {
    if (!name.trim()) return alert("请赐下尊名！");
    if (remainingPoints > 0) return alert(`还有 ${remainingPoints} 点造化未分配！`);

    try {
      const response = await apiFetch('/api/create-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, gender, attributes, roots, origin, daoPursuit, constitution, talents: selectedTalents
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        alert(data.message);
        // 2. 只有后端明确返回了 data.playerId 时，才触发界面切换，并携带开场剧情
        if (data.data && data.data.playerId) {
          onCreated(data.data.playerId, data.data.opening ?? { paragraphs: [], options: [] });
        } else {
          console.error("后端未返回 playerId", data);
        }
      } else {
        alert("天机阻碍：" + data.message);
      }
    } catch (error) {
      console.error("前端捕获到异常:", error);
      alert("沟通天道失败，请打开浏览器控制台(F12)查看具体报错。");
    }
  };

  return (
    <div className="flex justify-center items-start min-h-screen bg-[#EFECE6] p-4 py-8 overflow-x-hidden">
      <div
        className="w-full max-w-lg bg-paper border-2 border-jade rounded-md shadow-lg p-5 font-serif text-textMain select-none"
        style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}
      >
        
        <div className="bg-jade text-white py-2 px-3 rounded-sm font-bold tracking-widest text-xl shadow-sm flex justify-between items-center">
          <span>天道轮回 · 凝聚命格</span>
          <FontSizeButtons fontSize={fontSize} onChange={setFontSize} />
        </div>
        <div className="mt-1 mb-2 text-right text-[11px] text-textSub">
          <GameVersionLabel />
        </div>
        <div className="my-3 border-b border-gold opacity-80" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-textSub">尊名</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#F4EFE6] border border-[#E5E0D5] px-2 py-1 rounded outline-none focus:border-jade" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-textSub">性别</span>
            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full bg-[#F4EFE6] border border-[#E5E0D5] px-2 py-1 rounded outline-none">
              <option>男</option><option>女</option><option>妖</option><option>无相</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-textSub">出身</span>
            <select value={origin} onChange={e => setOrigin(e.target.value)} className="w-full bg-[#F4EFE6] border border-[#E5E0D5] px-2 py-1 rounded outline-none">
              {origins.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-textSub">道途</span>
            <select value={daoPursuit} onChange={e => setDaoPursuit(e.target.value)} className="w-full bg-[#F4EFE6] border border-[#E5E0D5] px-2 py-1 rounded outline-none">
              {pursuits.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-4 -mt-2 text-[0.8em] text-textSub leading-relaxed">
          <span className="text-textDark">出身：</span>{originEffects[origin] ?? ''}
          <span className="mx-2">｜</span>
          <span className="text-textDark">道途：</span>{pursuitEffects[daoPursuit] ?? ''}
        </div>

        <div className="bg-[#F4EFE6] p-3 rounded border border-[#E5E0D5] mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-textDark">先天六维</span>
            <span className="text-[0.85em] text-textSub">剩：<strong className={remainingPoints > 0 ? "text-blood" : "text-jade"}>{remainingPoints}</strong></span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'aptitude', label: '资质' }, { key: 'comprehension', label: '悟性' }, { key: 'divine_sense', label: '神识' },
              { key: 'speed', label: '遁速' }, { key: 'dao_heart', label: '道心' }, { key: 'fortune', label: '仙缘' }
            ].map(attr => (
              <div key={attr.key} className="flex justify-between items-center bg-[#EFECE6] px-2 py-1 rounded border border-[#E5E0D5]">
                <span className="text-textSub text-[0.85em]">{attr.label}</span>
                <div className="flex items-center space-x-1">
                  <button onClick={() => handleAttrChange(attr.key as keyof typeof attributes, -1)} className="w-9 h-9 md:w-4 md:h-4 bg-[#E5E0D5] hover:bg-blood hover:text-white rounded flex items-center justify-center leading-none text-[0.85em]">-</button>
                  <span className="w-4 text-center font-bold text-[0.85em]">{attributes[attr.key as keyof typeof attributes]}</span>
                  <button onClick={() => handleAttrChange(attr.key as keyof typeof attributes, 1)} className="w-9 h-9 md:w-4 md:h-4 bg-[#E5E0D5] hover:bg-jade hover:text-white rounded flex items-center justify-center leading-none text-[0.85em]">+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[0.75em] text-textSub leading-relaxed border-t border-[#E5E0D5] pt-1">
            资质→修炼速度 ｜ 悟性→炼丹炼器 ｜ 神识→阵法灵植 ｜ 遁速→战斗闪避 ｜ 道心→突破·修炼 ｜ 仙缘→奇遇触发
          </div>
        </div>

        <div className="bg-[#F4EFE6] p-3 rounded border border-[#E5E0D5] mb-4">
           <div className="flex justify-between items-center mb-2">
             <span className="font-bold text-textDark">灵根塑形</span>
             <span className={`text-[0.85em] font-bold ${getRootQuality().color}`}>{getRootQuality().name}</span>
           </div>
           <div className="flex flex-wrap gap-2 mb-3">
             {ROOT_ELEMENTS.map(el => (
               <button key={el} onClick={() => toggleRoot(el)} className={`px-2 py-1 text-[0.85em] rounded font-bold border transition-all ${roots.includes(el) ? `${ELEMENT_COLORS[el]} text-white border-transparent` : 'bg-[#EFECE6] text-textSub border-[#E5E0D5] hover:border-jade'}`}>
                 {el}
               </button>
             ))}
           </div>
           
           <div className="flex items-center space-x-2 border-t border-[#E5E0D5] pt-2">
             <span className="text-textSub font-bold">先天体质</span>
             <select value={constitution} onChange={e => setConstitution(e.target.value)} className="flex-1 bg-transparent border-b border-textSub outline-none">
                {constitutions.map(c => <option key={c}>{c}</option>)}
             </select>
           </div>
           <div className="mt-1 text-[0.75em] text-textSub">{constitutionEffects[constitution] ?? ''}</div>
        </div>

        <div className="bg-[#F4EFE6] p-3 rounded border border-[#E5E0D5] mb-4">
           <div className="flex justify-between items-center mb-2">
             <span className="font-bold text-textDark">先天天赋</span>
             <span className="text-[0.85em] text-textSub">已选 {selectedTalents.length}/3</span>
           </div>
           <div className="flex flex-wrap gap-2">
             {talentList.map(t => (
               <button key={t} onClick={() => toggleTalent(t)} className={`px-2 py-1 text-[0.8em] rounded transition-all ${selectedTalents.includes(t) ? 'bg-jade text-white shadow-sm' : 'bg-[#EFECE6] text-textSub border border-[#E5E0D5] hover:border-jade'}`}>
                 {t}
               </button>
             ))}
           </div>
           <div className="mt-2 text-[0.75em] text-textSub leading-relaxed border-t border-[#E5E0D5] pt-1">
             {selectedTalents.length > 0
               ? selectedTalents.map(t => `${t}：${talentEffects[t] ?? ''}`).join(' ｜ ')
               : '点击上方天赋查看效果（最多选 3 个）'}
           </div>
        </div>

        <div className="my-3 border-b border-gold opacity-80" />

        <button onClick={handleSubmit} className="w-full min-h-10 py-2.5 bg-jade text-white font-bold tracking-[0.2em] rounded hover:bg-[#5C8C6E] transition-colors shadow">
          踏入仙途
        </button>
      </div>
    </div>
  );
};