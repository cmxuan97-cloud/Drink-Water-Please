type Mood = 'happy' | 'thirsty' | 'cheering' | 'sleepy';

type Props = {
  mood?: Mood;
  size?: number;
};

export default function Mascot({ mood = 'happy', size = 84 }: Props) {
  const eyeShape =
    mood === 'sleepy' ? <path d="M -3 0 Q 0 -2 3 0" stroke="#1a2638" strokeWidth={1.6} fill="none" strokeLinecap="round" /> :
    mood === 'cheering' ? <path d="M -3 1 Q 0 -3 3 1" stroke="#1a2638" strokeWidth={1.8} fill="none" strokeLinecap="round" /> :
    <circle cx={0} cy={0} r={2} fill="#1a2638" />;

  const mouth =
    mood === 'thirsty' ? <ellipse cx={0} cy={4} rx={2.5} ry={3} fill="#1a2638" /> :
    mood === 'cheering' ? <path d="M -4 2 Q 0 7 4 2" stroke="#1a2638" strokeWidth={1.6} fill="none" strokeLinecap="round" /> :
    <path d="M -3 2 Q 0 5 3 2" stroke="#1a2638" strokeWidth={1.6} fill="none" strokeLinecap="round" />;

  const blush = mood !== 'sleepy' && (
    <>
      <ellipse cx={-9} cy={4} rx={3} ry={1.8} fill="#ffb4c8" opacity={0.7} />
      <ellipse cx={9} cy={4} rx={3} ry={1.8} fill="#ffb4c8" opacity={0.7} />
    </>
  );

  return (
    <svg
      width={size}
      height={size * 1.15}
      viewBox="-30 -30 60 70"
      style={{ display: 'block' }}
      aria-label="水滴吉祥物"
    >
      <defs>
        <linearGradient id="drop-grad" x1="0" y1="-1" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfe7fa" />
          <stop offset="100%" stopColor="#3aa6dd" />
        </linearGradient>
        <radialGradient id="drop-hl" cx="0.35" cy="0.4" r="0.35">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* drop body */}
      <path
        d="M 0 -28 C -14 -8 -22 4 -22 14 a 22 22 0 0 0 44 0 c 0 -10 -8 -22 -22 -42 z"
        fill="url(#drop-grad)"
      />
      {/* shine */}
      <ellipse cx={-7} cy={-2} rx={7} ry={11} fill="url(#drop-hl)" />
      {/* face group */}
      <g transform="translate(0 6)">
        {blush}
        <g transform="translate(-6 -2)">{eyeShape}</g>
        <g transform="translate(6 -2)">{eyeShape}</g>
        {mouth}
      </g>
    </svg>
  );
}
