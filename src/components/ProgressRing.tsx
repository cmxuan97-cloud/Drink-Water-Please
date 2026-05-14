// 圆形进度环，0-100。可以套个图标在中间。
type Props = {
  pct: number;             // 0-100
  size?: number;
  stroke?: number;
  trackColor?: string;
  fillColor?: string;
  children?: React.ReactNode;
};

export default function ProgressRing({
  pct,
  size = 64,
  stroke = 6,
  trackColor = 'rgba(58, 166, 221, 0.18)',
  fillColor = 'var(--accent, #3aa6dd)',
  children,
}: Props) {
  const safePct = Math.max(0, Math.min(100, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (safePct / 100) * c;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={fillColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      {children}
    </div>
  );
}
