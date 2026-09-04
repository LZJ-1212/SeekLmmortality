/**
 * 修订：2026-09-05 01:01 +08 lzj — 局内与创角共用本机字号
 */
import { useEffect, useState } from 'react';

export const FONT_SIZE_KEY = 'sl_font_size';
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 24;
export const FONT_SIZE_DEFAULT = 15;

export function readStoredFontSize(): number {
  const saved = Number(localStorage.getItem(FONT_SIZE_KEY));
  return saved >= FONT_SIZE_MIN && saved <= FONT_SIZE_MAX ? saved : FONT_SIZE_DEFAULT;
}

export function usePersistedFontSize(): [number, (next: number | ((prev: number) => number)) => void] {
  const [fontSize, setFontSize] = useState<number>(readStoredFontSize);
  useEffect(() => {
    localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);
  return [fontSize, setFontSize];
}

interface FontSizeButtonsProps {
  fontSize: number;
  onChange: (next: number | ((prev: number) => number)) => void;
}

/** 青玉顶栏上的 A- / A+，与局内同一套 */
export function FontSizeButtons({ fontSize, onChange }: FontSizeButtonsProps) {
  return (
    <div className="flex items-center gap-1 text-xs font-normal">
      <button
        type="button"
        onClick={() => onChange((f) => Math.max(FONT_SIZE_MIN, f - 1))}
        disabled={fontSize <= FONT_SIZE_MIN}
        className="w-9 h-9 md:w-7 md:h-7 rounded border border-white/40 hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed leading-none"
        title="缩小字体"
      >
        A-
      </button>
      <span className="opacity-90 w-5 text-center">{fontSize}</span>
      <button
        type="button"
        onClick={() => onChange((f) => Math.min(FONT_SIZE_MAX, f + 1))}
        disabled={fontSize >= FONT_SIZE_MAX}
        className="w-9 h-9 md:w-7 md:h-7 rounded border border-white/40 hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed leading-none"
        title="放大字体"
      >
        A+
      </button>
    </div>
  );
}
