import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings } from '../lib/storage';
import { dailyGoalMl } from '../lib/goal';
import { DayStat, getDayStats, getTodayHourly, shortDate, summarize } from '../lib/stats';

type Tab = 'day' | 'week' | 'month';

const TABS: { value: Tab; label: string }[] = [
  { value: 'day', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];

export default function Stats() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('day');
  const [stats, setStats] = useState<DayStat[]>([]);
  const [hourly, setHourly] = useState<{ hour: number; ml: number }[]>([]);
  const [goalMl, setGoalMl] = useState(0);

  useEffect(() => {
    const settings = getSettings();
    setGoalMl(dailyGoalMl(settings.weightKg));
    setStats(getDayStats(30));
    setHourly(getTodayHourly());
  }, []);

  const weekStats = useMemo(() => stats.slice(-7), [stats]);
  const monthStats = stats;
  const todayStat = stats[stats.length - 1];
  const todaySummary = useMemo(() => summarize([todayStat].filter(Boolean), goalMl), [todayStat, goalMl]);
  const weekSummary = useMemo(() => summarize(weekStats, goalMl), [weekStats, goalMl]);
  const monthSummary = useMemo(() => summarize(monthStats, goalMl), [monthStats, goalMl]);

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
        <h1 className="page-title">喝水记录</h1>
        <span style={{ width: 48 }} />
      </header>

      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={active ? 'btn-pill btn-pill-active' : 'btn-pill'}
              style={{ padding: '10px 4px' }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'day' && <DayView hourly={hourly} todayStat={todayStat} summary={todaySummary} goalMl={goalMl} />}
      {tab === 'week' && <BarChartView stats={weekStats} summary={weekSummary} goalMl={goalMl} labelMode="weekday" title="过去 7 天" />}
      {tab === 'month' && <BarChartView stats={monthStats} summary={monthSummary} goalMl={goalMl} labelMode="mmdd" title="过去 30 天" />}
    </div>
  );
}

// === 今日：小时分布 ===
function DayView({
  hourly,
  todayStat,
  summary,
  goalMl,
}: {
  hourly: { hour: number; ml: number }[];
  todayStat: DayStat | undefined;
  summary: ReturnType<typeof summarize>;
  goalMl: number;
}) {
  const drunk = todayStat?.drunkMl ?? 0;
  const remaining = Math.max(0, goalMl - drunk);
  const pct = goalMl > 0 ? Math.min(1, drunk / goalMl) : 0;
  const maxBar = Math.max(...hourly.map((h) => h.ml), 100);
  const activeHours = hourly.filter((h) => h.ml > 0).length;

  return (
    <>
      {/* hero summary */}
      <div className="card-tinted card-sky" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85 }}>今日已喝</div>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 4 }}>
          {drunk} ml
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
          目标 {goalMl} ml · {drunk >= goalMl ? '🎉 已达标' : `还差 ${remaining} ml`}
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.5)', borderRadius: 999, marginTop: 12, overflow: 'hidden' }}>
          <div
            style={{
              width: `${pct * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #7dd3fc, #3aa6dd)',
              borderRadius: 999,
              transition: 'width 0.4s',
            }}
          />
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>📊 24 小时分布</div>
        <HourlyChart hourly={hourly} maxMl={maxBar} />
        <div className="row-between" style={{ marginTop: 10 }}>
          <span className="muted">活跃小时数</span>
          <span style={{ fontWeight: 600 }}>{activeHours} / 24</span>
        </div>
        <div className="row-between" style={{ marginTop: 4 }}>
          <span className="muted">记录条数</span>
          <span style={{ fontWeight: 600 }}>{todayStat?.entries.length ?? 0}</span>
        </div>
      </div>

      <Footer summary={summary} />
    </>
  );
}

// === 本周/本月：日维度柱状图 ===
function BarChartView({
  stats,
  summary,
  goalMl,
  labelMode,
  title,
}: {
  stats: DayStat[];
  summary: ReturnType<typeof summarize>;
  goalMl: number;
  labelMode: 'weekday' | 'mmdd';
  title: string;
}) {
  return (
    <>
      <div className="card-tinted card-sky">
        <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85 }}>{title} · 总计</div>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 4 }}>
          {(summary.totalMl / 1000).toFixed(1)} L
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
          达标 {summary.daysHit} / {summary.daysTotal} 天 · 平均每天 {summary.avgPerDay} ml
        </div>
      </div>

      <div className="card">
        <DayBarChart stats={stats} goalMl={goalMl} labelMode={labelMode} />
      </div>

      <Footer summary={summary} />
    </>
  );
}

function HourlyChart({ hourly, maxMl }: { hourly: { hour: number; ml: number }[]; maxMl: number }) {
  const W = 320;
  const H = 120;
  const barW = W / 24;
  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" style={{ display: 'block' }}>
      {hourly.map((h, i) => {
        const barH = h.ml > 0 ? Math.max(2, (h.ml / maxMl) * H) : 0;
        const x = i * barW + 1;
        const y = H - barH;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW - 2}
              height={barH}
              rx={2}
              fill={h.ml > 0 ? 'url(#h-grad)' : 'transparent'}
            />
            {(i % 3 === 0 || i === 23) && (
              <text x={x + (barW - 2) / 2} y={H + 14} textAnchor="middle" fontSize="9" fill="#647c91">
                {i}
              </text>
            )}
          </g>
        );
      })}
      <defs>
        <linearGradient id="h-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#3aa6dd" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function DayBarChart({
  stats,
  goalMl,
  labelMode,
}: {
  stats: DayStat[];
  goalMl: number;
  labelMode: 'weekday' | 'mmdd';
}) {
  const W = 320;
  const H = 160;
  const barW = W / stats.length;
  const maxMl = Math.max(...stats.map((s) => s.drunkMl), goalMl);
  const goalY = H - (goalMl / maxMl) * H;

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" style={{ display: 'block' }}>
      {/* goal line */}
      <line x1={0} y1={goalY} x2={W} y2={goalY} stroke="#3aa6dd" strokeDasharray="3 3" strokeWidth={1} opacity={0.5} />
      <text x={W - 4} y={goalY - 4} textAnchor="end" fontSize="9" fill="#3aa6dd">
        目标 {goalMl}ml
      </text>

      {stats.map((s, i) => {
        const barH = s.drunkMl > 0 ? Math.max(2, (s.drunkMl / maxMl) * H) : 0;
        const x = i * barW + 1;
        const y = H - barH;
        const hit = s.drunkMl >= goalMl && s.drunkMl > 0;
        return (
          <g key={s.date}>
            <rect
              x={x}
              y={y}
              width={barW - 2}
              height={barH}
              rx={2}
              fill={hit ? 'url(#d-grad-hit)' : s.drunkMl > 0 ? 'url(#d-grad)' : 'transparent'}
            />
            {(stats.length <= 7 || i % Math.ceil(stats.length / 7) === 0 || i === stats.length - 1) && (
              <text x={x + (barW - 2) / 2} y={H + 14} textAnchor="middle" fontSize="9" fill="#647c91">
                {shortDate(s.date, labelMode)}
              </text>
            )}
          </g>
        );
      })}

      <defs>
        <linearGradient id="d-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#3aa6dd" />
        </linearGradient>
        <linearGradient id="d-grad-hit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7cd49a" />
          <stop offset="100%" stopColor="#3a8a5a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function Footer({ summary }: { summary: ReturnType<typeof summarize> }) {
  if (!summary.bestDay) return null;
  return (
    <div className="card">
      <div className="row-between">
        <span className="muted">最佳一天</span>
        <span style={{ fontWeight: 600 }}>
          {summary.bestDay.date.slice(5).replace('-', '/')} · {summary.bestDay.ml} ml
        </span>
      </div>
    </div>
  );
}
