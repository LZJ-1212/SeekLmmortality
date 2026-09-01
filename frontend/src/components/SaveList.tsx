import React, { useEffect, useState } from 'react';
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
 * 不在此页做快照回滚（读档），那是后续功能。
 */
export const SaveList: React.FC<Props> = ({ onEnter, onCreate }) => {
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/saves')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.status === 'success' && Array.isArray(data.data)) {
          setSaves(data.data);
        } else {
          setError(data.message || '天机紊乱，无法读取存档。');
        }
      })
      .catch(() => {
        if (!cancelled) setError('无法沟通天道引擎。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          <div className="py-10 text-center">
            <div className="text-blood mb-4">【天道反噬】 {error}</div>
            <button onClick={() => location.reload()} className="px-4 py-2 bg-textDark text-white rounded hover:bg-black transition-colors">
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
              <button
                key={s.saveId}
                onClick={() => s.playerId && onEnter(s.playerId)}
                disabled={!s.playerId}
                className="w-full text-left bg-[#F4EFE6] border border-[#E5E0D5] rounded p-3 hover:border-jade transition-colors disabled:opacity-50"
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
            ))}
          </div>
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
