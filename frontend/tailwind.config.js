/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // --- 核心底色 ---
        paper: '#FBF8F1',       // 宣纸白底 (所有大面板通用)
        dangerBg: '#FBEDE9',    // 浅珊瑚 (渡劫/战斗警告底)
        mysticBg: '#F5EFF9',    // 浅紫 (机缘/秘境底)
        romanceBg: '#FAEFF3',   // 浅桃粉 (情缘/双修底)
        progressBg: '#E8E4DC',  // 浅灰 (进度条剩余部分)
        
        // --- 场景主题色 / 边框色 ---
        jade: '#6FA698',        // 青玉 (主界面/状态卡/平和选项)
        thunder: '#8B6FA8',     // 玄紫 (突破/渡劫/魔道/雷灵根)
        blood: '#C05F55',       // 朱砂 (战斗/气血/风险/火灵根)
        romance: '#D88FA5',     // 桃粉 (情缘/好感数值)
        mystic: '#A98FD9',      // 紫气 (机缘/探索)
        gold: '#C9A45C',        // 鎏金 (坊市/财富/分隔线/金灵根)
        sect: '#7FA8C9',        // 天青 (宗门/冰灵根)
        bamboo: '#8FBFA0',      // 竹青 (悟道/论道)
        
        // --- 五行与资源补充色 ---
        wood: '#6BA38E',        // 青碧 (木灵根/功德)
        water: '#5E8FAE',       // 蔚蓝 (水灵根/灵力)
        earth: '#B08A4E',       // 赭黄 (土灵根)
        cultivation: '#A87E2E', // 修为/灵石 数值色
        lifespan: '#5C8C6E',    // 寿元 数值色
        karma: '#8E8578',       // 业力 数值色
        
        // --- 文字颜色 ---
        textMain: '#3F3A34',    // 深墨 (正文主色)
        textSub: '#8C8578',     // 灰色 (次要提示/指令行)
        textDark: '#2B2620',    // 近黑 (极致强调)
      }
    },
  },
  plugins: [],
}