import React from 'react';

/** 全部指令（顺序即菜单展示顺序） */
export const COMMANDS = [
  '面板', '修炼', '突破', '悟道', '洞府', '地图', '背包', '宗门', '技艺', '情缘', '存档', '读档',
] as const;
export type Command = typeof COMMANDS[number];

/** 只读查看类指令：处理中/已死亡仍可点开查看（不依赖行动结算） */
const ALWAYS_ENABLED: ReadonlySet<Command> = new Set([
  '面板', '背包', '洞府', '宗门', '情缘', '地图', '技艺', '读档', '存档',
]);

interface Props {
  /** 当前打开的弹窗指令（用于高亮） */
  activeCommand: Command | null;
  onCommand: (cmd: Command) => void;
  disabledAction: boolean;
  /**
   * rail：768～1023 细竖条
   * underPanel：≥1024 书房，铺在常驻面板下方两列
   * dock：&lt;768 掌中底栏，四列多行
   */
  variant?: 'rail' | 'underPanel' | 'dock';
}

export const CommandMenu: React.FC<Props> = ({
  activeCommand,
  onCommand,
  disabledAction,
  variant = 'rail',
}) => {
  const underPanel = variant === 'underPanel';
  const dock = variant === 'dock';

  return (
    <div
      className={`bg-paper border-2 border-jade rounded-md shadow-lg flex flex-col shrink-0 select-none ${
        dock ? 'w-full border-b-0 rounded-b-none' : underPanel ? 'w-full' : 'w-[104px] h-full'
      }`}
    >
      <div className={`bg-jade text-white text-center font-bold tracking-[0.3em] text-sm ${dock ? 'py-1' : 'py-2'}`}>
        指令
      </div>
      <div
        className={
          dock
            ? 'grid grid-cols-4 gap-1 p-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))]'
            : underPanel
              ? 'grid grid-cols-2 gap-1.5 p-2'
              : 'flex-1 flex flex-col p-1.5 gap-1 overflow-y-auto'
        }
      >
        {COMMANDS.map((cmd) => {
          const disabled = disabledAction && !ALWAYS_ENABLED.has(cmd);
          const active = activeCommand === cmd;
          return (
            <button
              key={cmd}
              onClick={() => onCommand(cmd)}
              disabled={disabled}
              className={`rounded text-sm tracking-[0.2em] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                dock ? 'min-h-9 px-1 py-2' : underPanel ? 'px-2 py-2.5' : 'px-2 py-1.5'
              } ${
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
