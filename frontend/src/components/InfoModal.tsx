import React from 'react';
import { StatusCard, type PlayerCardData } from './StatusCard';

export type InfoPanelType = '面板' | '背包' | '洞府' | '宗门' | '情缘';

interface Props {
  type: InfoPanelType;
  player: PlayerCardData;
  onClose: () => void;
}

/** 信息详情弹窗：面板/背包/洞府/宗门/情缘，全部用前端已有数据秒开，不调后端、不耗 DeepSeek */
export const InfoModal: React.FC<Props> = ({ type, player, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-paper border-2 border-jade rounded-md shadow-lg p-5 w-[560px] max-h-[85vh] flex flex-col font-serif"
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
                <div className="text-center text-textSub py-10">尚无洞府</div>
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
