import React from 'react';
import { CATALOG_REGIONS, listCraftRanks } from '../catalogDisplay';
import { RegionMap } from './RegionMap';
import { StatusCard, type PlayerCardData } from './StatusCard';

export type InfoPanelType = '面板' | '背包' | '洞府' | '宗门' | '情缘' | '地图' | '技艺';

interface Props {
  type: InfoPanelType;
  player: PlayerCardData;
  onClose: () => void;
}

/** 信息详情弹窗：只读，不调后端、不耗 DeepSeek */
export const InfoModal: React.FC<Props> = ({ type, player, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className={`bg-paper border-2 border-jade rounded-md shadow-lg p-5 max-h-[85vh] flex flex-col font-serif ${
          type === '地图' ? 'w-[calc(100%-2rem)] max-w-2xl' : 'w-[calc(100%-2rem)] max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-jade text-white text-center py-2 rounded-sm font-bold tracking-widest text-lg shadow-sm mb-3">
          {type}
        </div>

        <div className="flex-1 overflow-y-auto">
          {type === '面板' && <StatusCard player={player} />}

          {type === '背包' && (
            <div className="space-y-1 text-sm">
              {player.inventory && player.inventory.length > 0 ? (
                player.inventory.map((item, idx) => (
                  <div key={item.id ?? idx} className="flex justify-between items-center bg-[#F4EFE6] px-3 py-2 rounded border border-[#E5E0D5]">
                    <span className={item.type === 'custom' ? 'text-mystic' : 'text-textDark'}>{item.name}</span>
                    <span className="text-textSub text-xs">×{item.quantity}</span>
                  </div>
                ))
              ) : (
                <div className="text-center text-textSub py-10">空无一物</div>
              )}
            </div>
          )}

          {type === '洞府' && (
            <div className="space-y-2 text-sm">
              {player.cave ? (
                <>
                  <div className="flex justify-between bg-[#F4EFE6] px-3 py-2 rounded border border-[#E5E0D5]">
                    <span className="text-textSub">所在</span>
                    <span className="text-textDark">{player.cave.location_name ?? '寻常山洞'}</span>
                  </div>
                  <div className="flex justify-between bg-[#F4EFE6] px-3 py-2 rounded border border-[#E5E0D5]">
                    <span className="text-textSub">等级</span>
                    <span className="text-textDark">{player.cave.level ?? 1}</span>
                  </div>
                  <div className="flex justify-between bg-[#F4EFE6] px-3 py-2 rounded border border-[#E5E0D5]">
                    <span className="text-textSub">灵气浓度</span>
                    <span className="text-jade font-semibold">{player.cave.spiritual_density ?? 10}</span>
                  </div>
                </>
              ) : (
                <div className="text-center text-textSub py-10 space-y-2">
                  <div>尚无洞府</div>
                  <div className="text-xs">客栈与所在地不是洞府。须自行开辟，或待宗门赐予。</div>
                </div>
              )}
            </div>
          )}

          {type === '宗门' && (
            <div className="space-y-2 text-sm">
              {player.sect?.sect_name ? (
                <>
                  <div className="flex justify-between bg-[#F4EFE6] px-3 py-2 rounded border border-[#E5E0D5]">
                    <span className="text-textSub">宗门</span>
                    <span className="text-textDark">{player.sect.sect_name}</span>
                  </div>
                  <div className="flex justify-between bg-[#F4EFE6] px-3 py-2 rounded border border-[#E5E0D5]">
                    <span className="text-textSub">职位</span>
                    <span className={player.sect.is_traitor ? 'text-blood' : 'text-jade'}>{player.sect.rank ?? '试炼弟子'}</span>
                  </div>
                  <div className="flex justify-between bg-[#F4EFE6] px-3 py-2 rounded border border-[#E5E0D5]">
                    <span className="text-textSub">声望</span>
                    <span className="text-textDark">{player.sect.reputation ?? 0}</span>
                  </div>
                  {player.sect.is_traitor && (
                    <div className="text-blood text-center text-xs bg-[#F6E3E3] py-2 rounded">
                      你已叛出师门，执法堂缉杀令随时降临。
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-textSub py-10">散修之身，无门无派</div>
              )}
            </div>
          )}

          {type === '地图' && (
            <div className="space-y-2 text-sm">
              <div className="text-textSub text-xs mb-2">
                身在 <span className="text-textDark">{player.current_location || '未知之地'}</span>
                。金圈为你所在。不调天机、点图不赶路，须在输入中自述。
              </div>
              <RegionMap currentLocation={player.current_location} />
              <ul className="text-xs text-textSub space-y-1 pt-1">
                {CATALOG_REGIONS.map((region) => (
                  <li key={region.name}>
                    <span className={player.current_location === region.name ? 'text-mystic' : 'text-textDark'}>
                      {region.short}
                    </span>
                    {' · '}
                    {region.hint}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {type === '技艺' && (
            <div className="space-y-2 text-sm">
              <div className="text-textSub text-xs mb-2">
                未拜师、未炼成则未习。炼丹须在输入中写明「炼丹」与丹名。
              </div>
              {listCraftRanks().map((row) => (
                <div
                  key={row.title}
                  className="flex justify-between items-center bg-[#F4EFE6] px-3 py-2 rounded border border-[#E5E0D5]"
                >
                  <span className="text-textDark">{row.title}</span>
                  <span className={row.learned ? 'text-jade font-semibold' : 'text-textSub'}>
                    {row.learned ? `${row.level} 级` : '未习'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {type === '情缘' && (
            <div className="space-y-1 text-sm">
              {player.relationships && player.relationships.length > 0 ? (
                player.relationships.map((rel) => (
                  <div
                    key={rel.id}
                    className={`flex justify-between items-center px-3 py-2 rounded border ${
                      rel.is_deceased ? 'bg-[#EFECE6] border-[#E5E0D5] opacity-60' : 'bg-[#F5EFF9] border-mystic'
                    }`}
                  >
                    <span className={rel.is_deceased ? 'text-textSub line-through' : 'text-textDark'}>
                      {rel.npc_name}
                      <span className="ml-1 text-[11px] text-textSub">
                        （{rel.relation_type || '相识'}{rel.is_deceased ? '·已仙逝' : ''}）
                      </span>
                    </span>
                    {!rel.is_deceased && <span className="text-mystic text-xs">好感 {rel.affinity ?? 0}</span>}
                  </div>
                ))
              ) : (
                <div className="text-center text-textSub py-10">孤身一人，尚无羁绊</div>
              )}
            </div>
          )}
        </div>

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
