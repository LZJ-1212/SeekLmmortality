/** 修订：2026-09-05 01:25 +08 lzj — 存档页提示按口令分仓，清空只动本列表 */
/** 修订：2026-09-05 01:39 +08 lzj — 存档页展示版本号 */
/** 修订：2026-09-05 15:08 +08 lzj — 飞升存档标问道功成 */
import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch, getPlayToken, setPlayToken } from '../playToken';
import { GameVersionLabel } from '../GameVersionLabel';

interface SaveSummary {
  saveId: string;
  saveName: string;
  playerId: string | null;
  playerName: string;
  realmMajor: string;
  realmMinor: string;
  isGameOver: boolean;
  endingId?: string | null;
  updatedAt: string;
}

interface Props {
  onEnter: (playerId: string) => void;
  onCreate: () => void;
}

/**
 * 存档列表：列出存档、删除、新开仙途。令牌只在本页填写一次（「新开仙途」下方），写入 sessionStorage 后创角/局内不再要第二次。
 * 未持令牌时的 401 是网关正常拒绝，不当成「天道反噬」。
 */
export const SaveList: React.FC<Props> = ({ onEnter, onCreate }) => {
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [needToken, setNeedToken] = useState(false);
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [playTokenInput, setPlayTokenInput] = useState(() => getPlayToken());
  // 上次通过后端校验（/api/saves 返回 200）的令牌值；null = 尚未校验或校验失败。
  const [validatedToken, setValidatedToken] = useState<string | null>(null);

  // 公网（隧道/反代）访问时令牌必填；本机直连 localhost/127.0.0.1 可留空。
  const isPublicAccess = typeof window !== 'undefined'
    && window.location.hostname !== 'localhost'
    && window.location.hostname !== '127.0.0.1';
  const tokenInput = playTokenInput.trim();
  // 公网：必须非空且与已校验通过的令牌一致，才算有效；本机直连无需令牌。
  const inputValidated = !isPublicAccess || (tokenInput !== '' && tokenInput === validatedToken);

  const load = useCallback(() => {
    setLoading(true);
    setNotice('');
    setNeedToken(false);
    apiFetch('/api/saves')
      .then(async (res) => {
        const data = await res.json();
        if (res.status === 401 || data.message === '天机有封，须持令牌。') {
          setSaves([]);
          setNeedToken(true);
          setValidatedToken(null);
          return;
        }
        if (data.status === 'success' && Array.isArray(data.data)) {
          setSaves(data.data);
          setValidatedToken(getPlayToken());
        } else {
          setNotice(data.message || '无法读取存档。');
          setValidatedToken(null);
        }
      })
      .catch(() => {
        setNotice('无法沟通天道引擎。后端未启动或地址不对。');
        setValidatedToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const commitTokenAndLoad = () => {
    setPlayToken(tokenInput);
    load();
  };

  const handleEnter = (playerId: string) => {
    if (isPublicAccess && !inputValidated) {
      setNotice(tokenInput === '' ? '须持令牌方可进档。请在下方填写口令后再试。' : '令牌未验或错误，请先点「记下」校验。');
      return;
    }
    setPlayToken(tokenInput);
    onEnter(playerId);
  };

  const handleCreate = () => {
    if (isPublicAccess && !inputValidated) {
      setNotice(tokenInput === '' ? '须持令牌方可开仙途。请在下方填写口令后再试。' : '令牌未验或错误，请先点「记下」校验。');
      return;
    }
    setPlayToken(tokenInput);
    onCreate();
  };

  const handleDelete = async (s: SaveSummary) => {
    if (!window.confirm(`确定要散去「${s.playerName}」这一世吗？此劫不可逆。`)) return;
    setPlayToken(playTokenInput.trim());
    setBusyId(s.saveId);
    try {
      const res = await apiFetch(`/api/saves/${s.saveId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status !== 'success') {
        setNotice(data.message || '删除存档失败。');
      }
    } catch {
      setNotice('无法沟通天道引擎。');
    } finally {
      setBusyId(null);
      load();
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('确定要散去列表中的存档吗？你能看见的这些仙途将一并烟消云散。')) return;
    setPlayToken(playTokenInput.trim());
    setBusyAll(true);
    try {
      const res = await apiFetch('/api/saves', { method: 'DELETE' });
      const data = await res.json();
      if (data.status !== 'success') {
        setNotice(data.message || '清空存档失败。');
      }
    } catch {
      setNotice('无法沟通天道引擎。');
    } finally {
      setBusyAll(false);
      load();
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="flex justify-center items-start min-h-screen bg-[#EFECE6] p-4 py-8 overflow-x-hidden">
      <div className="w-full max-w-lg bg-paper border-2 border-jade rounded-md shadow-lg p-5 font-serif text-textMain select-none">
        <div className="bg-jade text-white text-center py-2 rounded-sm font-bold tracking-widest text-xl shadow-sm">
          问道长生 · 存档
        </div>
        <p className="mt-3 text-xs text-textSub text-center leading-relaxed">
          每位道友持自己的口令，只能看见自己的仙途。
        </p>
        <div className="mt-1 text-center text-[11px] text-textSub">
          <GameVersionLabel />
        </div>
        <div className="my-3 border-b border-gold opacity-80" />

        {loading && <div className="py-10 text-center text-textSub">推演诸般因果中...</div>}

        {!loading && needToken && (
          <div className="py-8 text-center text-textSub text-sm">
            须持令牌方可探查存档。请在下方填写后点记下。
          </div>
        )}

        {!loading && notice && (
          <div className="py-4 text-center text-sm text-textSub">{notice}</div>
        )}

        {!loading && !needToken && !notice && saves.length === 0 && (
          <div className="py-10 text-center text-textSub">
            尚无存档，可踏入仙途，凝聚命格。
          </div>
        )}

        {!loading && !needToken && saves.length > 0 && (
          <div className="space-y-2 mb-4">
            {saves.map((s) => (
              <div
                key={s.saveId}
                className="flex items-stretch gap-2 bg-[#F4EFE6] border border-[#E5E0D5] rounded overflow-hidden"
              >
                <button
                  onClick={() => s.playerId && handleEnter(s.playerId)}
                  disabled={!s.playerId}
                  className="flex-1 text-left p-3 hover:border-jade transition-colors disabled:opacity-50"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-textDark">{s.playerName}</span>
                    <span className="text-xs text-textSub">
                      {s.realmMajor ? `${s.realmMajor}${s.realmMinor}` : '——'}
                      {s.endingId === 'ascend'
                        ? <span className="ml-2 text-gold">问道功成</span>
                        : s.isGameOver && <span className="ml-2 text-blood">已陨落</span>}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-textSub">
                    {s.saveName} · 更新于 {formatTime(s.updatedAt)}
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  disabled={busyId === s.saveId || busyAll}
                  className="px-3 text-sm text-blood border-l border-[#E5E0D5] hover:bg-[#F6E3E3] transition-colors disabled:opacity-50"
                  title="删除此存档"
                >
                  {busyId === s.saveId ? '…' : '删'}
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && !needToken && saves.length > 0 && (
          <button
            onClick={handleDeleteAll}
            disabled={busyAll || busyId !== null}
            className="w-full mb-2 py-2 text-blood border border-blood/40 rounded hover:bg-[#F6E3E3] transition-colors disabled:opacity-50"
          >
            {busyAll ? '散功中...' : '清空列表中的存档'}
          </button>
        )}

        <div className="my-3 border-b border-gold opacity-80" />

        <button
          onClick={handleCreate}
          disabled={needToken || !inputValidated}
          className="w-full min-h-10 py-2.5 bg-jade text-white font-bold tracking-[0.2em] rounded hover:bg-[#5C8C6E] transition-colors shadow disabled:opacity-40 disabled:cursor-not-allowed"
        >
          新开仙途
        </button>
        {isPublicAccess && !inputValidated && (
          <div className="mt-2 text-xs text-blood">
            {tokenInput === '' ? '公网进入须先填写令牌。' : '令牌未验或错误，请先点「记下」校验。'}
          </div>
        )}

        <div className="flex items-center gap-2 text-sm mt-3">
          <span className="text-textSub whitespace-nowrap">令牌</span>
          <input
            type="password"
            value={playTokenInput}
            onChange={(e) => setPlayTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitTokenAndLoad()}
            placeholder="向服主索取你自己的口令；本机直连可留空"
            className="flex-1 min-h-10 bg-[#F4EFE6] border border-[#E5E0D5] px-2 py-2 rounded outline-none focus:border-jade"
          />
          <button
            type="button"
            onClick={commitTokenAndLoad}
            className="min-h-10 px-3 py-2 bg-textDark text-white text-sm rounded hover:bg-black transition-colors whitespace-nowrap"
          >
            记下
          </button>
        </div>
      </div>
    </div>
  );
};
