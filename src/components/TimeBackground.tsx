import { useEffect } from 'react';

export type TimeTheme = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

export const themeFromHour = (h: number): TimeTheme => {
  if (h >= 5 && h < 7) return 'dawn';        // 清晨日出
  if (h >= 7 && h < 11) return 'morning';    // 早上
  if (h >= 11 && h < 17) return 'afternoon'; // 下午大太阳
  if (h >= 17 && h < 19) return 'evening';   // 傍晚夕阳
  return 'night';                             // 晚上 (19+ 和 < 5)
};

const GRADIENTS: Record<TimeTheme, string> = {
  dawn:      'linear-gradient(180deg, #ffc8a8 0%, #ffd9b5 25%, #ffe9c8 50%, #d8edec 100%)',
  morning:   'linear-gradient(180deg, #a8d5ed 0%, #c8e3f0 40%, #e3f1f7 80%, #edf6fb 100%)',
  afternoon: 'linear-gradient(180deg, #6cb4e6 0%, #94cbeb 40%, #c0e0f0 80%, #e3f0f7 100%)',
  evening:   'linear-gradient(180deg, #e88a6c 0%, #f0a888 30%, #e8b8a5 55%, #c4a8c8 85%, #8a8db0 100%)',
  night:     'linear-gradient(180deg, #1a2548 0%, #25305a 35%, #2d3a6e 70%, #3a4682 100%)',
};

type Props = { theme?: TimeTheme };

export default function TimeBackground({ theme }: Props) {
  const t = theme ?? themeFromHour(new Date().getHours());
  const isDark = t === 'night' || t === 'evening';

  useEffect(() => {
    const prevBg = document.body.style.background;
    const prevAttach = document.body.style.backgroundAttachment;
    document.body.style.background = GRADIENTS[t];
    document.body.style.backgroundAttachment = 'fixed';
    if (isDark) document.body.classList.add('theme-dark');
    return () => {
      document.body.style.background = prevBg;
      document.body.style.backgroundAttachment = prevAttach;
      document.body.classList.remove('theme-dark');
    };
  }, [t, isDark]);

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {t === 'dawn' && <DawnScene />}
      {t === 'morning' && <MorningScene />}
      {t === 'afternoon' && <AfternoonScene />}
      {t === 'evening' && <EveningScene />}
      {t === 'night' && <NightScene />}
    </div>
  );
}

const float = `
  @keyframes tbg-float {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-10px); }
  }
  @keyframes tbg-twinkle {
    0%,100% { opacity: 0.3; }
    50%     { opacity: 1; }
  }
  @keyframes tbg-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
`;

const Style = () => <style>{float}</style>;

function DawnScene() {
  return (
    <>
      <Style />
      {/* 朝阳半圆从地平线升起 */}
      <svg
        viewBox="0 0 400 400"
        style={{ position: 'absolute', left: '50%', top: '32%', transform: 'translateX(-50%)', width: 360, height: 360, opacity: 0.7 }}
      >
        <defs>
          <radialGradient id="dawn-sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#ffe18a" />
            <stop offset="60%" stopColor="#ffb480" />
            <stop offset="100%" stopColor="#ff8a6c" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={200} cy={200} r={140} fill="url(#dawn-sun)" />
        <circle cx={200} cy={200} r={70} fill="#ffd082" opacity={0.85} />
      </svg>
      {/* 远处云 */}
      <Cloud x={'8%'} y={'18%'} scale={0.7} color="rgba(255,255,255,0.65)" />
      <Cloud x={'72%'} y={'12%'} scale={0.55} color="rgba(255,255,255,0.55)" />
    </>
  );
}

function MorningScene() {
  return (
    <>
      <Style />
      {/* 小太阳右上 */}
      <svg
        viewBox="0 0 100 100"
        style={{ position: 'absolute', right: -10, top: 30, width: 110, height: 110, animation: 'tbg-float 6s ease-in-out infinite' }}
      >
        <circle cx={50} cy={50} r={28} fill="#ffe066" opacity={0.85} />
        <circle cx={50} cy={50} r={20} fill="#fff3b0" />
      </svg>
      {/* 蓬松云朵 */}
      <Cloud x={'5%'} y={'12%'} scale={0.9} />
      <Cloud x={'65%'} y={'25%'} scale={0.7} />
      <Cloud x={'30%'} y={'40%'} scale={0.5} />
    </>
  );
}

function AfternoonScene() {
  return (
    <>
      <Style />
      {/* 大太阳右上 + 光线 */}
      <svg
        viewBox="0 0 200 200"
        style={{ position: 'absolute', right: -30, top: 20, width: 220, height: 220 }}
      >
        <g style={{ transformOrigin: '100px 100px', animation: 'tbg-spin 60s linear infinite' }}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line
              key={a}
              x1={100}
              y1={100}
              x2={100 + Math.cos((a * Math.PI) / 180) * 92}
              y2={100 + Math.sin((a * Math.PI) / 180) * 92}
              stroke="#fff0a8"
              strokeWidth={6}
              strokeLinecap="round"
              opacity={0.5}
            />
          ))}
        </g>
        <circle cx={100} cy={100} r={50} fill="#ffd84a" />
        <circle cx={100} cy={100} r={38} fill="#fff05a" />
      </svg>
      <Cloud x={'10%'} y={'45%'} scale={0.6} color="rgba(255,255,255,0.85)" />
    </>
  );
}

function EveningScene() {
  return (
    <>
      <Style />
      {/* 夕阳大圆从地平线沉下 */}
      <svg
        viewBox="0 0 400 400"
        style={{ position: 'absolute', left: '50%', bottom: '20%', transform: 'translateX(-50%)', width: 400, height: 400 }}
      >
        <defs>
          <radialGradient id="evening-sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#fff0a8" />
            <stop offset="40%" stopColor="#ffa860" />
            <stop offset="100%" stopColor="#ff5a3a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={200} cy={200} r={180} fill="url(#evening-sun)" />
        <circle cx={200} cy={200} r={85} fill="#ff8a5a" opacity={0.9} />
      </svg>
      {/* 远处剪影山 */}
      <svg
        viewBox="0 0 1000 200"
        preserveAspectRatio="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: '8%', width: '100%', height: 100, opacity: 0.4 }}
      >
        <path d="M 0 200 L 0 120 L 200 60 L 400 100 L 600 50 L 800 90 L 1000 120 L 1000 200 Z" fill="#5d4878" />
      </svg>
    </>
  );
}

function NightScene() {
  // 几十颗星星固定位置
  const stars = [
    { x: '10%', y: '8%', r: 2, delay: 0 },
    { x: '22%', y: '15%', r: 1.5, delay: 1.5 },
    { x: '35%', y: '6%', r: 2.5, delay: 0.8 },
    { x: '50%', y: '12%', r: 1.5, delay: 2 },
    { x: '65%', y: '18%', r: 2, delay: 1.2 },
    { x: '80%', y: '8%', r: 1.5, delay: 0.5 },
    { x: '92%', y: '22%', r: 2, delay: 1.8 },
    { x: '15%', y: '28%', r: 1.5, delay: 0.3 },
    { x: '48%', y: '32%', r: 1.8, delay: 1.6 },
    { x: '75%', y: '35%', r: 2, delay: 2.2 },
    { x: '5%', y: '42%', r: 1.5, delay: 0.9 },
    { x: '88%', y: '48%', r: 1.8, delay: 1.4 },
  ];

  return (
    <>
      <Style />
      {/* 月亮 */}
      <svg
        viewBox="0 0 100 100"
        style={{ position: 'absolute', right: 30, top: 80, width: 100, height: 100, animation: 'tbg-float 5s ease-in-out infinite' }}
      >
        <defs>
          <radialGradient id="moon-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#fff8d8" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#fff8d8" stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={50} cy={50} r={45} fill="url(#moon-glow)" />
        <circle cx={50} cy={50} r={28} fill="#fff8d8" />
        <circle cx={58} cy={42} r={26} fill="#1a2548" />
      </svg>
      {/* 星星 */}
      {stars.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.r * 2,
            height: s.r * 2,
            borderRadius: '50%',
            background: 'white',
            boxShadow: `0 0 ${s.r * 4}px rgba(255,255,255,0.8)`,
            animation: `tbg-twinkle ${2 + s.delay}s ease-in-out infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </>
  );
}

function Cloud({
  x, y, scale = 1, color = 'rgba(255,255,255,0.85)',
}: {
  x: string; y: string; scale?: number; color?: string;
}) {
  const W = 120;
  const H = 60;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: W * scale,
        height: H * scale,
        animation: 'tbg-float 7s ease-in-out infinite',
      }}
    >
      <g fill={color}>
        <ellipse cx={28} cy={38} rx={26} ry={18} />
        <ellipse cx={60} cy={28} rx={32} ry={22} />
        <ellipse cx={92} cy={36} rx={22} ry={16} />
        <ellipse cx={50} cy={42} rx={42} ry={14} />
      </g>
    </svg>
  );
}
