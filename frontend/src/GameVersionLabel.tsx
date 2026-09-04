/** 修订：2026-09-05 01:39 +08 lzj — 页面展示仓库 VERSION */
import React, { useEffect, useState } from 'react';
import { apiFetch } from './playToken';

function uiVersion(): string {
  return typeof __GAME_VERSION__ === 'string' && __GAME_VERSION__.length > 0 ? __GAME_VERSION__ : '0.0.0';
}

function readPingVersion(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  if (!('version' in data)) return null;
  const version = data.version;
  return typeof version === 'string' ? version : null;
}

/** 存档/创角/局内角落：界面版本；若天道 ping 到的号不同则两行都写。 */
export const GameVersionLabel: React.FC<{ className?: string }> = ({ className }) => {
  const ui = uiVersion();
  const [engine, setEngine] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/ping')
      .then(async (res) => readPingVersion(await res.json()))
      .then((version) => {
        if (version) setEngine(version);
      })
      .catch(() => {
        /* 探活失败时只显示界面版本 */
      });
  }, []);

  const text = engine && engine !== ui ? `界面 ${ui} · 天道 ${engine}` : `版本 ${ui}`;
  return <span className={className}>{text}</span>;
};
