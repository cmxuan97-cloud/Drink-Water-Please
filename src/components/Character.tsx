import type { JSX } from 'react';

export type Mood = 'idle' | 'happy' | 'thirsty' | 'encouraging' | 'celebrating' | 'drinking';

export type CharacterId =
  | 'kiwi' | 'mola' | 'dino' | 'kong' | 'godzilla' | 'robot' | 'ghost' | 'alien'
  | 'octopus' | 'panda' | 'penguin' | 'owl' | 'unicorn' | 'dragon' | 'otter'
  | 'fox' | 'bear' | 'bat' | 'lion' | 'shark';

type Spec = {
  viewBox: string;
  render: (eyeClosed: boolean) => JSX.Element;
};

// helper: open or sleepy eyes
const Eye = ({ x, y, r = 4, closed = false, withHighlight = false }: { x: number; y: number; r?: number; closed?: boolean; withHighlight?: boolean }) =>
  closed ? (
    <path d={`M ${x - r} ${y} Q ${x} ${y - r * 1.2} ${x + r} ${y}`} stroke="#1a1408" strokeWidth={2.2} fill="none" strokeLinecap="round" />
  ) : (
    <>
      <circle cx={x} cy={y} r={r} fill="#1a1408" />
      {withHighlight && <circle cx={x + r * 0.4} cy={y - r * 0.4} r={r * 0.3} fill="white" />}
    </>
  );

const Blush = ({ x, y, rx = 6, ry = 3.5 }: { x: number; y: number; rx?: number; ry?: number }) => (
  <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#ff9bb0" opacity={0.55} />
);

const CHARACTERS: Record<CharacterId, Spec> = {
  // === Kiwi (奇异鸟) ===
  kiwi: {
    viewBox: '8 32 280 220',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-kiwi-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9b774f" />
            <stop offset="100%" stopColor="#7b5a36" />
          </linearGradient>
          <linearGradient id="g-kiwi-beak" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7b5a36" />
            <stop offset="100%" stopColor="#d6c08a" />
          </linearGradient>
        </defs>
        <path d="M 100 130 Q 50 142 14 158 Q 8 161 14 165 Q 22 168 60 162 Q 95 156 124 145 Z" fill="url(#g-kiwi-beak)" stroke="#5b4324" strokeWidth={0.8} />
        <g stroke="#6a4a28" strokeWidth={2.2} strokeLinecap="round">
          <line x1={158} y1={56} x2={156} y2={46} />
          <line x1={172} y1={54} x2={172} y2={42} />
          <line x1={186} y1={53} x2={188} y2={42} />
          <line x1={200} y1={55} x2={204} y2={45} />
          <line x1={214} y1={60} x2={220} y2={50} />
        </g>
        <ellipse cx={185} cy={130} rx={100} ry={80} fill="url(#g-kiwi-body)" />
        <ellipse cx={185} cy={180} rx={92} ry={40} fill="#5a3f24" opacity={0.18} />
        {Eye({ x: 128, y: 108, r: 5, closed: e })}
        <g stroke="#3d2814" strokeWidth={5.5} strokeLinecap="round" fill="none">
          <path d="M 162 210 L 160 238" />
          <path d="M 210 210 L 212 238" />
        </g>
        <g fill="#2a1c0d" stroke="#2a1c0d" strokeWidth={2.5} strokeLinecap="round">
          <path d="M 150 246 L 173 246" />
          <path d="M 200 246 L 223 246" />
        </g>
      </>
    ),
  },

  // === Mola (太阳鱼) ===
  mola: {
    viewBox: '18 28 230 210',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-mola-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b6c7d0" />
            <stop offset="100%" stopColor="#8fa3ae" />
          </linearGradient>
          <linearGradient id="g-mola-fin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8fa3ae" />
            <stop offset="100%" stopColor="#6b8290" />
          </linearGradient>
          <linearGradient id="g-mola-belly" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e6edf1" />
            <stop offset="100%" stopColor="#c3d2db" />
          </linearGradient>
        </defs>
        <path d="M 158 38 Q 178 30 198 52 L 222 122 Q 218 130 206 124 L 178 95 Q 158 80 158 38 Z" fill="url(#g-mola-fin)" />
        <path d="M 158 222 Q 178 230 198 208 L 222 138 Q 218 130 206 136 L 178 165 Q 158 180 158 222 Z" fill="url(#g-mola-fin)" />
        <path d="M 220 90 Q 240 130 220 170 Q 200 200 150 215 Q 80 220 50 175 Q 30 130 50 85 Q 80 40 150 45 Q 200 50 220 90 Z" fill="url(#g-mola-body)" />
        <g fill="url(#g-mola-fin)">
          <circle cx={232} cy={115} r={9} />
          <circle cx={236} cy={130} r={10} />
          <circle cx={236} cy={148} r={9} />
          <circle cx={232} cy={163} r={8} />
        </g>
        <path d="M 50 165 Q 65 210 130 215 Q 165 218 175 195 Q 130 200 95 185 Q 60 175 50 165 Z" fill="url(#g-mola-belly)" />
        <ellipse cx={150} cy={148} rx={18} ry={20} fill="#7b8d97" opacity={0.55} />
        <ellipse cx={36} cy={138} rx={11} ry={9} fill="#eef3f6" stroke="#a5b4bc" strokeWidth={0.8} />
        <ellipse cx={34} cy={140} rx={4} ry={2.5} fill="#7b8d97" />
        {Eye({ x: 84, y: 115, r: 5.5, closed: e, withHighlight: true })}
      </>
    ),
  },

  // === Dino (T-rex 小恐龙) ===
  dino: {
    viewBox: '0 30 240 200',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-dino" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7ab87a" />
            <stop offset="100%" stopColor="#4a8a4a" />
          </linearGradient>
        </defs>
        <path d="M 30 130 Q 0 100 15 70 Q 35 65 55 100 Z" fill="url(#g-dino)" />
        <ellipse cx={120} cy={130} rx={88} ry={55} fill="url(#g-dino)" />
        <g fill="#3d6f3d">
          <polygon points="80,82 88,68 96,82" />
          <polygon points="100,78 108,64 116,78" />
          <polygon points="120,77 128,63 136,77" />
          <polygon points="140,79 148,65 156,79" />
        </g>
        <ellipse cx={195} cy={92} rx={48} ry={36} fill="url(#g-dino)" />
        <path d="M 165 108 Q 200 116 235 108 L 235 118 Q 200 124 168 118 Z" fill="#3d2010" />
        <g fill="white">
          <polygon points="180,108 184,116 176,116" />
          <polygon points="200,108 204,116 196,116" />
          <polygon points="220,108 224,116 216,116" />
        </g>
        {Eye({ x: 205, y: 82, r: 4.5, closed: e })}
        <ellipse cx={170} cy={132} rx={9} ry={16} fill="#4a8a4a" />
        <ellipse cx={95} cy={185} rx={18} ry={22} fill="url(#g-dino)" />
        <ellipse cx={145} cy={185} rx={18} ry={22} fill="url(#g-dino)" />
        <g fill="#3d6f3d">
          <ellipse cx={88} cy={205} rx={14} ry={5} />
          <ellipse cx={152} cy={205} rx={14} ry={5} />
        </g>
      </>
    ),
  },

  // === Kong (金刚) ===
  kong: {
    viewBox: '5 18 230 215',
    render: (e) => (
      <>
        <defs>
          <radialGradient id="g-kong">
            <stop offset="0%" stopColor="#5a4f48" />
            <stop offset="100%" stopColor="#332821" />
          </radialGradient>
        </defs>
        <ellipse cx={120} cy={155} rx={80} ry={62} fill="url(#g-kong)" />
        <ellipse cx={50} cy={140} rx={22} ry={48} fill="#332821" transform="rotate(15 50 140)" />
        <ellipse cx={190} cy={140} rx={22} ry={48} fill="#332821" transform="rotate(-15 190 140)" />
        <ellipse cx={95} cy={220} rx={22} ry={11} fill="#1f1814" />
        <ellipse cx={145} cy={220} rx={22} ry={11} fill="#1f1814" />
        <circle cx={120} cy={75} r={52} fill="url(#g-kong)" />
        <circle cx={70} cy={68} r={11} fill="#332821" />
        <circle cx={170} cy={68} r={11} fill="#332821" />
        <ellipse cx={120} cy={88} rx={36} ry={30} fill="#a89488" />
        {e ? (
          <g stroke="#1a1408" strokeWidth={2.2} fill="none" strokeLinecap="round">
            <path d="M 100 76 Q 105 71 110 76" />
            <path d="M 130 76 Q 135 71 140 76" />
          </g>
        ) : (
          <g fill="#1a1408">
            <circle cx={105} cy={76} r={3.6} />
            <circle cx={135} cy={76} r={3.6} />
          </g>
        )}
        <g fill="#1a1408">
          <circle cx={113} cy={94} r={1.6} />
          <circle cx={127} cy={94} r={1.6} />
        </g>
        <path d="M 105 105 Q 120 113 135 105" stroke="#1a1408" strokeWidth={2} fill="none" strokeLinecap="round" />
      </>
    ),
  },

  // === Godzilla (哥斯拉) ===
  godzilla: {
    viewBox: '0 30 240 195',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-godzilla" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a4d3a" />
            <stop offset="100%" stopColor="#1f2e1f" />
          </linearGradient>
        </defs>
        <path d="M 35 165 Q 5 145 8 105 Q 28 92 50 130 Z" fill="url(#g-godzilla)" />
        <ellipse cx={120} cy={140} rx={88} ry={55} fill="url(#g-godzilla)" />
        <g fill="#88c878">
          <path d="M 65 92 L 75 68 L 85 92 Z" />
          <path d="M 90 87 L 100 62 L 110 87 Z" />
          <path d="M 115 84 L 125 58 L 135 84 Z" />
          <path d="M 140 86 L 150 60 L 160 86 Z" />
          <path d="M 165 90 L 175 68 L 185 90 Z" />
        </g>
        <ellipse cx={200} cy={95} rx={45} ry={36} fill="url(#g-godzilla)" />
        <ellipse cx={210} cy={108} rx={24} ry={12} fill="#2a1010" />
        <g fill="white">
          <polygon points="195,103 198,112 192,112" />
          <polygon points="208,103 211,112 205,112" />
          <polygon points="222,103 225,112 219,112" />
          <polygon points="195,116 198,107 192,107" />
          <polygon points="222,116 225,107 219,107" />
        </g>
        {e ? (
          <path d="M 202 80 Q 207 75 212 80" stroke="#1a1408" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        ) : (
          <>
            <circle cx={207} cy={82} r={4.5} fill="#cc3030" />
            <circle cx={208} cy={80.5} r={1.5} fill="#ffaa88" />
          </>
        )}
        <ellipse cx={155} cy={150} rx={10} ry={20} fill="#1f2e1f" />
        <ellipse cx={95} cy={188} rx={17} ry={17} fill="url(#g-godzilla)" />
        <ellipse cx={145} cy={188} rx={17} ry={17} fill="url(#g-godzilla)" />
        <g fill="#88c878">
          <polygon points="80,200 85,210 90,200" />
          <polygon points="92,200 97,210 102,200" />
          <polygon points="130,200 135,210 140,200" />
          <polygon points="142,200 147,210 152,200" />
        </g>
      </>
    ),
  },

  // === Robot (机器人) ===
  robot: {
    viewBox: '40 5 160 220',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-robot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4dee5" />
            <stop offset="100%" stopColor="#8d9aa6" />
          </linearGradient>
        </defs>
        <line x1={120} y1={45} x2={120} y2={20} stroke="#5a6878" strokeWidth={3} />
        <circle cx={120} cy={15} r={6} fill="#ff5a5a" />
        <circle cx={120} cy={15} r={2.5} fill="#ffaaaa" />
        <rect x={68} y={45} width={104} height={82} rx={20} fill="url(#g-robot)" stroke="#5a6878" strokeWidth={2} />
        <rect x={82} y={62} width={76} height={48} rx={8} fill="#1a2638" />
        {e ? (
          <g stroke="#88e0ff" strokeWidth={3} fill="none" strokeLinecap="round">
            <path d="M 96 82 L 110 82" />
            <path d="M 130 82 L 144 82" />
          </g>
        ) : (
          <g fill="#88e0ff">
            <circle cx={103} cy={82} r={6} />
            <circle cx={137} cy={82} r={6} />
            <circle cx={103} cy={80} r={2} fill="white" />
            <circle cx={137} cy={80} r={2} fill="white" />
          </g>
        )}
        <g stroke="#88e0ff" strokeWidth={1.8} strokeLinecap="round">
          <line x1={106} y1={98} x2={134} y2={98} />
          <line x1={110} y1={102} x2={130} y2={102} />
        </g>
        <rect x={75} y={132} width={90} height={68} rx={10} fill="url(#g-robot)" stroke="#5a6878" strokeWidth={2} />
        <circle cx={120} cy={166} r={10} fill="#ffaa00" />
        <circle cx={120} cy={166} r={5} fill="#ffe07a" />
        <rect x={48} y={140} width={20} height={52} rx={5} fill="#7c8a96" stroke="#5a6878" strokeWidth={1.5} />
        <rect x={172} y={140} width={20} height={52} rx={5} fill="#7c8a96" stroke="#5a6878" strokeWidth={1.5} />
        <rect x={86} y={200} width={22} height={20} rx={3} fill="#5a6878" />
        <rect x={132} y={200} width={22} height={20} rx={3} fill="#5a6878" />
      </>
    ),
  },

  // === Ghost (幽灵) ===
  ghost: {
    viewBox: '40 20 160 200',
    render: (e) => (
      <>
        <path d="M 60 80 Q 60 30 120 30 Q 180 30 180 80 L 180 165 Q 175 178 165 168 Q 155 158 145 170 Q 135 180 125 168 Q 115 158 105 170 Q 95 180 85 168 Q 75 158 65 170 Q 60 178 60 165 Z" fill="white" stroke="#c4d4dc" strokeWidth={1.5} />
        {e ? (
          <g stroke="#1a2638" strokeWidth={2.5} fill="none" strokeLinecap="round">
            <path d="M 95 90 Q 102 85 109 90" />
            <path d="M 131 90 Q 138 85 145 90" />
          </g>
        ) : (
          <g fill="#1a2638">
            <ellipse cx={102} cy={92} rx={6} ry={9} />
            <ellipse cx={138} cy={92} rx={6} ry={9} />
            <circle cx={104} cy={89} r={2} fill="white" />
            <circle cx={140} cy={89} r={2} fill="white" />
          </g>
        )}
        <ellipse cx={120} cy={120} rx={9} ry={11} fill="#1a2638" />
        {Blush({ x: 80, y: 115 })}
        {Blush({ x: 160, y: 115 })}
      </>
    ),
  },

  // === Alien (外星人) ===
  alien: {
    viewBox: '50 0 140 200',
    render: (e) => (
      <>
        <line x1={120} y1={30} x2={120} y2={10} stroke="#3a8a5a" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={120} cy={8} r={5} fill="#88f088" />
        <circle cx={120} cy={8} r={2} fill="#d8ffe0" />
        <ellipse cx={120} cy={82} rx={62} ry={70} fill="#88c88a" stroke="#3a8a5a" strokeWidth={1.5} />
        {e ? (
          <g stroke="#1a2638" strokeWidth={2.5} fill="none" strokeLinecap="round">
            <path d="M 90 70 Q 100 64 110 70" />
            <path d="M 130 70 Q 140 64 150 70" />
          </g>
        ) : (
          <g>
            <ellipse cx={100} cy={75} rx={9} ry={14} fill="#1a2638" />
            <ellipse cx={140} cy={75} rx={9} ry={14} fill="#1a2638" />
            <circle cx={100} cy={70} r={2.5} fill="white" />
            <circle cx={140} cy={70} r={2.5} fill="white" />
          </g>
        )}
        <ellipse cx={120} cy={112} rx={5} ry={2.5} fill="#3a8a5a" />
        <ellipse cx={120} cy={170} rx={28} ry={20} fill="#88c88a" />
        <ellipse cx={88} cy={170} rx={9} ry={4} fill="#88c88a" transform="rotate(-15 88 170)" />
        <ellipse cx={152} cy={170} rx={9} ry={4} fill="#88c88a" transform="rotate(15 152 170)" />
        <ellipse cx={108} cy={192} rx={6} ry={3} fill="#3a8a5a" />
        <ellipse cx={132} cy={192} rx={6} ry={3} fill="#3a8a5a" />
      </>
    ),
  },

  // === Octopus (章鱼) ===
  octopus: {
    viewBox: '40 15 160 195',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-octopus" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#bf8ad8" />
            <stop offset="100%" stopColor="#8a4eb0" />
          </linearGradient>
        </defs>
        <ellipse cx={120} cy={75} rx={58} ry={54} fill="url(#g-octopus)" />
        <g fill="#a070c8">
          <path d="M 78 105 Q 56 128 70 175 Q 75 188 85 178 Q 78 145 95 115 Z" />
          <path d="M 95 112 Q 84 148 95 185 Q 100 195 108 185 Q 100 152 110 122 Z" />
          <path d="M 117 116 Q 110 158 122 195 Q 128 200 132 192 Q 122 158 130 122 Z" />
          <path d="M 145 115 Q 152 155 138 192 Q 134 200 128 192 Q 138 158 130 122 Z" />
          <path d="M 162 110 Q 168 145 158 178 Q 153 190 145 180 Q 152 150 145 118 Z" />
          <path d="M 178 105 Q 188 128 172 175 Q 167 188 158 178 Q 162 145 145 115 Z" />
        </g>
        {e ? (
          <g stroke="#1a2638" strokeWidth={2.4} fill="none" strokeLinecap="round">
            <path d="M 92 65 Q 100 60 108 65" />
            <path d="M 132 65 Q 140 60 148 65" />
          </g>
        ) : (
          <g>
            <circle cx={100} cy={68} r={7} fill="white" />
            <circle cx={140} cy={68} r={7} fill="white" />
            <circle cx={102} cy={70} r={3.5} fill="#1a2638" />
            <circle cx={142} cy={70} r={3.5} fill="#1a2638" />
          </g>
        )}
        <path d="M 110 90 Q 120 96 130 90" stroke="#5a3a78" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        {Blush({ x: 80, y: 86 })}
        {Blush({ x: 160, y: 86 })}
      </>
    ),
  },

  // === Panda (熊猫) ===
  panda: {
    viewBox: '45 25 150 195',
    render: (e) => (
      <>
        <circle cx={75} cy={50} r={20} fill="#1a1a1a" />
        <circle cx={165} cy={50} r={20} fill="#1a1a1a" />
        <circle cx={120} cy={92} r={60} fill="white" />
        <ellipse cx={94} cy={90} rx={14} ry={18} fill="#1a1a1a" transform="rotate(-15 94 90)" />
        <ellipse cx={146} cy={90} rx={14} ry={18} fill="#1a1a1a" transform="rotate(15 146 90)" />
        {e ? (
          <g stroke="white" strokeWidth={2.2} fill="none" strokeLinecap="round">
            <path d="M 89 90 Q 94 87 99 90" />
            <path d="M 141 90 Q 146 87 151 90" />
          </g>
        ) : (
          <g fill="white">
            <circle cx={95} cy={90} r={3.5} />
            <circle cx={145} cy={90} r={3.5} />
          </g>
        )}
        <ellipse cx={120} cy={110} rx={5} ry={3} fill="#1a1a1a" />
        <path d="M 120 113 L 120 119 Q 116 124 110 121 M 120 119 Q 124 124 130 121" stroke="#1a1a1a" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <ellipse cx={120} cy={175} rx={48} ry={38} fill="white" />
        <g fill="#1a1a1a">
          <ellipse cx={82} cy={170} rx={16} ry={22} />
          <ellipse cx={158} cy={170} rx={16} ry={22} />
          <ellipse cx={100} cy={205} rx={15} ry={11} />
          <ellipse cx={140} cy={205} rx={15} ry={11} />
        </g>
      </>
    ),
  },

  // === Penguin (企鹅) ===
  penguin: {
    viewBox: '50 15 140 210',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-penguin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a4658" />
            <stop offset="100%" stopColor="#1c2436" />
          </linearGradient>
        </defs>
        <ellipse cx={120} cy={120} rx={62} ry={88} fill="url(#g-penguin)" />
        <ellipse cx={120} cy={140} rx={42} ry={62} fill="white" />
        <ellipse cx={62} cy={130} rx={14} ry={32} fill="#1c2436" transform="rotate(20 62 130)" />
        <ellipse cx={178} cy={130} rx={14} ry={32} fill="#1c2436" transform="rotate(-20 178 130)" />
        {e ? (
          <g stroke="#1a1408" strokeWidth={2.2} fill="none" strokeLinecap="round">
            <path d="M 100 80 Q 105 76 110 80" />
            <path d="M 130 80 Q 135 76 140 80" />
          </g>
        ) : (
          <g>
            <circle cx={105} cy={80} r={5} fill="white" />
            <circle cx={135} cy={80} r={5} fill="white" />
            <circle cx={106} cy={82} r={2.5} fill="#1a1408" />
            <circle cx={136} cy={82} r={2.5} fill="#1a1408" />
          </g>
        )}
        <path d="M 110 96 L 130 96 L 122 110 L 118 110 Z" fill="#ff9a3a" />
        <ellipse cx={102} cy={215} rx={14} ry={6} fill="#ff9a3a" />
        <ellipse cx={138} cy={215} rx={14} ry={6} fill="#ff9a3a" />
      </>
    ),
  },

  // === Owl (猫头鹰) ===
  owl: {
    viewBox: '40 20 160 200',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-owl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a07a52" />
            <stop offset="100%" stopColor="#75543a" />
          </linearGradient>
        </defs>
        <polygon points="65,40 80,30 80,55" fill="#75543a" />
        <polygon points="175,40 160,30 160,55" fill="#75543a" />
        <ellipse cx={120} cy={115} rx={70} ry={85} fill="url(#g-owl)" />
        <ellipse cx={120} cy={140} rx={42} ry={48} fill="#d4ba94" />
        <circle cx={98} cy={95} r={20} fill="white" />
        <circle cx={142} cy={95} r={20} fill="white" />
        {e ? (
          <g stroke="#1a1408" strokeWidth={2.5} fill="none" strokeLinecap="round">
            <path d="M 88 95 Q 98 88 108 95" />
            <path d="M 132 95 Q 142 88 152 95" />
          </g>
        ) : (
          <g fill="#1a1408">
            <circle cx={98} cy={95} r={9} />
            <circle cx={142} cy={95} r={9} />
            <circle cx={100} cy={92} r={2.5} fill="white" />
            <circle cx={144} cy={92} r={2.5} fill="white" />
          </g>
        )}
        <path d="M 113 108 L 127 108 L 122 122 L 118 122 Z" fill="#ff9a3a" />
        <g fill="#75543a">
          <ellipse cx={92} cy={170} rx={18} ry={10} transform="rotate(-15 92 170)" />
          <ellipse cx={148} cy={170} rx={18} ry={10} transform="rotate(15 148 170)" />
        </g>
        <g fill="#ff9a3a">
          <path d="M 100 200 L 110 215 L 105 215 M 100 200 L 100 215 M 100 200 L 90 215 L 95 215" stroke="#ff9a3a" strokeWidth={2.5} strokeLinecap="round" />
          <path d="M 140 200 L 150 215 L 145 215 M 140 200 L 140 215 M 140 200 L 130 215 L 135 215" stroke="#ff9a3a" strokeWidth={2.5} strokeLinecap="round" />
        </g>
      </>
    ),
  },

  // === Unicorn (独角兽) ===
  unicorn: {
    viewBox: '20 10 200 210',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-unicorn-mane" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff8ab0" />
            <stop offset="50%" stopColor="#a88ce0" />
            <stop offset="100%" stopColor="#88c8e8" />
          </linearGradient>
        </defs>
        <ellipse cx={130} cy={150} rx={75} ry={50} fill="white" stroke="#d8d8e0" strokeWidth={1.5} />
        <ellipse cx={75} cy={120} rx={40} ry={45} fill="white" stroke="#d8d8e0" strokeWidth={1.5} />
        <polygon points="65,85 80,40 95,85" fill="url(#g-unicorn-mane)" stroke="#a86890" strokeWidth={1} />
        <path d="M 50 110 Q 35 85 45 60 Q 65 75 70 105 Z" fill="url(#g-unicorn-mane)" />
        <path d="M 100 90 Q 110 70 130 70 Q 145 80 140 105 Q 120 95 100 95 Z" fill="url(#g-unicorn-mane)" />
        <ellipse cx={62} cy={92} rx={5} ry={9} fill="#ffd8e5" />
        {e ? (
          <path d="M 65 122 Q 70 117 75 122" stroke="#1a1408" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        ) : (
          <>
            <circle cx={70} cy={124} r={4.5} fill="#1a1408" />
            <circle cx={71.5} cy={122.5} r={1.5} fill="white" />
          </>
        )}
        {Blush({ x: 50, y: 138, rx: 6, ry: 4 })}
        <ellipse cx={48} cy={148} rx={3} ry={2} fill="#1a1408" />
        <g stroke="#5a4030" strokeWidth={5.5} strokeLinecap="round" fill="none">
          <path d="M 95 195 L 95 215" />
          <path d="M 125 195 L 125 215" />
          <path d="M 165 195 L 165 215" />
          <path d="M 195 195 L 195 215" />
        </g>
        <path d="M 200 130 Q 220 120 215 100 Q 220 130 205 145 Z" fill="url(#g-unicorn-mane)" />
      </>
    ),
  },

  // === Dragon (中国龙) ===
  dragon: {
    viewBox: '10 25 220 180',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-dragon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d04848" />
            <stop offset="100%" stopColor="#a02828" />
          </linearGradient>
        </defs>
        <path d="M 30 150 Q 20 110 60 95 Q 110 90 130 130 Q 150 170 200 160 Q 215 155 218 145 Q 215 175 200 180 Q 150 190 120 160 Q 100 130 70 135 Q 35 145 30 150 Z" fill="url(#g-dragon)" />
        <ellipse cx={185} cy={75} rx={40} ry={32} fill="url(#g-dragon)" />
        <polygon points="155,55 162,42 169,55" fill="#a02828" />
        <polygon points="200,55 207,42 214,55" fill="#a02828" />
        <ellipse cx={210} cy={92} rx={6} ry={3} fill="#1a1408" />
        {e ? (
          <path d="M 175 65 Q 180 60 185 65" stroke="#1a1408" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        ) : (
          <>
            <circle cx={180} cy={67} r={5} fill="white" />
            <circle cx={181} cy={68} r={3} fill="#1a1408" />
          </>
        )}
        <path d="M 215 82 Q 230 88 220 95" stroke="#fcd34d" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M 155 82 Q 145 90 155 95" stroke="#fcd34d" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M 168 105 Q 185 110 200 105" stroke="#5a1010" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        <g fill="#fcd34d">
          <path d="M 50 90 Q 45 80 55 80 Q 60 90 50 90 Z" />
          <path d="M 75 88 Q 70 78 80 78 Q 85 88 75 88 Z" />
          <path d="M 100 92 Q 95 82 105 82 Q 110 92 100 92 Z" />
        </g>
      </>
    ),
  },

  // === Otter (水獭) ===
  otter: {
    viewBox: '20 30 200 180',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-otter" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9a7050" />
            <stop offset="100%" stopColor="#704830" />
          </linearGradient>
        </defs>
        <ellipse cx={120} cy={140} rx={88} ry={55} fill="url(#g-otter)" />
        <ellipse cx={120} cy={150} rx={50} ry={32} fill="#d8b890" />
        <circle cx={120} cy={80} r={48} fill="url(#g-otter)" />
        <circle cx={88} cy={55} r={11} fill="#704830" />
        <circle cx={152} cy={55} r={11} fill="#704830" />
        <ellipse cx={120} cy={92} rx={26} ry={20} fill="#d8b890" />
        {e ? (
          <g stroke="#1a1408" strokeWidth={2.2} fill="none" strokeLinecap="round">
            <path d="M 100 75 Q 105 70 110 75" />
            <path d="M 130 75 Q 135 70 140 75" />
          </g>
        ) : (
          <g fill="#1a1408">
            <circle cx={105} cy={76} r={4} />
            <circle cx={135} cy={76} r={4} />
            <circle cx={106} cy={74} r={1.5} fill="white" />
            <circle cx={136} cy={74} r={1.5} fill="white" />
          </g>
        )}
        <ellipse cx={120} cy={94} rx={5} ry={3.5} fill="#1a1408" />
        <path d="M 113 100 Q 120 106 127 100" stroke="#1a1408" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        <ellipse cx={62} cy={140} rx={18} ry={28} fill="url(#g-otter)" transform="rotate(20 62 140)" />
        <ellipse cx={178} cy={140} rx={18} ry={28} fill="url(#g-otter)" transform="rotate(-20 178 140)" />
        <ellipse cx={92} cy={195} rx={20} ry={10} fill="#5a3820" />
        <ellipse cx={148} cy={195} rx={20} ry={10} fill="#5a3820" />
      </>
    ),
  },

  // === Fox (狐狸) ===
  fox: {
    viewBox: '30 20 180 195',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-fox" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e89248" />
            <stop offset="100%" stopColor="#b86820" />
          </linearGradient>
        </defs>
        <path d="M 175 165 Q 215 160 210 110 Q 200 130 180 145 Z" fill="url(#g-fox)" />
        <path d="M 200 130 Q 210 110 200 100 Q 195 115 195 130 Z" fill="white" />
        <ellipse cx={120} cy={155} rx={75} ry={50} fill="url(#g-fox)" />
        <ellipse cx={120} cy={165} rx={48} ry={28} fill="white" />
        <path d="M 60 95 L 75 50 L 95 90 Z" fill="url(#g-fox)" />
        <path d="M 145 90 L 165 50 L 180 95 Z" fill="url(#g-fox)" />
        <path d="M 70 75 L 78 60 L 88 78 Z" fill="#ffd8b8" />
        <path d="M 152 78 L 162 60 L 170 75 Z" fill="#ffd8b8" />
        <path d="M 75 90 Q 85 130 120 138 Q 155 130 165 90 Q 155 95 140 90 L 120 100 L 100 90 Q 85 95 75 90 Z" fill="url(#g-fox)" />
        <path d="M 95 110 Q 120 130 145 110 Q 145 130 120 138 Q 95 130 95 110 Z" fill="white" />
        {e ? (
          <g stroke="#1a1408" strokeWidth={2.2} fill="none" strokeLinecap="round">
            <path d="M 95 95 Q 100 90 105 95" />
            <path d="M 135 95 Q 140 90 145 95" />
          </g>
        ) : (
          <g fill="#1a1408">
            <circle cx={100} cy={97} r={4} />
            <circle cx={140} cy={97} r={4} />
          </g>
        )}
        <ellipse cx={120} cy={120} rx={5} ry={3.5} fill="#1a1408" />
        <path d="M 120 124 Q 115 130 110 127 M 120 124 Q 125 130 130 127" stroke="#1a1408" strokeWidth={1.5} fill="none" strokeLinecap="round" />
      </>
    ),
  },

  // === Bear (棕熊) ===
  bear: {
    viewBox: '30 25 180 195',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-bear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9b7050" />
            <stop offset="100%" stopColor="#704830" />
          </linearGradient>
        </defs>
        <circle cx={75} cy={55} r={18} fill="url(#g-bear)" />
        <circle cx={165} cy={55} r={18} fill="url(#g-bear)" />
        <circle cx={75} cy={55} r={9} fill="#5a3820" />
        <circle cx={165} cy={55} r={9} fill="#5a3820" />
        <circle cx={120} cy={95} r={62} fill="url(#g-bear)" />
        <ellipse cx={120} cy={120} rx={32} ry={26} fill="#d8b890" />
        {e ? (
          <g stroke="#1a1408" strokeWidth={2.2} fill="none" strokeLinecap="round">
            <path d="M 95 90 Q 100 85 105 90" />
            <path d="M 135 90 Q 140 85 145 90" />
          </g>
        ) : (
          <g fill="#1a1408">
            <circle cx={100} cy={92} r={4} />
            <circle cx={140} cy={92} r={4} />
          </g>
        )}
        <ellipse cx={120} cy={118} rx={6} ry={4} fill="#1a1408" />
        <path d="M 120 122 Q 115 128 109 124 M 120 122 Q 125 128 131 124" stroke="#1a1408" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        <ellipse cx={120} cy={175} rx={55} ry={42} fill="url(#g-bear)" />
        <ellipse cx={120} cy={185} rx={32} ry={26} fill="#d8b890" />
        <g fill="url(#g-bear)">
          <ellipse cx={75} cy={170} rx={14} ry={22} />
          <ellipse cx={165} cy={170} rx={14} ry={22} />
        </g>
      </>
    ),
  },

  // === Bat (吸血鬼蝙蝠) ===
  bat: {
    viewBox: '15 30 210 175',
    render: (e) => (
      <>
        <path d="M 70 110 Q 30 95 25 60 Q 30 110 50 130 Q 60 145 75 140 Q 100 132 95 115 Z" fill="#8a4eb0" />
        <path d="M 170 110 Q 210 95 215 60 Q 210 110 190 130 Q 180 145 165 140 Q 140 132 145 115 Z" fill="#8a4eb0" />
        <ellipse cx={120} cy={120} rx={50} ry={55} fill="#1a1422" />
        <polygon points="85,75 95,55 105,80" fill="#1a1422" />
        <polygon points="135,80 145,55 155,75" fill="#1a1422" />
        <polygon points="92,72 98,62 102,75" fill="#5a3870" />
        <polygon points="142,75 148,62 152,72" fill="#5a3870" />
        {e ? (
          <g stroke="#fcd34d" strokeWidth={2.4} fill="none" strokeLinecap="round">
            <path d="M 100 110 Q 105 105 110 110" />
            <path d="M 130 110 Q 135 105 140 110" />
          </g>
        ) : (
          <g>
            <circle cx={105} cy={112} r={5.5} fill="#fcd34d" />
            <circle cx={135} cy={112} r={5.5} fill="#fcd34d" />
            <circle cx={106} cy={113} r={2.5} fill="#1a1408" />
            <circle cx={136} cy={113} r={2.5} fill="#1a1408" />
          </g>
        )}
        <path d="M 113 138 L 117 148 L 121 138 M 121 138 L 125 148 L 129 138" stroke="white" strokeWidth={1.5} fill="white" strokeLinejoin="round" />
        <ellipse cx={120} cy={130} rx={4} ry={3} fill="#5a3870" />
        {Blush({ x: 90, y: 132, rx: 5, ry: 3 })}
        {Blush({ x: 150, y: 132, rx: 5, ry: 3 })}
      </>
    ),
  },

  // === Lion (狮子) ===
  lion: {
    viewBox: '25 25 190 195',
    render: (e) => (
      <>
        <defs>
          <radialGradient id="g-lion-mane">
            <stop offset="0%" stopColor="#d8902a" />
            <stop offset="100%" stopColor="#a8580f" />
          </radialGradient>
          <linearGradient id="g-lion-face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fcd86c" />
            <stop offset="100%" stopColor="#ddb04a" />
          </linearGradient>
        </defs>
        <g fill="url(#g-lion-mane)">
          <circle cx={120} cy={100} r={75} />
          <circle cx={70} cy={75} r={20} />
          <circle cx={170} cy={75} r={20} />
          <circle cx={55} cy={100} r={20} />
          <circle cx={185} cy={100} r={20} />
          <circle cx={70} cy={130} r={20} />
          <circle cx={170} cy={130} r={20} />
          <circle cx={120} cy={45} r={20} />
          <circle cx={95} cy={50} r={18} />
          <circle cx={145} cy={50} r={18} />
        </g>
        <ellipse cx={120} cy={108} rx={55} ry={48} fill="url(#g-lion-face)" />
        {e ? (
          <g stroke="#1a1408" strokeWidth={2.2} fill="none" strokeLinecap="round">
            <path d="M 100 100 Q 105 95 110 100" />
            <path d="M 130 100 Q 135 95 140 100" />
          </g>
        ) : (
          <g fill="#1a1408">
            <circle cx={105} cy={100} r={4} />
            <circle cx={135} cy={100} r={4} />
          </g>
        )}
        <ellipse cx={120} cy={120} rx={6} ry={4.5} fill="#5a2010" />
        <path d="M 120 124 Q 115 132 110 128 M 120 124 Q 125 132 130 128" stroke="#1a1408" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <g stroke="#9a7030" strokeWidth={1} strokeLinecap="round">
          <line x1={94} y1={120} x2={86} y2={119} />
          <line x1={94} y1={123} x2={86} y2={124} />
          <line x1={146} y1={120} x2={154} y2={119} />
          <line x1={146} y1={123} x2={154} y2={124} />
        </g>
        <ellipse cx={120} cy={185} rx={50} ry={32} fill="#fcd86c" />
        <g fill="#a8580f">
          <ellipse cx={88} cy={205} rx={14} ry={8} />
          <ellipse cx={152} cy={205} rx={14} ry={8} />
        </g>
      </>
    ),
  },

  // === Shark (鲨鱼) ===
  shark: {
    viewBox: '5 35 230 165',
    render: (e) => (
      <>
        <defs>
          <linearGradient id="g-shark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a8a98" />
            <stop offset="100%" stopColor="#4a5868" />
          </linearGradient>
        </defs>
        <path d="M 25 120 Q 70 60 175 80 Q 215 95 215 120 Q 215 145 175 160 Q 70 180 25 120 Z" fill="url(#g-shark)" />
        <path d="M 25 120 Q 70 130 175 135 Q 215 132 215 122 Q 215 145 175 160 Q 70 175 25 120 Z" fill="white" />
        <path d="M 100 60 L 110 30 L 130 70 Z" fill="url(#g-shark)" />
        <path d="M 200 100 L 230 90 L 215 115 Z" fill="url(#g-shark)" />
        <path d="M 95 155 L 110 175 L 130 150 Z" fill="url(#g-shark)" />
        <path d="M 145 105 Q 185 105 205 115 L 205 125 Q 185 130 145 130 Z" fill="#1a1408" />
        <g fill="white">
          <polygon points="155,108 158,118 152,118" />
          <polygon points="170,108 173,118 167,118" />
          <polygon points="185,108 188,118 182,118" />
          <polygon points="155,128 158,118 152,118" />
          <polygon points="170,128 173,118 167,118" />
          <polygon points="185,128 188,118 182,118" />
        </g>
        {e ? (
          <path d="M 130 95 Q 135 90 140 95" stroke="#1a1408" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        ) : (
          <>
            <circle cx={135} cy={97} r={4.5} fill="#1a1408" />
            <circle cx={136} cy={95} r={1.5} fill="white" />
          </>
        )}
        <g fill="#3a4858">
          <ellipse cx={75} cy={115} rx={5} ry={2} />
          <ellipse cx={88} cy={115} rx={5} ry={2} />
          <ellipse cx={101} cy={115} rx={5} ry={2} />
        </g>
      </>
    ),
  },
};

const animClassFor = (mood: Mood): string => {
  if (mood === 'thirsty') return 'char-wobble';
  if (mood === 'drinking') return 'char-drink';
  if (mood === 'celebrating') return 'char-cheer';
  return 'char-float';
};

type Props = {
  id: CharacterId;
  mood?: Mood;
  size?: number;
  /** disable wrapper animation (e.g. for grid icons) */
  static?: boolean;
};

export default function Character({ id, mood = 'idle', size = 200, static: isStatic = false }: Props) {
  const spec = CHARACTERS[id];
  if (!spec) return null;
  const eyeClosed = mood === 'drinking' || mood === 'celebrating';
  const cls = isStatic ? 'char-static' : `char-wrap ${animClassFor(mood)}`;

  return (
    <div className={cls} style={{ width: size, display: 'inline-block' }}>
      <svg viewBox={spec.viewBox} width="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden>
        {spec.render(eyeClosed)}
      </svg>
      <style>{`
        .char-wrap, .char-static { will-change: transform; }
        @keyframes char-float  { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes char-wobble { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
        @keyframes char-drink  { 0%,100% { transform: rotate(0); } 30%,60% { transform: rotate(-12deg); } }
        @keyframes char-cheer  { 0%,100% { transform: translateY(0) rotate(0); } 25% { transform: translateY(-10px) rotate(-3deg); } 75% { transform: translateY(-10px) rotate(3deg); } }
        .char-float  { animation: char-float 3.5s ease-in-out infinite; }
        .char-wobble { animation: char-wobble 1.2s ease-in-out infinite; }
        .char-drink  { animation: char-drink 1.4s ease-in-out infinite; }
        .char-cheer  { animation: char-cheer 0.9s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

export { CHARACTERS };
