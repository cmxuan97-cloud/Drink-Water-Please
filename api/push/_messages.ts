// Server-side companion → push message builder.
// Mirrors src/data/animals.ts (id + emoji + name) plus per-animal push lines.
// Files starting with `_` are not deployed as routes by Vercel.

type AnimalInfo = {
  emoji: string;
  name: string;
  // Personality lines unique to this animal. Mixed with GENERIC_BODIES at send time.
  flavors: string[];
};

const ANIMAL_INFO: Record<string, AnimalInfo> = {
  'a-kiwi':       { emoji: '🐦', name: '奇异鸟咕咕', flavors: ['嘴巴干干的，可以陪我喝一口吗～', '我蹲在水边等你'] },
  'a-mola':       { emoji: '🐟', name: '太阳鱼曼波', flavors: ['我泡在水里都觉得渴，你也来一口', '咕嘟咕嘟，海水和真水不一样'] },
  'a-dragon':     { emoji: '🐉', name: '中国龙小龙', flavors: ['喷火前要先冷却引擎，来一杯水', '腾云驾雾间记得补水'] },
  'a-squirrel':   { emoji: '🐿️', name: '松鼠跳跳', flavors: ['抱橡果跑累了，先一起喝水歇歇', '橡果太硬，喝口水送服'] },
  'a-koala':      { emoji: '🐨', name: '考拉抱抱', flavors: ['困到睁不开眼…帮我递一杯水嘛', '抱树太累，喝水才有劲'] },
  'a-zombie':     { emoji: '🧟', name: '僵尸丧丧', flavors: ['喝...水...不要...脑子...', '丧到底...先...来口水...'] },
  'a-butterfly':  { emoji: '🦋', name: '蝴蝶飞飞', flavors: ['翅膀有点重了，我们一起补水', '花蜜不解渴，水才管用'] },
  'a-octopus':    { emoji: '🐙', name: '章鱼小八', flavors: ['八只爪子举着八杯水等你呢', '同时举八杯都不累，你一杯吧'] },
  'a-crab':       { emoji: '🦀', name: '螃蟹横横', flavors: ['横着跑去拿水，你直走更快啦', '海边大厨提醒你：补水！'] },
  'a-unicorn':    { emoji: '🦄', name: '独角兽彩虹', flavors: ['喝水会变彩虹哦，要不要试试', '我祝福过的水超甜'] },
  'a-bee':        { emoji: '🐝', name: '蜜蜂嗡嗡', flavors: ['采蜜累死了，先来口水歇一下', '嗡嗡嗡，水声好听'] },
  'a-fox':        { emoji: '🦊', name: '狐狸小红', flavors: ['我藏了一杯水给你，快来取', '尾巴一摆就是「该喝水了」'] },
  'a-ghost':      { emoji: '👻', name: '小幽灵噗噗', flavors: ['我喝水都漏掉了，你帮我喝吧', '飘啊飘的，路过提醒你'] },
  'a-panda':      { emoji: '🐼', name: '熊猫圆圆', flavors: ['竹叶咬干了，需要补水', '黑白小胖等你一起喝'] },
  'a-mummy':      { emoji: '🪦', name: '木乃伊裹裹', flavors: ['包成粽子也照样口渴，喝吧', '几千年没喝水了，你别学我'] },
  'a-dolphin':    { emoji: '🐬', name: '海豚跳跳', flavors: ['看到你了，记得喝水哟', '跃出海面提醒你：喝水'] },
  'a-lion':       { emoji: '🦁', name: '狮子王凯撒', flavors: ['草原之王令你：现在，喝水', '吼一声，去举杯！'] },
  'a-seahorse':   { emoji: '🐴', name: '海马摇摇', flavors: ['倒立游过来提醒你喝水', '优雅地摇摆，请你喝杯'] },
  'a-dino':       { emoji: '🦖', name: '小恐龙阿雷', flavors: ['远古恐龙都喝水，你也不能少', '小爪子举不起大杯子，你帮我'] },
  'a-flamingo':   { emoji: '🦩', name: '火烈鸟粉粉', flavors: ['我等你呢，先去喝口水吧', '单腿站累了，水水救命'] },
  'a-orangutan':  { emoji: '🦧', name: '猩猩橙橙', flavors: ['丛林里走累了，喝水不？', '红毛飘飘，提醒你补水'] },
  'a-hedgehog':   { emoji: '🦔', name: '刺猬球球', flavors: ['圆滚滚地等你来喝水', '小刺不扎人，只扎杯子'] },
  'a-shark':      { emoji: '🦈', name: '鲨鱼利齿', flavors: ['我牙利只咬水杯，你快举杯', '咬水杯专家在线提醒'] },
  'a-peacock':    { emoji: '🦚', name: '孔雀蓝蓝', flavors: ['炫给你看，看完该喝水了', '开屏蓝蓝，水水必喝'] },
  'a-bear':       { emoji: '🐻', name: '棕熊大帅', flavors: ['蜂蜜罐换成水照样喝，你也是', '大爪子敲杯子：喝！'] },
  'a-rabbit':     { emoji: '🐇', name: '兔兔白白', flavors: ['啃萝卜噎到了，要喝水', '蹦哒提醒你：来一杯'] },
  'a-godzilla':   { emoji: '🦎', name: '哥斯拉酷拉', flavors: ['喷火前先喝水冷却一下', '巨兽在线提醒你补水'] },
  'a-chick':      { emoji: '🐤', name: '小鸡黄黄', flavors: ['啾啾啾…我口渴啦', '小爪子端不动，你来'] },
  'a-raccoon':    { emoji: '🦝', name: '浣熊小偷', flavors: ['我把你的水偷走了，再倒一杯吧', '黑眼罩提醒：补水！'] },
  'a-snake':      { emoji: '🐍', name: '蛇蛇丝丝', flavors: ['醒了一下提醒你：喝水', '盘起来也没忘记你'] },
  'a-owl':        { emoji: '🦉', name: '猫头鹰智者', flavors: ['夜里也别忘了喝水', '智者建议：水水必备'] },
  'a-turtle':     { emoji: '🐢', name: '海龟大爷', flavors: ['慢慢喝，我陪你', '百岁秘诀就是按时喝水'] },
  'a-alpaca':     { emoji: '🦙', name: '草泥马毛毛', flavors: ['...？...哦对，要喝水', '高原小可爱提醒你'] },
  'a-parrot':     { emoji: '🦜', name: '鹦鹉七彩', flavors: ['喝水！喝水！喝水！', '彩虹小鸟学舌中：补水'] },
  'a-jellyfish':  { emoji: '🪼', name: '水母飘飘', flavors: ['我浮在水里想到你了，喝水吧', '果冻精灵在线提醒'] },
  'a-bigfoot':    { emoji: '👣', name: '大脚怪毛球', flavors: ['山林深处都不忘补水，你也别忘', '神秘巨人提醒你：来一杯'] },
  'a-ladybug':    { emoji: '🐞', name: '瓢虫点点', flavors: ['幸运小红点提醒你：来杯水', '红背壳的小幸运'] },
  'a-bat':        { emoji: '🦇', name: '吸血蝙蝠德古', flavors: ['我改喝果汁了，你呢？', '夜行小可爱提醒你'] },
  'a-kong':       { emoji: '🦍', name: '金刚老大', flavors: ['帝国大厦顶上都喝水，你快喝', '大金刚敲胸：喝！'] },
  'a-sloth':      { emoji: '🦥', name: '树懒慢慢', flavors: ['慢慢…来…一口…水…', '...慢...慢...也...要...喝...'] },
  'a-hamster':    { emoji: '🐹', name: '仓鼠胖胖', flavors: ['葵花子吃完了，该喝水了', '腮帮子塞满，先喝口水'] },
  'a-robot':      { emoji: '🤖', name: '机器人 R-2', flavors: ['我的水箱需要补充，你也是', '系统检测：你需要补水'] },
  'a-alien':      { emoji: '👽', name: '外星人 ZZ', flavors: ['地球的水好喝，你试试', '我家星球的水是绿色的'] },
  'a-otter':      { emoji: '🦦', name: '水獭奇奇', flavors: ['抱着石头想你了，记得喝水', '浮在水面等你陪我喝'] },
  'a-penguin':    { emoji: '🐧', name: '企鹅波波', flavors: ['冰天雪地的小绅士也要补水', '蹒跚提醒你：水水'] },
};

// 通用 body 文案 — 任何小伙伴都能套用。
// 风格：直接、有点撒娇 / 生气 / 哀求，把用户拉回来喝水
const GENERIC_BODIES = [
  // —— 召唤型（直接喊你过来） ——
  '来喝水咯！',
  '快！现在！立刻！喝水！',
  '别装作没看到，喝水',
  '是的就是你，过来喝水',
  '听见了吗？喝—水—去',
  '别让我喊第二遍',
  // —— 生气 / 不耐烦 ——
  '你还不来喝水？😤',
  '又忘了是吧？😠',
  '你是真的不打算理我了吗',
  '我等到生气了',
  '这都几个小时了，水呢',
  '行，你继续摆烂，我看着',
  // —— 哀求 / 撒娇 ——
  '你再不喝水我就要死了…',
  '快没力气说话了…来一口…',
  '求求了，喝口水吧',
  '我快撑不住了，快喝',
  '你忍心看我灰下去吗？',
  '一口就行，救救我',
  // —— 戳穿 / 嘲讽 ——
  '别假装在忙，喝水',
  '手能拿手机，端不起杯子？',
  '一杯水的功夫，真的没空？',
  '我都不好意思继续提醒了',
  '不喝水你皮肤要造反的',
  // —— 关心 / 温柔（少量保留，避免太凶） ——
  '想我了吗？喝水就当陪我',
  '半小时没喝了，来一杯吧',
  '一杯水，给晚上的自己一份温柔',
];

const DEFAULT_ID = 'a-kiwi';

/** 给指定 companion 拼一条 push 文案。companion 不存在时回退到 a-kiwi（每个用户的起始角色）。 */
export const buildMessageFor = (companionId: string | undefined): { title: string; body: string } => {
  const id = companionId && ANIMAL_INFO[companionId] ? companionId : DEFAULT_ID;
  const info = ANIMAL_INFO[id];
  const allBodies = [...info.flavors, ...GENERIC_BODIES];
  const body = allBodies[Math.floor(Math.random() * allBodies.length)];
  return {
    title: `${info.emoji} ${info.name}`,
    body,
  };
};
