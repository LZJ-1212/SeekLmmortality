/**
 * 开场剧情（Service 层，纯函数，不依赖数据库）。
 * 根据玩家创角时定下的「名字 / 性别 / 出身 / 道途 / 先天体质 / 灵根 / 先天天赋 / 六维」
 * 生成一段确定性的、被这些命格深度影响的开场剧情，并给出玩家起步的初始行动选项。
 *
 * 这段剧情是"开局"的第一块拼图：玩家读完自己的身世后，直接按剧情给出的方向开始游戏。
 */

export interface OpeningInput {
  name: string;
  gender?: string;
  origin?: string;
  daoPursuit?: string;
  constitution?: string;
  roots: { quality?: string; elements?: string[] };
  innateTalents?: string[];
  attributes: Partial<Record<string, number>>;
  /** 前世遗泽（轮回系统），若触发则作为额外的一段因果写进开场 */
  legacyBlessing?: { type: string; narrativeText: string } | null;
}

export interface OpeningOption {
  tag: string;
  text: string;
}

export interface OpeningResult {
  paragraphs: string[];
  options: OpeningOption[];
}

/** 性别代称：叙事中正确称呼玩家（男→他，女→她，其余→其） */
export function getGenderPronoun(gender?: string): string {
  if (gender === '男') return '他';
  if (gender === '女') return '她';
  return '其';
}

/** 各出身的一两句身世描写 */
const ORIGIN_OPENING: Record<string, string> = {
  农家子: '生于青岳山下一户农家，自幼双足沾满泥土，却总爱在夜深时仰望星空，幻想山外那传说中的仙门。',
  猎户之后: '猎户之后，随父辈在山林间追逐猎物，练就了一身矫健身手，也对危险有着野兽般的敏锐直觉。',
  商贾之家: '商贾之家，自幼随父出入坊市，耳濡目染讨价还价之术，家底殷实，对灵石与财货天生敏感。',
  官宦子弟: '官宦子弟，锦衣玉食，见过世面也读过圣贤书，只是厌倦了官场倾轧，转而向往那超凡脱俗的仙途。',
  将门之后: '将门之后，血性刚烈，自幼习武，骨子里透着一股杀伐果决的锐气。',
  没落世家: '没落世家的末代子弟，祖上曾出过修士，家道中落后唯余几卷残破的家传典籍，承载着复兴家族的执念。',
  市井孤儿: '市井孤儿，无依无靠，在坊市最底层的污泥里摸爬滚打长大，见惯人情冷暖，心性比同龄人坚韧得多。',
  书香门第: '书香门第，诗书传家，自幼博览群书、过目不忘，对天地至理有着远超常人的理解。',
  方外遗孤: '方外遗孤，身世成谜，被云游道人收养于山野道观，耳濡目染些微道法，神识天生比常人敏锐。',
  妖族后裔: '妖族后裔，体内流淌着上古妖兽的血脉，肉身强横，虽为人形，却总带着一丝非人的气息。',
};

/** 各先天体质的描述 */
const CONSTITUTION_OPENING: Record<string, string> = {
  凡体: '凡体之躯，平平无奇，与千千万万的凡人并无二致。',
  先天道体: '天生先天道体，与大道亲和、经脉通透，是无数宗门梦寐以求的瑰宝。',
  剑灵体: '身负剑灵体，天生剑骨，与剑道血脉相连，锋芒内敛。',
  九阳圣体: '身负九阳圣体，体内似有九轮烈日熔炉，气血旺盛如渊，肉身之强远超同辈。',
  冰魄灵体: '身负冰魄灵体，通体清凉如冰魄，神识澄澈，寒而不冽。',
  玄阴体: '身负玄阴体，阴气内敛，与太阴星宿遥相呼应，夜间修炼尤有奇效。',
  纯阳体: '身负纯阳体，至阳至刚，气血如炉火，邪祟难侵，战力惊人。',
  混沌体: '身负混沌体，万中无一，体内混沌未分，可兼容诸般大道，潜力不可限量。',
};

/** 各道途追求的一句话 */
const DAO_PURSUIT_OPENING: Record<string, string> = {
  问道飞升: '毕生所求，唯有那虚无缥缈却至高无上的飞升大道。',
  逍遥长生: '不求闻达于世，只愿逍遥天地间，求得长生不老。',
  快意恩仇: '恩怨分明，快意恩仇，宁为玉碎不为瓦全。',
  守护所爱: '所求不过守护身边之人，护得所爱周全。',
  问鼎天下: '胸有凌云之志，欲问鼎这九州天下。',
  随心所欲: '只愿随心所欲，不被任何枷锁束缚。',
};

/** 各先天天赋的一句话 */
const INNATE_TALENT_OPENING: Record<string, string> = {
  天资聪颖: '自幼天资聪颖，学什么都快人一步。',
  过目不忘: '有过目不忘之能，凡所见所闻皆能铭记于心。',
  身轻如燕: '身轻如燕，翻山越岭如履平地。',
  天生道心: '天生道心澄明，外物难扰，向道之心坚若磐石。',
  气运加身: '气运加身，冥冥之中似有天助，屡屡逢凶化吉。',
  百脉俱通: '百脉俱通，经脉畅通无阻，修炼起来事半功倍。',
};

/** 六维 → 资质评语（用于突出玩家的先天长处） */
const ATTRIBUTE_LABELS: Record<string, string> = {
  aptitude: '资质出众',
  comprehension: '悟性惊人',
  divine_sense: '神识敏锐',
  speed: '身法迅捷',
  dao_heart: '道心坚毅',
  fortune: '天生仙缘',
};

/** 挑出六维中最高的两项，写成一句"禀赋评语" */
function describeAttributes(attributes: Partial<Record<string, number>>): string {
  const ranked = Object.entries(attributes)
    .filter(([key]) => key in ATTRIBUTE_LABELS && typeof attributes[key] === 'number')
    .sort((a, b) => (b[1] as number) - (a[1] as number));
  if (ranked.length === 0) return '禀赋平平，无甚出奇';
  const top = ranked.slice(0, 2).map(([key]) => ATTRIBUTE_LABELS[key]);
  return `${top.join('、')}，远超同辈`;
}

/** 起步行动选项：玩家读完开场剧情后，按这些方向开启修仙之路 */
const DEFAULT_OPTIONS: OpeningOption[] = [
  { tag: '平和', text: '在坊市四处转转' },
  { tag: '机缘', text: '打听修仙门路' },
  { tag: '风险', text: '前往青岳山外历练' },
];

/**
 * 生成被命格深度影响的开场剧情。全程确定性（不依赖随机数），
 * 因此同一套命格永远生成同样的身世，方便测试与复现。
 */
export function buildOpeningNarrative(input: OpeningInput): OpeningResult {
  const name = input.name?.trim() || '无名氏';
  const pronoun = getGenderPronoun(input.gender);
  const quality = input.roots?.quality ?? '伪灵根';
  const elements = input.roots?.elements?.length ? input.roots.elements.join('、') : '无';

  const originOpening = ORIGIN_OPENING[input.origin ?? ''] ?? '身世平凡，来自九州一隅的无名之地。';
  const constitutionOpening = CONSTITUTION_OPENING[input.constitution ?? ''] ?? '凡体之躯，平平无奇。';
  const pursuitOpening = DAO_PURSUIT_OPENING[input.daoPursuit ?? ''] ?? '所求者，不过一条属于自己的长生路。';
  const talentOpenings = (input.innateTalents ?? [])
    .map((t) => INNATE_TALENT_OPENING[t])
    .filter((s): s is string => !!s);

  const paragraphs: string[] = [];

  paragraphs.push(
    `【天玄历 · 三百八十七年 · 春】\n${name}，${input.origin ?? '凡尘'}出身，如今已届十六。${originOpening} 就在今日，${pronoun}体内沉眠多年的灵根彻底苏醒——竟是${quality}，五行属${elements}。`,
  );

  const talentText = talentOpenings.length > 0 ? talentOpenings.join('') : '天赋不显，唯有勤能补拙。';
  paragraphs.push(`${constitutionOpening}${talentText}${pursuitOpening}${pronoun}的人生轨迹，似乎从这一刻起，悄然与仙途纠缠在了一起。`);

  paragraphs.push(`细察之下，${pronoun}${describeAttributes(input.attributes)}。这份与生俱来的禀赋，将成为${pronoun}求道路上最宝贵的本钱。`);

  if (input.legacyBlessing && input.legacyBlessing.type !== 'none') {
    paragraphs.push(`更有一段奇异的因果：${input.legacyBlessing.narrativeText}`);
  }

  paragraphs.push(`仙门未启，凡尘已远。${name}站在坊市的青石街口，望着远处云雾缭绕的青岳山，心中那点微弱的道火，悄然燃起。`);

  return { paragraphs, options: DEFAULT_OPTIONS };
}
