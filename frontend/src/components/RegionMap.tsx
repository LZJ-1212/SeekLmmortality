import React from 'react';
import { CATALOG_REGIONS } from '../catalogDisplay';

interface Props {
  currentLocation?: string | null;
}

/** 九州已收录地点的宣纸示意图，不调 DeepSeek、不改所在。 */
export const RegionMap: React.FC<Props> = ({ currentLocation }) => {
  return (
    <svg viewBox="0 0 400 260" className="w-full h-auto rounded border border-gold/40 bg-[#F7F1E4]" aria-label="九州示意图">
      <rect width="400" height="260" fill="#F7F1E4" />
      <path d="M20 210 Q80 170 140 190 T280 200 T380 170" fill="none" stroke="#C9A45C" strokeWidth="1.2" opacity="0.45" />
      <path d="M40 80 Q120 40 200 70 T360 50" fill="none" stroke="#6FA698" strokeWidth="1.5" opacity="0.35" />
      <path d="M30 120 L70 90 L110 125 L70 140 Z" fill="#8FBFA0" opacity="0.35" />
      <path d="M300 30 L340 20 L370 55 L330 70 Z" fill="#8B6FA8" opacity="0.28" />
      <path d="M250 200 L290 185 L320 220 L270 230 Z" fill="#5C8C6E" opacity="0.25" />
      <text x="200" y="14" textAnchor="middle" fill="#8C8578" fontSize="10" fontFamily="serif">
        九州一隅（已录之地）
      </text>
      {CATALOG_REGIONS.map((region) => {
        const here = currentLocation === region.name;
        const cx = (region.x / 100) * 400;
        const cy = (region.y / 100) * 260;
        return (
          <g key={region.name}>
            {here && (
              <circle cx={cx} cy={cy} r="16" fill="none" stroke="#C9A45C" strokeWidth="2" />
            )}
            <circle cx={cx} cy={cy} r="7" fill={here ? '#8B6FA8' : '#6FA698'} />
            <text
              x={cx}
              y={cy + 22}
              textAnchor="middle"
              fill="#3F3A34"
              fontSize="11"
              fontFamily="serif"
            >
              {region.short}
            </text>
          </g>
        );
      })}
    </svg>
  );
};
