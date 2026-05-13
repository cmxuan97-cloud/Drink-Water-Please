import { useEffect, useMemo, useRef, useState } from 'react';
import Character, { Mood } from './Character';
import { Animal } from '../data/animals';

export type { Mood };

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

const MESSAGES = {
  drinking: ['咕咚~ 我也来一口', '嗯~ 真甜！', '一起喝水真好~', '哇 这水真好喝'],
  celebrating: ['🎉 我们做到了！', '今天目标完成，棒棒！', '喝够啦，开心~', '你真厉害！'],
  thirsty: ['我口渴了…', '好久没喝水了，要不要来一杯？', '嘴巴干干的，咕嘟咕嘟…', '我们一起喝一杯吧？'],
  encouraging: ['再喝一杯就追上啦', '我相信你，加油！', '别忘了喝水哦', '差一点就达标啦'],
  happy: ['节奏很棒，继续保持！', '做得很好哦', '今天的你最棒', '继续加油~'],
  idle: ['今天也要好好喝水', '我陪着你', '想喝水的时候就来找我', '记得喝水哦~'],
  dying: [
    '好渴啊…快不行了…', '救命…给我水…', '我...快...枯死了...', '咕…喝口水吧…求你…',
    '你回来了…我快撑不住了…', '半小时没喝了…我灰了…', '我等你等到变灰了…一杯水救命…',
  ],
} satisfies Record<Mood, string[]>;

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

const pickMessage = (mood: Mood, ctx: { remainingMl: number; drunkMl: number }): string => {
  const list = MESSAGES[mood];
  const base = list[Math.floor(Math.random() * list.length)];
  if (mood === 'encouraging' && ctx.remainingMl > 0) {
    return Math.random() < 0.5 ? `还差 ${ctx.remainingMl} ml，${base}` : base;
  }
  if (mood === 'celebrating' && ctx.drunkMl > 0) {
    return Math.random() < 0.4 ? `今天喝了 ${ctx.drunkMl} ml，${base}` : base;
  }
  return base;
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
  const [tick, setTick] = useState(0);
  const lastSeenTsRef = useRef<number | null>(null);
  const wasDyingRef = useRef(true);

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

  // 用户切回 tab / 从后台回到 app → 立刻重算（避免后台被浏览器节流）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setTick((x) => x + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

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

  return (
    <div className="comp-wrap">
      <div className="comp-bubble" key={`${mood}-${message}`}>{message}</div>
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
          {['💧','✨','🎉','🌈','💖','🌟','🎊','💫'].map((emoji, i) => (
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
              {emoji}
            </span>
          ))}
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
      `}</style>
    </div>
  );
}
