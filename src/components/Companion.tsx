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

const MESSAGES = {
  drinking: ['咕咚~ 我也来一口', '嗯~ 真甜！', '一起喝水真好~', '哇 这水真好喝'],
  celebrating: ['🎉 我们做到了！', '今天目标完成，棒棒！', '喝够啦，开心~', '你真厉害！'],
  thirsty: ['我口渴了…', '好久没喝水了，要不要来一杯？', '嘴巴干干的，咕嘟咕嘟…', '我们一起喝一杯吧？'],
  encouraging: ['再喝一杯就追上啦', '我相信你，加油！', '别忘了喝水哦', '差一点就达标啦'],
  happy: ['节奏很棒，继续保持！', '做得很好哦', '今天的你最棒', '继续加油~'],
  idle: ['今天也要好好喝水', '我陪着你', '想喝水的时候就来找我', '记得喝水哦~'],
} satisfies Record<Mood, string[]>;

const computeMood = (args: {
  pct: number;
  pace: 'behind' | 'on-track' | 'ahead' | null;
  minutesSinceLastDrink: number | null;
  drinkingPulse: boolean;
}): Mood => {
  if (args.drinkingPulse) return 'drinking';
  if (args.pct >= 1) return 'celebrating';
  if (args.minutesSinceLastDrink === null || args.minutesSinceLastDrink > 90) return 'thirsty';
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
  minutesSinceLastDrink,
  pace,
}: Props) {
  const [drinkingPulse, setDrinkingPulse] = useState(false);
  const [tick, setTick] = useState(0);
  const lastSeenTsRef = useRef<number | null>(null);

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

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 25000);
    return () => clearInterval(t);
  }, []);

  const mood = useMemo(
    () => computeMood({ pct, pace, minutesSinceLastDrink, drinkingPulse }),
    [pct, pace, minutesSinceLastDrink, drinkingPulse],
  );

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
      `}</style>
    </div>
  );
}
