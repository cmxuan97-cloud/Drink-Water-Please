import { useEffect } from 'react';

export type TimeTheme = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

export const themeFromHour = (h: number): TimeTheme => {
  if (h >= 5 && h < 7) return 'dawn';          // 清晨日出
  if (h >= 7 && h < 11) return 'morning';      // 早上
  if (h >= 11 && h < 17) return 'afternoon';   // 下午大太阳
  if (h >= 17 && h < 19.5) return 'evening';   // 傍晚夕阳 (17:00–19:30)
  return 'night';                               // 晚上 (19:30+ 和 < 5)
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
  const now = new Date();
  const t = theme ?? themeFromHour(now.getHours() + now.getMinutes() / 60);
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
  @keyframes tbg-soar {
    0%,100% { transform: translateY(0) rotate(0deg); }
    35%     { transform: translateY(-12px) rotate(-5deg); }
    70%     { transform: translateY(-5px) rotate(3deg); }
  }
  @keyframes tbg-bob {
    0%,100% { transform: translateY(0) rotate(0deg); }
    50%     { transform: translateY(-8px) rotate(-6deg); }
  }
  @keyframes tbg-flap {
    0%,100% { transform: scaleY(1); }
    50%     { transform: scaleY(0.35); }
  }
  @keyframes tbg-bat {
    0%   { transform: translate(0px, 0px); }
    20%  { transform: translate(-28px, -18px); }
    45%  { transform: translate(-18px, 12px); }
    70%  { transform: translate(14px, -10px); }
    100% { transform: translate(0px, 0px); }
  }
`;

const Style = () => <style>{float}</style>;

function SunriseScene() {
  return (
    <>
      <Style />
      {/* 日出大圆晕 — 右侧偏上，从地平线升起感 */}
      <svg
        viewBox="0 0 400 400"
        style={{ position: 'absolute', right: '-8%', top: '6%', width: 380, height: 380, opacity: 0.88 }}
      >
        <defs>
          <radialGradient id="sunrise-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#fff8c0" />
            <stop offset="30%" stopColor="#ffcc66" />
            <stop offset="65%" stopColor="#ff8844" />
            <stop offset="100%" stopColor="#ff5522" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={200} cy={200} r={190} fill="url(#sunrise-glow)" />
        <circle cx={200} cy={200} r={72} fill="#ffe878" opacity={0.95} />
        <circle cx={200} cy={200} r={50} fill="#fff9c0" />
      </svg>

      {/* 云朵 — 多几朵，暖色调 */}
      <Cloud x={'3%'} y={'12%'} scale={0.9} color="rgba(255,228,190,0.78)" />
      <Cloud x={'0%'} y={'36%'} scale={0.7} color="rgba(255,238,205,0.68)" />
      <Cloud x={'4%'} y={'58%'} scale={0.55} color="rgba(255,245,220,0.6)" />
      <Cloud x={'48%'} y={'62%'} scale={0.5} color="rgba(255,245,225,0.5)" />

      {/* 飞鸟 — 翱翔动画 */}
      <svg style={{ position: 'absolute', right: '8%', top: '13%', width: 140, height: 50, overflow: 'visible', animation: 'tbg-soar 5s ease-in-out infinite' }}>
        <path d="M 0 22 Q 12 10 24 22" stroke="#c07848" fill="none" strokeWidth="2.2" strokeLinecap="round" opacity={0.65} />
        <path d="M 34 14 Q 48 3 62 14" stroke="#c07848" fill="none" strokeWidth="2" strokeLinecap="round" opacity={0.55} />
        <path d="M 78 20 Q 90 10 102 20" stroke="#c07848" fill="none" strokeWidth="1.8" strokeLinecap="round" opacity={0.45} />
      </svg>
      <svg style={{ position: 'absolute', right: '18%', top: '10%', width: 90, height: 35, overflow: 'visible', animation: 'tbg-soar 5s ease-in-out infinite', animationDelay: '1.6s' }}>
        <path d="M 0 18 Q 14 6 28 18" stroke="#c07848" fill="none" strokeWidth="1.8" strokeLinecap="round" opacity={0.45} />
        <path d="M 38 12 Q 50 3 62 12" stroke="#c07848" fill="none" strokeWidth="1.6" strokeLinecap="round" opacity={0.38} />
      </svg>

      <BottomPlants />
    </>
  );
}

function DawnScene() { return <SunriseScene />; }
function MorningScene() { return <SunriseScene />; }

function AfternoonScene() {
  return (
    <>
      <Style />
      {/* 大太阳右上 + 光线旋转 */}
      <svg
        viewBox="0 0 200 200"
        style={{ position: 'absolute', right: -20, top: 40, width: 250, height: 250 }}
      >
        <g style={{ transformOrigin: '100px 100px', animation: 'tbg-spin 60s linear infinite' }}>
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => (
            <line
              key={a}
              x1={100}
              y1={100}
              x2={100 + Math.cos((a * Math.PI) / 180) * 94}
              y2={100 + Math.sin((a * Math.PI) / 180) * 94}
              stroke="#fff0a8"
              strokeWidth={5}
              strokeLinecap="round"
              opacity={0.5}
            />
          ))}
        </g>
        <circle cx={100} cy={100} r={54} fill="#ffd84a" opacity={0.9} />
        <circle cx={100} cy={100} r={40} fill="#fff05a" />
      </svg>
      {/* 蓝天白云 — 多几朵 */}
      <Cloud x={'3%'} y={'20%'} scale={0.9} color="rgba(255,255,255,0.9)" />
      <Cloud x={'8%'} y={'44%'} scale={0.7} color="rgba(255,255,255,0.85)" />
      <Cloud x={'2%'} y={'64%'} scale={0.55} color="rgba(255,255,255,0.8)" />
      <Cloud x={'45%'} y={'55%'} scale={0.6} color="rgba(255,255,255,0.75)" />
      {/* 蝴蝶 — 扑翼飘浮 */}
      <svg style={{ position: 'absolute', left: '12%', top: '30%', width: 48, height: 36, overflow: 'visible', animation: 'tbg-float 4s ease-in-out infinite' }}>
        <g style={{ transformOrigin: '24px 18px', animation: 'tbg-flap 0.7s ease-in-out infinite' }}>
          <ellipse cx={13} cy={16} rx={12} ry={8} fill="#f9d84a" opacity={0.75} transform="rotate(-18,13,16)" />
          <ellipse cx={35} cy={16} rx={12} ry={8} fill="#f9d84a" opacity={0.75} transform="rotate(18,35,16)" />
          <ellipse cx={13} cy={22} rx={8} ry={5} fill="#f0a830" opacity={0.65} transform="rotate(15,13,22)" />
          <ellipse cx={35} cy={22} rx={8} ry={5} fill="#f0a830" opacity={0.65} transform="rotate(-15,35,22)" />
        </g>
        <ellipse cx={24} cy={18} rx={2.5} ry={9} fill="#7a4010" opacity={0.8} />
      </svg>
      <BottomPlants leafColor="#6dc45a" dewColor="#90d8f0" />
    </>
  );
}

function EveningScene() {
  return (
    <>
      <Style />
      {/* 夕阳大圆 */}
      <svg
        viewBox="0 0 400 400"
        style={{ position: 'absolute', left: '50%', top: '-5%', transform: 'translateX(-50%)', width: 420, height: 420 }}
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
      {/* 归巢飞鸟 — 自然散群剪影 */}
      <svg style={{ position: 'absolute', right: '3%', top: '8%', width: 240, height: 110, overflow: 'visible' }}>
        {[
          { x: 120, y: 22, s: 1.0, op: 0.72 },
          { x: 82,  y: 42, s: 0.8, op: 0.62 },
          { x: 158, y: 38, s: 0.78, op: 0.60 },
          { x: 48,  y: 62, s: 0.62, op: 0.50 },
          { x: 192, y: 56, s: 0.60, op: 0.48 },
          { x: 16,  y: 48, s: 0.50, op: 0.40 },
          { x: 210, y: 74, s: 0.45, op: 0.35 },
        ].map(({ x, y, s, op }, i) => (
          <g key={i} transform={`translate(${x},${y}) scale(${s})`} opacity={op}>
            <g style={{ animation: `tbg-bob ${2.6 + (i % 4) * 0.55}s ease-in-out infinite`, animationDelay: `${i * 0.38}s`, transformOrigin: '0 0' }}>
              <ellipse cx={0} cy={0} rx={8} ry={3.5} fill="#7a3820" />
              <path d="M -12 0 Q -6 -9 0 -2" fill="#7a3820" />
              <path d="M 12 0 Q 6 -9 0 -2" fill="#7a3820" />
            </g>
          </g>
        ))}
      </svg>
      {/* 远处剪影山 */}
      <svg
        viewBox="0 0 1000 200"
        preserveAspectRatio="none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: '4%', width: '100%', height: 100, opacity: 0.4 }}
      >
        <path d="M 0 200 L 0 120 L 200 60 L 400 100 L 600 50 L 800 90 L 1000 120 L 1000 200 Z" fill="#5d4878" />
      </svg>
      <BottomPlants leafColor="#7a9448" dewColor="#f0c870" />
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
      {/* 蝙蝠 — 不规则飞行 */}
      <svg style={{ position: 'absolute', left: '20%', top: '22%', width: 44, height: 28, overflow: 'visible', animation: 'tbg-bat 9s ease-in-out infinite' }}>
        <g style={{ transformOrigin: '22px 14px', animation: 'tbg-flap 0.5s ease-in-out infinite' }}>
          <path d="M 10 14 Q 0 4 -4 14" fill="rgba(200,210,255,0.55)" />
          <path d="M 34 14 Q 44 4 48 14" fill="rgba(200,210,255,0.55)" />
        </g>
        <ellipse cx={22} cy={14} rx={6} ry={4} fill="rgba(200,210,255,0.65)" />
      </svg>
      <BottomPlants leafColor="#2d4838" dewColor="#6898b8" opacity={0.55} />
    </>
  );
}

function BottomPlants({
  leafColor = '#8bc47a', dewColor = '#b8e8f8', opacity = 0.7,
}: { leafColor?: string; dewColor?: string; opacity?: number }) {
  return (
    <svg
      viewBox="0 0 400 160"
      preserveAspectRatio="xMidYMax meet"
      style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 160, overflow: 'visible', opacity }}
    >
      <path d="M 40 160 Q 30 120 50 95" stroke={leafColor} fill="none" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 40 160 Q 55 125 70 108" stroke={leafColor} fill="none" strokeWidth="3" strokeLinecap="round" />
      <path d="M 80 160 Q 72 130 88 112" stroke={leafColor} fill="none" strokeWidth="3" strokeLinecap="round" />
      <path d="M 80 160 Q 92 128 106 115" stroke={leafColor} fill="none" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 340 160 Q 330 128 348 108" stroke={leafColor} fill="none" strokeWidth="3" strokeLinecap="round" />
      <path d="M 340 160 Q 355 132 368 118" stroke={leafColor} fill="none" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M 370 160 Q 362 136 376 120" stroke={leafColor} fill="none" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx={50} cy={96} rx={4.5} ry={5.5} fill={dewColor} opacity={0.88} />
      <ellipse cx={70} cy={109} rx={3.5} ry={4} fill={dewColor} opacity={0.82} />
      <ellipse cx={88} cy={113} rx={3} ry={3.5} fill={dewColor} opacity={0.76} />
      <ellipse cx={106} cy={116} rx={2.5} ry={3} fill={dewColor} opacity={0.7} />
      <ellipse cx={348} cy={109} rx={3.5} ry={4} fill={dewColor} opacity={0.82} />
      <ellipse cx={368} cy={119} rx={3} ry={3.5} fill={dewColor} opacity={0.76} />
    </svg>
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
