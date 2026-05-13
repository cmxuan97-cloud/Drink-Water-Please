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

type BurstItem = string | { Icon: ComponentType<LucideProps>; color: string };

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
    '目标达成！不过身体还是需要继续补水的哦',
    '完成啦～但别忘了，喝水不只是为了完成任务',
    '今天达标了！身体随时都需要水，继续喝吧',
    '棒！不过目标只是最低线，多喝一杯更好',
    '完美！不过我还是建议你再喝一杯',
    '你做到了！身体比数字更需要水，别停哦',
    '目标只是起点，保持下去才是真厉害',
    '达标了！我为你骄傲，但我更希望你再喝一口',
    '哼，完成了就觉得可以不喝了？不行的',
    '嗯……完成了。不过现在几点了，还可以继续喝',
    '完成！但你的细胞还在喊渴，听到了吗',
    '很好。目标完成了，但别让我等太久',
    { icon: Trophy, text: '达标了！继续喝不吃亏', color: '#f59e0b' },
    { icon: PartyPopper, text: '完成！顺手再来一杯？', color: '#ec4899' },
    { icon: Droplet, text: '目标达成，但水不嫌多', color: '#3aa6dd' },
    { icon: Sparkles, text: '棒！身体还想要更多水', color: '#a855f7' },
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

  // 复活：mood 从 dying 转到任何其它状态 → 触发 happy 入场动画（彩纸扇形）
  // 用同一个 entranceBurst 状态，确保「加水后」和「从别页回来」都看到新动画，不是旧版
  useEffect(() => {
    const wasDying = wasDyingRef.current;
    if (wasDying && mood !== 'dying') {
      setEntranceBurst('happy');
      const t = setTimeout(() => setEntranceBurst(null), 2200);
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
                // 濒死：从角色周围底部一圈往上飘，但 X / Y / 延迟 / 升起距离都不规则
                // 用预定的非均匀偏移让排列看着有机，不像直尺打出来的
                const X     = [-98, -58, -118, -22, 32, 78, 105, 60];
                const TOP   = [86, 80, 92, 84, 88, 82, 90, 78];
                const DELAY = [0, 0.22, 0.48, 0.10, 0.32, 0.58, 0.16, 0.40];
                const RISE  = [205, 245, 185, 265, 215, 250, 200, 230];
                const DUR   = [2.2, 2.6, 2.0, 2.8, 2.4, 2.5, 2.3, 2.7];
                const k = i % X.length;
                inlineStyle = {
                  left: `calc(50% + ${X[k]}px)`,
                  top: `${TOP[k]}%`,
                  animationDelay: `${DELAY[k]}s`,
                  animationDuration: `${DUR[k]}s`,
                  ['--rise' as any]: `${RISE[k]}px`,
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
          padding-top: 88px;
        }
        .comp-bubble {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border-radius: 20px;
          padding: 12px 18px;
          box-shadow: 0 4px 18px rgba(31, 50, 80, 0.13);
          border: 1px solid rgba(0, 0, 0, 0.06);
          font-size: 14px;
          font-weight: 500;
          width: max-content;
          max-width: 260px;
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
          0%   { opacity: 0; transform: translateX(-50%) scale(0.85) translateY(8px); }
          100% { opacity: 1; transform: translateX(-50%) scale(1) translateY(0); }
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
          0%   { opacity: 0; transform: translateX(-50%) scale(0.7) translateY(12px); }
          60%  { transform: translateX(-50%) scale(1.06) translateY(-2px); }
          100% { opacity: 1; transform: translateX(-50%) scale(1) translateY(0); }
        }

        /* 入场动画爆发容器（dying & happy 共用） */
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
          opacity: 0;
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

        /* 濒死进入：从角色周围底部一圈生成 → 不规则向上飘 + 渐隐
           动画时长 + 升起距离每片不同（inline style 覆盖）*/
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
            transform: translate(-50%, calc(var(--rise, 220px) * -0.08)) scale(1);
            filter: blur(0);
          }
          70% {
            opacity: 0.5;
            transform: translate(-50%, calc(var(--rise, 220px) * -0.62)) scale(0.95);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, calc(-1 * var(--rise, 220px))) scale(0.7);
            filter: blur(2px);
          }
        }
      `}</style>
    </div>
  );
}
