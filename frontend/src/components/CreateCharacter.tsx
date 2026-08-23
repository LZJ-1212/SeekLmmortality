import React, { useState } from 'react';

interface Props {
  onCreated: (playerId: string) => void;
}

export const CreateCharacter: React.FC = () => {
  // 1. 基础信息
  const [name, setName] = useState('');
  const [gender, setGender] = useState('男');
  
  // 2. 六维与造化点
  const [attributes, setAttributes] = useState({
    aptitude: 10, comprehension: 10, divine_sense: 10, 
    speed: 10, dao_heart: 10, fortune: 10
  });
  const remainingPoints = 60 - Object.values(attributes).reduce((a, b) => a + b, 0);

  // 3. 修仙命格数据
  const [origin, setOrigin] = useState('农家子');
  const [daoPursuit, setDaoPursuit] = useState('问道飞升');
  const [constitution, setConstitution] = useState('凡体');
  
  // 4. 灵根系统 (多选)
  const [roots, setRoots] = useState<string[]>(['木', '火']);
  
  // 5. 天赋系统 (最多选3个)
  const [selectedTalents, setSelectedTalents] = useState<string[]>([]);

  // 选项数据字典
  const origins = ['农家子', '猎户之后', '商贾之家', '官宦子弟', '将门之后', '没落世家', '市井孤儿', '书香门第', '方外遗孤', '妖族后裔'];
  const pursuits = ['问道飞升', '逍遥长生', '快意恩仇', '守护所爱', '问鼎天下', '随心所欲'];
  const constitutions = ['凡体', '先天道体', '剑灵体', '九阳圣体', '冰魄灵体', '玄阴体', '纯阳体', '混沌体'];
  const rootElements = ['金', '木', '水', '火', '土', '雷', '风', '冰'];
  const talentList = ['天资聪颖', '过目不忘', '身轻如燕', '天生道心', '气运加身', '百脉俱通'];
  const elementColors: Record<string, string> = { '金':'bg-gold', '木':'bg-wood', '水':'bg-water', '火':'bg-blood', '土':'bg-[#B08A4E]', '雷':'bg-thunder', '风':'bg-[#7F9C9C]', '冰':'bg-sect' };

  // 交互逻辑处理
  const handleAttrChange = (key: keyof typeof attributes, delta: number) => {
    const newVal = attributes[key] + delta;
    if (newVal < 1 || newVal > 15 || (delta > 0 && remainingPoints <= 0)) return;
    setAttributes({ ...attributes, [key]: newVal });
  };

  const toggleRoot = (el: string) => {
    if (roots.includes(el)) {
      if (roots.length > 1) setRoots(roots.filter(r => r !== el)); // 至少保留1个
    } else {
      if (roots.length < 5) setRoots([...roots, el]); // 最多5系杂灵根
    }
  };

  const toggleTalent = (t: string) => {
    if (selectedTalents.includes(t)) {
      setSelectedTalents(selectedTalents.filter(x => x !== t));
    } else {
      if (selectedTalents.length < 3) setSelectedTalents([...selectedTalents, t]); // 假设初始只能带3个天赋
    }
  };

  const getRootQuality = () => {
    if (roots.length === 1) return { name: '天灵根', color: 'text-gold' };
    if (roots.length === 2) return { name: '地灵根', color: 'text-jade' };
    if (roots.length === 3) return { name: '真灵根', color: 'text-water' };
    return { name: '伪灵根', color: 'text-textSub' };
  };

  // 提交降生
  const handleSubmit = async () => {
    if (!name.trim()) return alert("请赐下尊名！");
    if (remainingPoints > 0) return alert(`还有 ${remainingPoints} 点造化未分配！`);

    try {
      const response = await fetch('http://localhost:3000/api/create-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, gender, attributes, roots, origin, daoPursuit, constitution, talents: selectedTalents
        })
      });
      const data = await response.json();
      if (data.status === 'success') {
        alert("✨ " + data.message);
        // 新增这一行：将生成的 playerId 传给主程序
        onCreated(data.data.playerId); 
      } else alert("天机阻碍：" + data.message);
    } catch (error) {
      alert("沟通天道失败，请检查后端。");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#EFECE6] p-4 py-8">
      <div className="w-[520px] bg-paper border-2 border-jade rounded-md shadow-lg p-5 font-serif text-textMain select-none">
        
        <div className="bg-jade text-white text-center py-2 rounded-sm font-bold tracking-widest text-xl shadow-sm">
          天道轮回 · 凝聚命格
        </div>
        <div className="my-3 border-b border-gold opacity-80" />

        {/* 基础与出身 */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
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

        {/* 六维分配 (不变) */}
        <div className="bg-[#F4EFE6] p-3 rounded border border-[#E5E0D5] mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-textDark">先天六维</span>
            <span className="text-xs text-textSub">剩：<strong className={remainingPoints > 0 ? "text-blood" : "text-jade"}>{remainingPoints}</strong></span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {[
              { key: 'aptitude', label: '资质' }, { key: 'comprehension', label: '悟性' }, { key: 'divine_sense', label: '神识' },
              { key: 'speed', label: '遁速' }, { key: 'dao_heart', label: '道心' }, { key: 'fortune', label: '仙缘' }
            ].map(attr => (
              <div key={attr.key} className="flex justify-between items-center bg-[#EFECE6] px-2 py-1 rounded border border-[#E5E0D5]">
                <span className="text-textSub text-xs">{attr.label}</span>
                <div className="flex items-center space-x-1">
                  <button onClick={() => handleAttrChange(attr.key as keyof typeof attributes, -1)} className="w-4 h-4 bg-[#E5E0D5] hover:bg-blood hover:text-white rounded flex items-center justify-center leading-none text-xs">-</button>
                  <span className="w-4 text-center font-bold text-xs">{attributes[attr.key as keyof typeof attributes]}</span>
                  <button onClick={() => handleAttrChange(attr.key as keyof typeof attributes, 1)} className="w-4 h-4 bg-[#E5E0D5] hover:bg-jade hover:text-white rounded flex items-center justify-center leading-none text-xs">+</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 灵根与体质 */}
        <div className="bg-[#F4EFE6] p-3 rounded border border-[#E5E0D5] mb-4">
           <div className="flex justify-between items-center mb-2">
             <span className="font-bold text-textDark text-sm">灵根塑形</span>
             <span className={`text-xs font-bold ${getRootQuality().color}`}>{getRootQuality().name}</span>
           </div>
           <div className="flex flex-wrap gap-2 mb-3">
             {rootElements.map(el => (
               <button key={el} onClick={() => toggleRoot(el)} className={`px-2 py-1 text-xs rounded font-bold border transition-all ${roots.includes(el) ? `${elementColors[el]} text-white border-transparent` : 'bg-[#EFECE6] text-textSub border-[#E5E0D5] hover:border-jade'}`}>
                 {el}
               </button>
             ))}
           </div>
           
           <div className="flex items-center space-x-2 text-sm border-t border-[#E5E0D5] pt-2">
             <span className="text-textSub font-bold">先天体质</span>
             <select value={constitution} onChange={e => setConstitution(e.target.value)} className="flex-1 bg-transparent border-b border-textSub outline-none">
                {constitutions.map(c => <option key={c}>{c}</option>)}
             </select>
           </div>
        </div>

        {/* 先天天赋 */}
        <div className="bg-[#F4EFE6] p-3 rounded border border-[#E5E0D5] mb-4 text-sm">
           <div className="flex justify-between items-center mb-2">
             <span className="font-bold text-textDark">先天天赋</span>
             <span className="text-xs text-textSub">已选 {selectedTalents.length}/3</span>
           </div>
           <div className="flex flex-wrap gap-2">
             {talentList.map(t => (
               <button key={t} onClick={() => toggleTalent(t)} className={`px-2 py-1 text-[11px] rounded transition-all ${selectedTalents.includes(t) ? 'bg-jade text-white shadow-sm' : 'bg-[#EFECE6] text-textSub border border-[#E5E0D5] hover:border-jade'}`}>
                 {t}
               </button>
             ))}
           </div>
        </div>

        <div className="my-3 border-b border-gold opacity-80" />

        <button onClick={handleSubmit} className="w-full py-2.5 bg-jade text-white font-bold tracking-[0.2em] rounded hover:bg-[#5C8C6E] transition-colors shadow">
          踏入仙途
        </button>
      </div>
    </div>
  );
};