import React from 'react';

/** 全部指令（顺序即左侧菜单展示顺序） */
export const COMMANDS = [
  '面板', '修炼', '突破', '悟道', '洞府', '地图', '背包', '坊市', '宗门', '技艺', '情缘', '对话', '存档', '读档',
] as const;
export type Command = typeof COMMANDS[number];

/** 只读查看类指令：处理中/已死亡仍可点开查看（不依赖行动结算） */
const ALWAYS_ENABLED: ReadonlySet<Command> = new Set(['面板', '背包', '洞府', '宗门', '情缘']);

interface Props {
  /** 当前打开的弹窗指令（用于高亮） */
  activeCommand: Command | null;
  /** 点击某个指令 */
  onCommand: (cmd: Command) => void;
  /** 是否禁用「行动类」指令（处理中 / 已死亡时禁用；查看类不受影响） */
  disabledAction: boolean;
}

/** 左侧竖排指令菜单（传统 MUD 风） */
export const CommandMenu: React.FC<Props> = ({ activeCommand, onCommand, disabledAction }) => {
  return (
    <div className="w-[104px] bg-paper border-2 border-jade rounded-md shadow-lg flex flex-col shrink-0 select-none">
      <div className="bg-jade text-white text-center py-2 font-bold tracking-[0.3em] text-sm">
        指令
      </div>
      <div className="flex-1 flex flex-col p-1.5 gap-1 overflow-y-auto">
        {COMMANDS.map((cmd) => {
          const disabled = disabledAction && !ALWAYS_ENABLED.has(cmd);
          const active = activeCommand === cmd;
          return (
            <button
              key={cmd}
              onClick={() => onCommand(cmd)}
              disabled={disabled}
              className={`px-2 py-1.5 rounded text-sm tracking-[0.2em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                active
                  ? 'bg-jade text-white'
                  : 'bg-[#F4EFE6] text-textDark hover:bg-jade hover:text-white'
              }`}
            >
              {cmd}
            </button>
          );
        })}
      </div>
    </div>
  );
};
