import type { CharacterId } from '../components/Character';

export type Animal = {
  id: string;
  name: string;
  emoji: string; // fallback only
  hint?: string;
  customArt: CharacterId;
};

// 第 0、1 位永久固定（奇异鸟、太阳鱼）。其余打乱。每完成 2 天饮水目标解锁下一位。
export const ANIMALS: Animal[] = [
  { id: 'a-kiwi', name: '奇异鸟咕咕', emoji: '🥝', hint: '长嘴巴小可爱，喜欢和你一起喝水', customArt: 'kiwi' },
  { id: 'a-mola', name: '太阳鱼曼波', emoji: '🐟', hint: '大海里的圆滚滚，悠哉悠哉漂浮', customArt: 'mola' },
  // —— 以下打乱 ——
  { id: 'a-dragon', name: '中国龙小龙', emoji: '🐉', hint: '腾云驾雾间不忘喝口水', customArt: 'dragon' },
  { id: 'a-squirrel', name: '松鼠跳跳', emoji: '🐿️', hint: '抱橡果蹦来蹦去的活泼派', customArt: 'squirrel' },
  { id: 'a-koala', name: '考拉抱抱', emoji: '🐨', hint: '抱树打瞌睡的灰胖子', customArt: 'koala' },
  { id: 'a-zombie', name: '僵尸丧丧', emoji: '🧟', hint: '慢吞吞的找水，喝水不喝脑', customArt: 'zombie' },
  { id: 'a-butterfly', name: '蝴蝶飞飞', emoji: '🦋', hint: '花丛中飞舞的彩色精灵', customArt: 'butterfly' },
  { id: 'a-octopus', name: '章鱼小八', emoji: '🐙', hint: '八只手能同时举八杯水', customArt: 'octopus' },
  { id: 'a-crab', name: '螃蟹横横', emoji: '🦀', hint: '横着走路的海边大厨', customArt: 'crab' },
  { id: 'a-unicorn', name: '独角兽彩虹', emoji: '🦄', hint: '喝了我祝福的水会变彩虹', customArt: 'unicorn' },
  { id: 'a-bee', name: '蜜蜂嗡嗡', emoji: '🐝', hint: '采蜜累了来一口水的小工蜂', customArt: 'bee' },
  { id: 'a-fox', name: '狐狸小红', emoji: '🦊', hint: '偷偷藏一杯留到晚上', customArt: 'fox' },
  { id: 'a-ghost', name: '小幽灵噗噗', emoji: '👻', hint: '喝水会从身体里漏出来', customArt: 'ghost' },
  { id: 'a-panda', name: '熊猫圆圆', emoji: '🐼', hint: '竹叶上的露水也是水', customArt: 'panda' },
  { id: 'a-mummy', name: '木乃伊裹裹', emoji: '🪦', hint: '包成粽子的古老朋友，依然口渴', customArt: 'mummy' },
  { id: 'a-dolphin', name: '海豚跳跳', emoji: '🐬', hint: '海里跃出来的微笑使者', customArt: 'dolphin' },
  { id: 'a-lion', name: '狮子王凯撒', emoji: '🦁', hint: '草原之王也要按时补水', customArt: 'lion' },
  { id: 'a-seahorse', name: '海马摇摇', emoji: '🐴', hint: '倒立游泳的优雅小马', customArt: 'seahorse' },
  { id: 'a-dino', name: '小恐龙阿雷', emoji: '🦖', hint: '远古时代来的小不点', customArt: 'dino' },
  { id: 'a-flamingo', name: '火烈鸟粉粉', emoji: '🦩', hint: '单腿站立的优雅', customArt: 'flamingo' },
  { id: 'a-orangutan', name: '猩猩橙橙', emoji: '🦧', hint: '红毛长臂的丛林朋友', customArt: 'orangutan' },
  { id: 'a-hedgehog', name: '刺猬球球', emoji: '🦔', hint: '圆滚滚的小刺球，不扎人哦', customArt: 'hedgehog' },
  { id: 'a-shark', name: '鲨鱼利齿', emoji: '🦈', hint: '牙齿利但只会咬水杯', customArt: 'shark' },
  { id: 'a-peacock', name: '孔雀蓝蓝', emoji: '🦚', hint: '开屏炫美的海军蓝', customArt: 'peacock' },
  { id: 'a-bear', name: '棕熊大帅', emoji: '🐻', hint: '蜂蜜罐装满了水也照样喝', customArt: 'bear' },
  { id: 'a-rabbit', name: '兔兔白白', emoji: '🐇', hint: '啃萝卜也要喝水的长耳朵', customArt: 'rabbit' },
  { id: 'a-godzilla', name: '哥斯拉酷拉', emoji: '🦎', hint: '喷火前先喝水冷却一下', customArt: 'godzilla' },
  { id: 'a-chick', name: '小鸡黄黄', emoji: '🐤', hint: '刚出壳的毛绒小不点', customArt: 'chick' },
  { id: 'a-raccoon', name: '浣熊小偷', emoji: '🦝', hint: '戴黑眼罩的夜行小探险家', customArt: 'raccoon' },
  { id: 'a-snake', name: '蛇蛇丝丝', emoji: '🐍', hint: '盘起来打盹儿的小机灵', customArt: 'snake' },
  { id: 'a-owl', name: '猫头鹰智者', emoji: '🦉', hint: '夜里也会偷偷喝两口', customArt: 'owl' },
  { id: 'a-turtle', name: '海龟大爷', emoji: '🐢', hint: '慢慢游、活百年的长寿者', customArt: 'turtle' },
  { id: 'a-alpaca', name: '草泥马毛毛', emoji: '🦙', hint: '一脸困惑的高原小可爱', customArt: 'alpaca' },
  { id: 'a-parrot', name: '鹦鹉七彩', emoji: '🦜', hint: '会说话的彩虹小鸟', customArt: 'parrot' },
  { id: 'a-jellyfish', name: '水母飘飘', emoji: '🪼', hint: '海里飘啊飘的果冻精灵', customArt: 'jellyfish' },
  { id: 'a-bigfoot', name: '大脚怪毛球', emoji: '👣', hint: '山林深处的神秘巨人，悄悄喝水', customArt: 'bigfoot' },
  { id: 'a-ladybug', name: '瓢虫点点', emoji: '🐞', hint: '红色背壳的幸运小红点', customArt: 'ladybug' },
  { id: 'a-bat', name: '吸血蝙蝠德古', emoji: '🦇', hint: '不喝血改喝果汁，健康', customArt: 'bat' },
  { id: 'a-kong', name: '金刚老大', emoji: '🦍', hint: '帝国大厦顶上喝水的那位', customArt: 'kong' },
  { id: 'a-sloth', name: '树懒慢慢', emoji: '🦥', hint: '慢动作之王，喝水也要慢慢来', customArt: 'sloth' },
  { id: 'a-hamster', name: '仓鼠胖胖', emoji: '🐹', hint: '腮帮子塞满葵花子的小可爱', customArt: 'hamster' },
  { id: 'a-robot', name: '机器人 R-2', emoji: '🤖', hint: '我的水箱需要 2L 才能运行', customArt: 'robot' },
  { id: 'a-alien', name: '外星人 ZZ', emoji: '👽', hint: '我家星球的水都是绿色的', customArt: 'alien' },
  { id: 'a-otter', name: '水獭奇奇', emoji: '🦦', hint: '抱着小石头浮在水面', customArt: 'otter' },
  { id: 'a-penguin', name: '企鹅波波', emoji: '🐧', hint: '冰天雪地里的小绅士', customArt: 'penguin' },
];

// === Token 解锁系统 ===
// 每 2 天达标 → 获得 1 个解锁机会（token）
// starter（kiwi）永久免费，不消耗 token
// 用户在 collection 页用 token 选解锁哪只动物

/** 累计获得的 token 总数 */
export const earnedTokens = (completedDays: number): number =>
  Math.floor(completedDays / 2);

/** 当前可用 token = 累计获得 - 已用（已解锁数 - 1 个 starter） */
export const availableTokens = (completedDays: number, unlockedCount: number): number =>
  Math.max(0, earnedTokens(completedDays) - Math.max(0, unlockedCount - 1));

/** 距离下一个 token 还需几天 */
export const daysToNextToken = (completedDays: number): number => {
  const next = (Math.floor(completedDays / 2) + 1) * 2;
  return next - completedDays;
};

// 保留旧 API 供个别地方继续用（已解锁数显示）
export const unlockCount = (completedDays: number): number => {
  return Math.min(ANIMALS.length, 1 + Math.floor(completedDays / 2));
};

export const daysToNextUnlock = daysToNextToken;
