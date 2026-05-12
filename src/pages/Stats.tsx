import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings } from '../lib/storage';
import { dailyGoalMl } from '../lib/goal';
import {
  DayStat,
  getCurrentWeekDates,
  getDayStats,
  getHourlyForDate,
  sameDay,
  shortDate,
  summarize,
  toDateKey,
} from '../lib/stats';

type Tab = 'day' | 'week' | 'month';

const TABS: { value: Tab; label: string }[] = [
  { value: 'day', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];

const WEEK_LETTERS = ['日', '一', '二', '三', '四', '五', '六'];

export default function Stats() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('day');
  const [stats, setStats] = useState<DayStat[]>([]);
  const [goalMl, setGoalMl] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    const settings = getSettings();
    setGoalMl(dailyGoalMl(settings.weightKg));
    setStats(getDayStats(30));
  }, []);

  const weekDates = useMemo(() => getCurrentWeekDates(), []);
  const today = useMemo(() => new Date(), []);

  // 每周 7 天的统计（用于 strip 上的绿点）
  const weekDayMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of stats) map[s.date] = s.drunkMl;
    return map;
  }, [stats]);

  const selectedKey = toDateKey(selectedDate);
  const selectedStat: DayStat = stats.find((s) => s.date === selectedKey) ?? {
    date: selectedKey,
    drunkMl: 0,
    entries: [],
  };
  const hourly = useMemo(() => getHourlyForDate(selectedDate), [selectedDate]);

  const weekStats = useMemo(() => stats.slice(-7), [stats]);
  const monthStats = stats;
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

      {tab === 'day' && (
        <DayView
          weekDates={weekDates}
          today={today}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          weekDayMap={weekDayMap}
          selectedStat={selectedStat}
          hourly={hourly}
          goalMl={goalMl}
        />
      )}
      {tab === 'week' && <BarChartView stats={weekStats} summary={weekSummary} goalMl={goalMl} labelMode="weekday" title="过去 7 天" />}
      {tab === 'month' && <BarChartView stats={monthStats} summary={monthSummary} goalMl={goalMl} labelMode="mmdd" title="过去 30 天" />}
    </div>
  );
}

// === 今日 view 带横向周历 ===
function DayView({
  weekDates,
  today,
  selectedDate,
  onSelectDate,
  weekDayMap,
  selectedStat,
  hourly,
  goalMl,
}: {
  weekDates: Date[];
  today: Date;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  weekDayMap: Record<string, number>;
  selectedStat: DayStat;
  hourly: { hour: number; ml: number }[];
  goalMl: number;
}) {
  const drunk = selectedStat.drunkMl;
  const pct = goalMl > 0 ? Math.min(1, drunk / goalMl) : 0;
  const isToday = sameDay(selectedDate, today);
  const maxBar = Math.max(...hourly.map((h) => h.ml), 100);
  const activeHours = hourly.filter((h) => h.ml > 0).length;

  return (
    <>
      {/* 横向周历 */}
      <div className="card" style={{ padding: '14px 10px' }}>
        <div className="row-between" style={{ paddingLeft: 8, paddingRight: 8, marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            {isToday ? '今天' : `${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            {WEEK_LETTERS[selectedDate.getDay()]}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {weekDates.map((d, i) => {
            const key = toDateKey(d);
            const ml = weekDayMap[key] ?? 0;
            const hit = ml >= goalMl && ml > 0;
            const hasData = ml > 0;
            const isSel = sameDay(d, selectedDate);
            const isTodayCol = sameDay(d, today);
            return (
              <button
                key={key}
                onClick={() => onSelectDate(d)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 2px 8px',
                  background: 'transparent',
                  borderRadius: 12,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: isSel ? 'var(--mint-text)' : 'var(--text-soft)',
                    fontWeight: isSel ? 600 : 400,
                  }}
                >
                  {WEEK_LETTERS[i]}
                </span>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: isTodayCol || isSel ? 700 : 500,
                    background: isSel ? '#c5e8d0' : 'transparent',
                    color: isSel ? 'var(--mint-text)' : 'var(--text)',
                  }}
                >
                  {isTodayCol ? '今' : d.getDate()}
                </span>
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background: hit ? 'var(--mint-text)' : hasData ? 'var(--accent)' : 'transparent',
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* 大数字 + 进度条 + 气泡 */}
      <div className="card-tinted card-sky" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85 }}>
              {isToday ? '今日已喝' : '当天已喝'}
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 6 }}>
              {Math.round(pct * 100)}<span style={{ fontSize: 18, fontWeight: 600 }}>%</span>
            </div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
              {drunk} / {goalMl} ml
            </div>
          </div>
          <CuteBubble drunk={drunk} goalMl={goalMl} />
        </div>
        <div style={{ height: 10, background: 'rgba(255,255,255,0.6)', borderRadius: 999, marginTop: 14, overflow: 'hidden' }}>
          <div
            style={{
              width: `${pct * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #7dd3fc, #3aa6dd)',
              borderRadius: 999,
              transition: 'width 0.5s',
            }}
          />
        </div>
      </div>

      {/* 24 小时分布 */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>📊 24 小时分布</div>
          <div className="muted" style={{ fontSize: 12 }}>{activeHours} 个时段</div>
        </div>
        <HourlyChart hourly={hourly} maxMl={maxBar} />
      </div>

      {/* 今日记录列表 */}
      {selectedStat.entries.length > 0 && (
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 10 }}>💧 当天记录</div>
          <div className="list">
            {selectedStat.entries.slice(0, 8).map((e) => {
              const d = new Date(e.ts);
              const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              return (
                <div key={e.id} className="list-item" style={{ padding: '10px 12px' }}>
                  <span style={{ fontSize: 18 }}>💧</span>
                  <div className="grow">
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{e.ml} ml</div>
                    <div className="muted" style={{ fontSize: 11 }}>{time}</div>
                  </div>
                </div>
              );
            })}
            {selectedStat.entries.length > 8 && (
              <div className="muted" style={{ fontSize: 12, textAlign: 'center', padding: 6 }}>
                还有 {selectedStat.entries.length - 8} 条
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CuteBubble({ drunk, goalMl }: { drunk: number; goalMl: number }) {
  const remaining = Math.max(0, goalMl - drunk);
  const done = drunk >= goalMl && drunk > 0;
  const empty = drunk === 0;
  const text = done
    ? ['🎉', '今天达标', '太棒了']
    : empty
      ? ['💧', '还差', `${goalMl} ml`]
      : ['💪', '还差', `${remaining} ml`];
  return (
    <div
      style={{
        position: 'relative',
        background: 'white',
        borderRadius: 18,
        padding: '8px 12px',
        boxShadow: '0 2px 8px rgba(31,42,68,0.1)',
        fontSize: 12,
        textAlign: 'center',
        minWidth: 80,
      }}
    >
      <div style={{ fontSize: 20, lineHeight: 1 }}>{text[0]}</div>
      <div style={{ marginTop: 2, color: 'var(--text-soft)', fontSize: 11 }}>{text[1]}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: done ? 'var(--mint-text)' : 'var(--accent-deep)' }}>
        {text[2]}
      </div>
      {/* 气泡尾巴 */}
      <div
        style={{
          position: 'absolute',
          left: -7,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 0,
          height: 0,
          borderTop: '6px solid transparent',
          borderBottom: '6px solid transparent',
          borderRight: '8px solid white',
        }}
      />
    </div>
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

      {summary.bestDay && (
        <div className="card">
          <div className="row-between">
            <span className="muted">最佳一天</span>
            <span style={{ fontWeight: 600 }}>
              {summary.bestDay.date.slice(5).replace('-', '/')} · {summary.bestDay.ml} ml
            </span>
          </div>
        </div>
      )}
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
