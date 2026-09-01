import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../playToken';

interface SaveSummary {
  saveId: string;
  saveName: string;
  playerId: string | null;
  playerName: string;
  realmMajor: string;
  realmMinor: string;
  isGameOver: boolean;
  updatedAt: string;
}

interface Props {
  onEnter: (playerId: string) => void;
  onCreate: () => void;
}

/**
 * 存档列表（I05 薄做）：列出全部存档，点击进入；不用再手抄 playerId UUID。
 * 每个存档带删除按钮；底部提供「清空全部」。不在此页做快照回滚（读档），那是后续功能。
 */
export const SaveList: React.FC<Props> = ({ onEnter, onCreate }) => {
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    apiFetch('/api/saves')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && Array.isArray(data.data)) {
          setSaves(data.data);
        } else {
          setError(data.message || '天机紊乱，无法读取存档。');
        }
      })
      .catch(() => setError('无法沟通天道引擎。'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (s: SaveSummary) => {
    if (!window.confirm(`确定要散去「${s.playerName}」这一世吗？此劫不可逆。`)) return;
    setBusyId(s.saveId);
    try {
      const res = await apiFetch(`/api/saves/${s.saveId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.status !== 'success') {
        setError(data.message || '删除存档失败。');
      }
    } catch {
      setError('无法沟通天道引擎。');
    } finally {
      setBusyId(null);
      load();
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('确定要散去全部存档吗？所有因果将一并烟消云散。')) return;
    setBusyAll(true);
    try {
      const res = await apiFetch('/api/saves', { method: 'DELETE' });
      const data = await res.json();
      if (data.status !== 'success') {
        setError(data.message || '清空存档失败。');
      }
    } catch {
      setError('无法沟通天道引擎。');
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
    <div className="flex justify-center items-center min-h-screen bg-[#EFECE6] p-4 py-8">
      <div className="w-[560px] bg-paper border-2 border-jade rounded-md shadow-lg p-5 font-serif text-textMain select-none">
        <div className="bg-jade text-white text-center py-2 rounded-sm font-bold tracking-widest text-xl shadow-sm">
          问道长生 · 存档
        </div>
        <div className="my-3 border-b border-gold opacity-80" />

        {loading && <div className="py-10 text-center text-textSub">推演诸般因果中...</div>}

        {!loading && error && (
          <div className="py-4 text-center">
            <div className="text-blood mb-3">【天道反噬】 {error}</div>
            <button onClick={load} className="px-4 py-2 bg-textDark text-white rounded hover:bg-black transition-colors">
              再试一次
            </button>
          </div>
        )}

        {!loading && !error && saves.length === 0 && (
          <div className="py-10 text-center text-textSub">
            尚无存档，可踏入仙途，凝聚命格。
          </div>
        )}

        {!loading && !error && saves.length > 0 && (
          <div className="space-y-2 mb-4">
            {saves.map((s) => (
              <div
                key={s.saveId}
                className="flex items-stretch gap-2 bg-[#F4EFE6] border border-[#E5E0D5] rounded overflow-hidden"
              >
                <button
                  onClick={() => s.playerId && onEnter(s.playerId)}
                  disabled={!s.playerId}
                  className="flex-1 text-left p-3 hover:border-jade transition-colors disabled:opacity-50"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-textDark">{s.playerName}</span>
                    <span className="text-xs text-textSub">
                      {s.realmMajor ? `${s.realmMajor}${s.realmMinor}` : '——'}
                      {s.isGameOver && <span className="ml-2 text-blood">已陨落</span>}
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

        {!loading && !error && saves.length > 0 && (
          <button
            onClick={handleDeleteAll}
            disabled={busyAll || busyId !== null}
            className="w-full mb-2 py-2 text-blood border border-blood/40 rounded hover:bg-[#F6E3E3] transition-colors disabled:opacity-50"
          >
            {busyAll ? '散功中...' : '清空全部存档'}
          </button>
        )}

        <div className="my-3 border-b border-gold opacity-80" />

        <button
          onClick={onCreate}
          className="w-full py-2.5 bg-jade text-white font-bold tracking-[0.2em] rounded hover:bg-[#5C8C6E] transition-colors shadow"
        >
          新开仙途
        </button>
      </div>
    </div>
  );
};
