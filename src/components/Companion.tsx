import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import {
  AlertTriangle, Coffee, Droplet, Flame, GlassWater, Heart,
  PartyPopper, Sparkles, Star, ThumbsUp, Trophy, Zap,
  type LucideProps,
} from 'lucide-react';
import Character, { Mood } from './Character';
import { Animal } from '../data/animals';

export type { Mood };

// 一条台词：纯文本（继续用 emoji 也行）或带 icon 前缀的对象
type Line = string | { icon: ComponentType<LucideProps>; text: string; color?: string };

// 复活爆发：4 emoji + 4 lucide icon 混排
type BurstItem = string | { Icon: ComponentType<LucideProps>; color: string };
const REVIVE_BURST: BurstItem[] = [
  '💧', '🎉', '🌈', '💖',
  { Icon: Sparkles, color: '#3b82f6' },
  { Icon: Star, color: '#facc15' },
  { Icon: Heart, color: '#ec4899' },
  { Icon: Trophy, color: '#f59e0b' },
];

// 进入动画：开心（<30min）和濒死（>=30min）两套
const HAPPY_ENTRANCE_BURST: BurstItem[] = [
  '✨', '☀️', '⭐', '💫',
  { Icon: Sparkles, color: '#facc15' },
  { Icon: Star, color: '#f59e0b' },
  { Icon: Zap, color: '#fbbf24' },
  { Icon: Heart, color: '#ec4899' },
];
const DYING_ENTRANCE_BURST: BurstItem[] = [
  '💀', '🦴', '😵', '☠️', '💀', '🦴', '😵', '☠️',
];

const HAPPY_ENTRANCE_MSGS = [
  '你终于回来了！快告诉我你喝水了吗！！',
  '欸欸欸！你回来啦！喝水了没！',
  '我等你好久了！你喝水了吗！很重要！',
  '终于！我以为你忘了我！喝了多少？',
  '啊！是你！你喝水了吧！！快说！',
];
const DYING_ENTRANCE_MSGS = [
  '你……你终于回来了……我快不行了……',
  '呜……来得太晚了……我……我要死了……',
  '好久……好久没见……渴死了……救我……',
  '我以为你……不要我了……好渴……',
  '你回来了……我……还撑着……快给水……',
];

type Props = {
  animal: Animal;
  lastEntryTs: number | null;
  drunkMl: number;
  remainingMl: number;
  goalMl: number;
  pct: number;
  minutesSinceLastDrink: number | null;
  pace: 'behind' | 'on-track' | 'ahead' | null;
};

// 30 min 没喝水 → 濒死（动物变灰）
const DYING_THRESHOLD_MIN = 30;
// 15 min 没喝水 → 喊渴（还没死）
const THIRSTY_THRESHOLD_MIN = 15;

const MESSAGES: Record<Mood, Line[]> = {
  drinking: [
    '咕咚~ 我也来一口', '嗯~ 真甜！', '一起喝水真好~', '哇 这水真好喝',
    '咕咚咕咚……好喝！', '这口水喝得我飘飘然', '喝水的声音好治愈啊',
    '啊～ 比奶茶还香', '我就知道你会喝的！', '喝了这口，今天值了',
    '这才对嘛，早就该喝了', '终于！等你等到花都谢了',
    { icon: GlassWater, text: '干杯！', color: '#3aa6dd' },
    { icon: Droplet, text: '清凉一口，治愈我了', color: '#3aa6dd' },
    { icon: Coffee, text: '嗯，比咖啡更让我精神', color: '#92400e' },
  ],
  celebrating: [
    '🎉 我们做到了！', '今天目标完成，棒棒！', '喝够啦，开心~', '你真厉害！',
    '我就说你行的吧！', '收工！今天完美！', '我要帮你颁奖！虽然我没有奖',
    '完成！可以骄傲一下了', '你今天的表现让我热泪盈眶（眼泪是水）',
    '目标达成，今晚可以睡个好觉了', '我们是最棒的搭档！',
    '哼，早知道你能喝完，我就不担心了（才没有）',
    '你看，听我的没错吧', '感动，终于不让我操心了',
    { icon: Trophy, text: '今天达标，我给你颁奖', color: '#f59e0b' },
    { icon: PartyPopper, text: '完美收工！', color: '#ec4899' },
    { icon: Sparkles, text: '完成！闪闪发光的你', color: '#a855f7' },
    { icon: Star, text: '满分日，记下这一天', color: '#facc15' },
  ],
  thirsty: [
    '我口渴了…', '好久没喝水了，要不要来一杯？', '嘴巴干干的，咕嘟咕嘟…', '我们一起喝一杯吧？',
    '嗨……喝口水嘛', '我感觉我快变成干货了', '水呢水呢……',
    '就一小口也好嘛', '喉咙已经开始抗议了', '风一吹我就碎了那种渴',
    '求求了，喝一口吧', '我在这里发呆其实是在等你喝水',
    '你是不是忘了我的存在？！', '这都不喝，你皮肤不要了？',
    '不喝水的人类我见过，但没见过这么不喝的',
    { icon: Droplet, text: '一口水的距离', color: '#3aa6dd' },
    { icon: AlertTriangle, text: '渴情提示：嘴干舌燥', color: '#f59e0b' },
  ],
  encouraging: [
    '再喝一杯就追上啦', '我相信你，加油！', '别忘了喝水哦', '差一点就达标啦',
    '慢慢来，但别太慢', '你可以的！（我觉得）', '加把劲，水等着你呢',
    '别放弃，我都没放弃你', '今天还有机会追回来的！', '一杯一杯慢慢来嘛',
    '我在给你加油，虽然你可能没注意', '不急不急，但是要喝',
    '落后了哦，有点丢人', '这进度……说出去我都不好意思',
    '追不上的话，今晚别想睡好觉', '喝水都懒，那你干嘛都懒？',
    { icon: Flame, text: '冲一下，别让我担心', color: '#f97316' },
    { icon: Zap, text: '动起来，再来一杯', color: '#eab308' },
    { icon: Heart, text: '加油 加油，我陪你', color: '#ec4899' },
  ],
  happy: [
    '节奏很棒，继续保持！', '做得很好哦', '今天的你最棒', '继续加油~',
    '哇 你今天好厉害', '就该这样！很满意', '我为你感到骄傲（认真的）',
    '这节奏，稳了！', '你喝水的样子特别帅', '完美！我无话可说',
    '超出我的预期了！', '继续这样，我就放心了',
    '这才是正常人该有的样子', '行，总算没让我失望',
    '我就知道你不是那种不喝水的废物', '哼，勉强及格',
    { icon: ThumbsUp, text: '今天的你状态满分', color: '#16a34a' },
    { icon: Star, text: '稳得不行，继续', color: '#facc15' },
    { icon: Sparkles, text: '小步快跑，节奏漂亮', color: '#3b82f6' },
  ],
  idle: [
    '今天也要好好喝水', '我陪着你', '想喝水的时候就来找我', '记得喝水哦~',
    '……（在发呆）', '我刚才在想什么来着……算了', '你在干嘛，我在这里呢',
    '就这样待着也挺好的', '有我在你不会渴到的', '我数了一下，今天云有点多',
    '喝水这件事，交给我来提醒', '没事，我不急，你不急就行了……（其实有点急）',
    '闲着闲着，来喝口水？',
    '别以为我没在盯着你', '不喝水的人我见不起，你不会是吧？',
    '我在看着你呢，不许偷懒', '就算忙，水也是要喝的，懂吗',
    { icon: Heart, text: '我在这等你呢', color: '#ec4899' },
    { icon: Coffee, text: '咖啡可以，但水更要', color: '#92400e' },
  ],
  dying: [
    '好渴啊…快不行了…', '救命…给我水…', '我...快...枯死了...', '咕…喝口水吧…求你…',
    '你回来了…我快撑不住了…', '半小时没喝了…我灰了…', '我等你等到变灰了…一杯水救命…',
    '…………（已无力说话）', '我的灵魂在渴望水分……', '就算一滴也好……',
    '我感觉我在慢慢消失……', '下辈子……我要做一条鱼……',
    '如果我不行了……记得多喝水……', '快……救……我……',
    '你……你还有脸不喝水……', '我都这样了……你还不动……',
    '等我死透了你会后悔的……', '不喝水……真的……很蠢……（最后的力气说完了）',
    { icon: AlertTriangle, text: '快...不行了...', color: '#dc2626' },
    { icon: Zap, text: '能量耗尽中…', color: '#a16207' },
  ],
};

const computeMood = (args: {
  pct: number;
  drunkMl: number;
  pace: 'behind' | 'on-track' | 'ahead' | null;
  minutesSinceLastDrink: number | null;
  drinkingPulse: boolean;
}): Mood => {
  if (args.drinkingPulse) return 'drinking';
  if (args.pct >= 1) return 'celebrating';
  // 今天还没喝水 → 濒死
  if (args.drunkMl === 0) return 'dying';
  // 30 min 以上没喝 → 濒死
  if (args.minutesSinceLastDrink !== null && args.minutesSinceLastDrink >= DYING_THRESHOLD_MIN) return 'dying';
  // 15-30 min → 渴
  if (args.minutesSinceLastDrink !== null && args.minutesSinceLastDrink >= THIRSTY_THRESHOLD_MIN) return 'thirsty';
  if (args.pace === 'behind') return 'encouraging';
  if (args.pace === 'ahead') return 'happy';
  return 'idle';
};

const renderLine = (line: Line): { id: string; node: ReactNode } => {
  if (typeof line === 'string') return { id: line, node: line };
  const Icon = line.icon;
  return {
    id: `${line.icon.displayName ?? 'icon'}::${line.text}`,
    node: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Icon size={14} strokeWidth={2} color={line.color ?? 'currentColor'} />
        <span>{line.text}</span>
      </span>
    ),
  };
};

const pickMessage = (mood: Mood, ctx: { remainingMl: number; drunkMl: number }): { id: string; node: ReactNode } => {
  const list = MESSAGES[mood];
  const idx = Math.floor(Math.random() * list.length);
  const item = list[idx];
  // 字符串型才能拼前缀；icon 型保持原样不修改
  if (typeof item === 'string') {
    let text = item;
    if (mood === 'encouraging' && ctx.remainingMl > 0 && Math.random() < 0.5) {
      text = `还差 ${ctx.remainingMl} ml，${item}`;
    } else if (mood === 'celebrating' && ctx.drunkMl > 0 && Math.random() < 0.4) {
      text = `今天喝了 ${ctx.drunkMl} ml，${item}`;
    }
    return { id: `${mood}-${idx}-${text}`, node: text };
  }
  return renderLine(item);
};

export default function Companion({
  animal,
  lastEntryTs,
  drunkMl,
  remainingMl,
  goalMl: _goalMl,
  pct,
  minutesSinceLastDrink: _minutesSinceLastDrinkProp,
  pace,
}: Props) {
  const [drinkingPulse, setDrinkingPulse] = useState(false);
  const [revivalBurst, setRevivalBurst] = useState(false);
  const [entranceBurst, setEntranceBurst] = useState<'happy' | 'dying' | null>(null);
  const [entranceMsg, setEntranceMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const lastSeenTsRef = useRef<number | null>(null);
  const wasDyingRef = useRef(true);
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastEntryTs && lastEntryTs !== lastSeenTsRef.current) {
      lastSeenTsRef.current = lastEntryTs;
      const isFresh = Date.now() - lastEntryTs < 6000;
      if (isFresh) {
        setDrinkingPulse(true);
        const t = setTimeout(() => setDrinkingPulse(false), 4500);
        return () => clearTimeout(t);
      }
    }
  }, [lastEntryTs]);

  // 每 30 秒 tick 一次，让 mood 自己重算（30 min 阈值 → 至少每 30s 检查一次）
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // 触发进入动画（首次挂载 or 从后台返回 > 5s）
  const triggerEntrance = useCallback((ts: number | null) => {
    const minsSince = ts ? Math.floor((Date.now() - ts) / 60000) : null;
    const type = (minsSince !== null && minsSince < 30) ? 'happy' : 'dying';
    const msgs = type === 'happy' ? HAPPY_ENTRANCE_MSGS : DYING_ENTRANCE_MSGS;
    const msg = msgs[Math.floor(Math.random() * msgs.length)];
    setEntranceBurst(type);
    setEntranceMsg(msg);
    const t1 = setTimeout(() => setEntranceBurst(null), 3200);
    const t2 = setTimeout(() => setEntranceMsg(null), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // 首次挂载 → 触发进入动画
  useEffect(() => {
    return triggerEntrance(lastEntryTs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 用户切回 tab / 从后台回到 app → 立刻重算 + 触发进入动画
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') hiddenAtRef.current = Date.now();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setTick((x) => x + 1);
        const hiddenFor = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : Infinity;
        if (hiddenFor > 5000) triggerEntrance(lastEntryTs);
        hiddenAtRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', onHide);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [lastEntryTs, triggerEntrance]);

  // 自己算 minutesSinceLastDrink，依赖 tick 让它每 30s 自动新鲜
  const liveMinutesSinceLastDrink = useMemo(() => {
    if (!lastEntryTs) return null;
    return Math.floor((Date.now() - lastEntryTs) / 60000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEntryTs, tick]);

  const mood = useMemo(
    () => computeMood({
      pct,
      drunkMl,
      pace,
      minutesSinceLastDrink: liveMinutesSinceLastDrink,
      drinkingPulse,
    }),
    [pct, drunkMl, pace, liveMinutesSinceLastDrink, drinkingPulse],
  );

  // 复活：mood 从 dying 转到任何其它状态 → 触发狂喜 emoji 爆发
  useEffect(() => {
    const wasDying = wasDyingRef.current;
    if (wasDying && mood !== 'dying') {
      setRevivalBurst(true);
      const t = setTimeout(() => setRevivalBurst(false), 3000);
      wasDyingRef.current = false;
      return () => clearTimeout(t);
    }
    wasDyingRef.current = mood === 'dying';
  }, [mood]);

  const message = useMemo(
    () => pickMessage(mood, { remainingMl, drunkMl }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mood, tick, remainingMl, drunkMl],
  );

  const displayMsg = entranceMsg
    ? { id: `entrance-${entranceMsg}`, node: entranceMsg as ReactNode }
    : message;

  return (
    <div className="comp-wrap">
      <div className={`comp-bubble${entranceMsg ? ' comp-bubble--entrance' : ''}`} key={`${mood}-${displayMsg.id}`}>{displayMsg.node}</div>
      <div className="comp-art">
        <Character id={animal.customArt} mood={mood} size={220} />
      </div>
      {drinkingPulse && (
        <div className="drink-fx" aria-hidden>
          <span className="fx-drop">💧</span>
          <span className="fx-drop fx-drop-2">💦</span>
          <span className="fx-drop fx-drop-3">💧</span>
        </div>
      )}
      {revivalBurst && (
        <div className="revive-fx" aria-hidden>
          {REVIVE_BURST.map((item, i) => (
            <span
              key={i}
              className="fx-revive"
              style={{
                left: '50%',
                top: '40%',
                animationDelay: `${i * 0.08}s`,
                ['--ang' as any]: `${(i * 45)}deg`,
              }}
            >
              {typeof item === 'string'
                ? item
                : <item.Icon size={26} color={item.color} fill={item.color} fillOpacity={0.25} strokeWidth={2.2} />}
            </span>
          ))}
        </div>
      )}
      {entranceBurst && (
        <div className="revive-fx" aria-hidden>
          {(() => {
            const items = entranceBurst === 'happy' ? HAPPY_ENTRANCE_BURST : DYING_ENTRANCE_BURST;
            const count = items.length;
            return items.map((item, i) => {
              let inlineStyle: React.CSSProperties;
              if (entranceBurst === 'happy') {
                // 开心：上半圆扇形，从中心往上抛 + 重力下坠 — 整齐不乱
                // 角度从 -150° 到 -30°（只往上半边喷），均匀分布
                const t = count > 1 ? i / (count - 1) : 0.5;
                const angDeg = -150 + t * 120; // -150° (左上) → -30° (右上)
                const angRad = (angDeg * Math.PI) / 180;
                const dist = 140;
                const vx = Math.cos(angRad) * dist;
                const peakY = Math.sin(angRad) * dist; // 顶点（负数=上面）
                const finalY = peakY + 90;             // 重力把它拉下来
                inlineStyle = {
                  left: '50%',
                  top: '55%',
                  animationDelay: `${i * 0.05}s`,
                  ['--vx' as any]: `${vx}px`,
                  ['--peak-y' as any]: `${peakY}px`,
                  ['--final-y' as any]: `${finalY}px`,
                };
              } else {
                // 濒死：从角色周围一圈底部均匀生成，**直接向上飘**（不从身上发出）
                // 用 left 把生成位置摊开到角色两侧，每个粒子自己只走 Y 轴
                const center = (count - 1) / 2;
                const spreadPx = (i - center) * 30; // -105 ~ +105px 摊开在身体两侧
                inlineStyle = {
                  left: `calc(50% + ${spreadPx}px)`,
                  top: '85%', // 角色脚下
                  animationDelay: `${i * 0.16}s`, // 错峰一个一个升起
                };
              }
              return (
                <span
                  key={i}
                  className={`fx-revive fx-entrance-${entranceBurst}`}
                  style={inlineStyle}
                >
                  {typeof item === 'string'
                    ? item
                    : <item.Icon size={26} color={item.color} fill={item.color} fillOpacity={0.25} strokeWidth={2.2} />}
                </span>
              );
            });
          })()}
        </div>
      )}

      <style>{`
        .comp-wrap {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding-top: 8px;
        }
        .comp-bubble {
          position: relative;
          background: white;
          border-radius: 20px;
          padding: 12px 18px;
          box-shadow: var(--shadow-card);
          font-size: 14px;
          font-weight: 500;
          max-width: 240px;
          text-align: center;
          animation: bubble-pop 0.35s cubic-bezier(.2,1.4,.4,1);
          color: var(--text);
        }
        .comp-bubble::after {
          content: '';
          position: absolute;
          bottom: -7px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 9px solid transparent;
          border-right: 9px solid transparent;
          border-top: 9px solid white;
        }
        .comp-art { margin-top: 6px; }
        @keyframes bubble-pop {
          0%   { opacity: 0; transform: scale(0.85) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .drink-fx {
          position: absolute;
          top: 30%;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: none;
          display: flex;
          gap: 16px;
          font-size: 24px;
        }
        .fx-drop { animation: fx-rise 1.6s ease-out forwards; }
        .fx-drop-2 { animation-delay: 0.15s; }
        .fx-drop-3 { animation-delay: 0.3s; }
        @keyframes fx-rise {
          0%   { opacity: 0; transform: translateY(0) scale(0.6); }
          25%  { opacity: 1; transform: translateY(-12px) scale(1); }
          100% { opacity: 0; transform: translateY(-60px) scale(0.8); }
        }

        /* 进入气泡：稍大一点 + 轻微高亮 */
        .comp-bubble--entrance {
          font-size: 15px;
          animation: bubble-entrance 0.45s cubic-bezier(.2,1.5,.4,1);
        }
        @keyframes bubble-entrance {
          0%   { opacity: 0; transform: scale(0.7) translateY(12px); }
          60%  { transform: scale(1.06) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* 复活爆发：emoji 从中心向 8 个方向飞散 */
        .revive-fx {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: visible;
        }
        .fx-revive {
          position: absolute;
          font-size: 26px;
          transform: translate(-50%, -50%);
          animation: fx-burst 1.6s cubic-bezier(.2,.8,.2,1) forwards;
          opacity: 0;
        }
        @keyframes fx-burst {
          0%   { opacity: 0; transform: translate(-50%, -50%) rotate(var(--ang)) translateY(0) rotate(calc(-1 * var(--ang))) scale(0.4); }
          20%  { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--ang)) translateY(-120px) rotate(calc(-1 * var(--ang))) scale(1.2); }
        }

        /* 开心进入：上半圆扇形喷出 → 重力下坠 — 干净不乱 */
        .fx-entrance-happy {
          font-size: 26px;
          animation: fx-confetti 1.8s cubic-bezier(.25,.6,.4,1) forwards !important;
        }
        @keyframes fx-confetti {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(0.4);
          }
          15% {
            opacity: 1;
          }
          45% {
            /* 抛物线顶点：到达 peak-y（负数=上方） */
            transform: translate(-50%, -50%)
              translate(calc(var(--vx, 0px) * 0.85), var(--peak-y, -100px))
              rotate(180deg)
              scale(1.1);
          }
          100% {
            opacity: 0;
            /* 重力把它拉下来到 final-y */
            transform: translate(-50%, -50%)
              translate(var(--vx, 0px), var(--final-y, 0px))
              rotate(280deg)
              scale(0.75);
          }
        }

        /* 濒死进入：从角色周围底部一圈生成 → 直接向上飘 + 渐隐 */
        .fx-entrance-dying {
          font-size: 22px;
          animation: fx-float-up 2.4s ease-out forwards !important;
        }
        @keyframes fx-float-up {
          0% {
            opacity: 0;
            transform: translate(-50%, 0) scale(0.4);
            filter: blur(1px);
          }
          18% {
            opacity: 0.8;
            transform: translate(-50%, -16px) scale(1);
            filter: blur(0);
          }
          70% {
            opacity: 0.5;
            transform: translate(-50%, -140px) scale(0.95);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -220px) scale(0.7);
            filter: blur(2px);
          }
        }
      `}</style>
    </div>
  );
}
