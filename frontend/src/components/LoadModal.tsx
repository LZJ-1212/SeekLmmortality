import React, { useEffect, useState } from 'react';
import { apiFetch } from '../playToken';

interface Snapshot {
  id: string;
  createdAt: string;
  label: string | null;
}

interface Props {
  saveId: string;
  onClose: () => void;
  onRolledBack: () => void;
}

/** 读档弹窗：列出历史快照，点击回滚到某个时间点（时光倒流，可复活） */
export const LoadModal: React.FC<Props> = ({ saveId, onClose, onRolledBack }) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/saves/${saveId}/snapshots`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.status === 'success' && Array.isArray(data.data)) {
          setSnapshots(data.data);
        } else {
          setError(data.message || '天机紊乱，无法读取快照。');
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
  }, [saveId]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleRollback = async (snapshotId: string) => {
    if (!window.confirm('确定要回滚到这一刻吗？之后的因果将一并抹去。')) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/saves/${saveId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        onRolledBack();
      } else {
        setError(data.message || '回滚失败。');
      }
    } catch {
      setError('无法沟通天道引擎。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-paper border-2 border-jade rounded-md shadow-lg p-5 w-[560px] max-h-[85vh] flex flex-col font-serif"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-jade text-white text-center py-2 rounded-sm font-bold tracking-widest text-lg shadow-sm mb-3">
          读档 · 时光倒流
        </div>

        {loading && <div className="py-10 text-center text-textSub">推演往昔中...</div>}

        {!loading && error && <div className="py-6 text-center text-blood">【天道反噬】 {error}</div>}

        {!loading && !error && snapshots.length === 0 && (
          <div className="py-10 text-center text-textSub">尚无快照，仙途未留痕。</div>
        )}

        {!loading && !error && snapshots.length > 0 && (
          <div className="flex-1 overflow-y-auto space-y-1">
            {snapshots.map((s) => (
              <button
                key={s.id}
                onClick={() => handleRollback(s.id)}
                disabled={busy}
                className="w-full flex justify-between items-center text-left bg-[#F4EFE6] border border-[#E5E0D5] px-3 py-2 rounded hover:border-jade transition-colors disabled:opacity-50"
              >
                <span className="text-textDark text-sm">
                  {s.label || '（无题）'}
                </span>
                <span className="text-textSub text-xs">{formatTime(s.createdAt)}</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-3 w-full py-2 bg-textDark text-white font-bold rounded hover:bg-black transition-colors"
        >
          关 闭
        </button>
      </div>
    </div>
  );
};
