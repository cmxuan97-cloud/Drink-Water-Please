import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings } from '../lib/storage';
import { dailyGoalMl } from '../lib/goal';
import {
  DayStat,
  getCurrentMonthDates,
  getCurrentMonthStats,
  getCurrentWeekDates,
  getDayStats,
  getHourlyForDate,
  getPreviousPeriodStats,
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
  const [prevWeekStats, setPrevWeekStats] = useState<DayStat[]>([]);
  const [prevMonthStats, setPrevMonthStats] = useState<DayStat[]>([]);
  const [goalMl, setGoalMl] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    const settings = getSettings();
    setGoalMl(dailyGoalMl(settings.weightKg));
    setStats(getDayStats(30));
    setPrevWeekStats(getPreviousPeriodStats(7));
    setPrevMonthStats(getPreviousPeriodStats(30));
  }, []);

  const weekDates = useMemo(() => getCurrentWeekDates(), []);
  const today = useMemo(() => new Date(), []);

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
  const prevWeekSummary = useMemo(() => summarize(prevWeekStats, goalMl), [prevWeekStats, goalMl]);
  const prevMonthSummary = useMemo(() => summarize(prevMonthStats, goalMl), [prevMonthStats, goalMl]);

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
        <h1 className="page-title">喝水记录</h1>
        <span style={{ width: 48 }} />
      </header>

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
      {tab === 'week' && (
        <WeekView
          stats={weekStats}
          summary={weekSummary}
          prev={prevWeekSummary}
          goalMl={goalMl}
        />
      )}
      {tab === 'month' && (
        <MonthView
          stats={monthStats}
          summary={monthSummary}
          prev={prevMonthSummary}
          goalMl={goalMl}
        />
      )}
    </div>
  );
}

// === 今日 view ===
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
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 4, padding: '6px 2px 8px', background: 'transparent',
                  borderRadius: 12, cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 11, color: isSel ? 'var(--mint-text)' : 'var(--text-soft)', fontWeight: isSel ? 600 : 400 }}>
                  {WEEK_LETTERS[i]}
                </span>
                <span style={{
                  width: 32, height: 32, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  borderRadius: 999, fontSize: 14,
                  fontWeight: isTodayCol || isSel ? 700 : 500,
                  background: isSel ? '#c5e8d0' : 'transparent',
                  color: isSel ? 'var(--mint-text)' : 'var(--text)',
                }}>
                  {isTodayCol ? '今' : d.getDate()}
                </span>
                <span style={{
                  width: 5, height: 5, borderRadius: 999,
                  background: hit ? 'var(--mint-text)' : hasData ? 'var(--accent)' : 'transparent',
                }} />
              </button>
            );
          })}
        </div>
      </div>

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
          <div style={{
            width: `${pct * 100}%`, height: '100%',
            background: 'linear-gradient(90deg, #7dd3fc, #3aa6dd)',
            borderRadius: 999, transition: 'width 0.5s',
          }} />
        </div>
      </div>

      <div className="card">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>📊 24 小时分布</div>
          <div className="muted" style={{ fontSize: 12 }}>{activeHours} 个时段</div>
        </div>
        <HourlyChart hourly={hourly} maxMl={maxBar} />
      </div>

      {selectedStat.entries.length > 0 && <DayEntries entries={selectedStat.entries} />}
    </>
  );
}

function DayEntries({ entries }: { entries: DayStat['entries'] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? entries : entries.slice(0, 3);
  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700 }}>💧 当天记录</div>
        <span className="muted" style={{ fontSize: 12 }}>{entries.length} 条</span>
      </div>
      <div className="list">
        {visible.map((e) => {
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
      </div>
      {entries.length > 3 && (
        <button
          className="btn-pill btn-full"
          onClick={() => setShowAll((v) => !v)}
          style={{ marginTop: 10, background: 'var(--accent-soft)' }}
        >
          {showAll ? '收起' : `查看全部 ${entries.length} 条`}
        </button>
      )}
    </div>
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
    <div style={{
      position: 'relative', background: 'white', borderRadius: 18,
      padding: '8px 12px', boxShadow: '0 2px 8px rgba(31,42,68,0.1)',
      fontSize: 12, textAlign: 'center', minWidth: 80,
    }}>
      <div style={{ fontSize: 20, lineHeight: 1 }}>{text[0]}</div>
      <div style={{ marginTop: 2, color: 'var(--text-soft)', fontSize: 11 }}>{text[1]}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: done ? 'var(--mint-text)' : 'var(--accent-deep)' }}>
        {text[2]}
      </div>
      <div style={{
        position: 'absolute', left: -7, top: '50%',
        transform: 'translateY(-50%)', width: 0, height: 0,
        borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
        borderRight: '8px solid white',
      }} />
    </div>
  );
}

// =====================================================
// === 本周 view: 丰富版 ===
// =====================================================
type Sum = ReturnType<typeof summarize>;

function WeekView({ stats, summary, prev, goalMl }: {
  stats: DayStat[]; summary: Sum; prev: Sum; goalMl: number;
}) {
  const totalDelta = prev.totalMl > 0
    ? Math.round(((summary.totalMl - prev.totalMl) / prev.totalMl) * 100)
    : null;

  const insight = makeWeekInsight(summary, prev);
  const today = useMemo(() => new Date(), []);

  return (
    <>
      {/* Hero: 本周总计 + 上周对比 */}
      <div className="card-tinted card-sky" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, letterSpacing: 0.5 }}>本周总计</div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 4 }}>
              {(summary.totalMl / 1000).toFixed(1)}<span style={{ fontSize: 18, fontWeight: 600, opacity: 0.7 }}> L</span>
            </div>
          </div>
          {totalDelta !== null && (
            <DeltaBadge delta={totalDelta} label="vs 上周" />
          )}
        </div>
        <div style={{ position: 'absolute', right: -16, bottom: -16, fontSize: 100, opacity: 0.1 }}>💧</div>
      </div>

      {/* Stats 网格 2x2 */}
      <div className="stats-grid">
        <StatTile emoji="🎯" label="达标天" value={`${summary.daysHit}/7`} accent="#22c55e" />
        <StatTile
          emoji="🔥"
          label={summary.currentStreak > 0 ? '当前连击' : '最长连击'}
          value={`${summary.currentStreak > 0 ? summary.currentStreak : summary.longestStreak} 天`}
          accent="#f97316"
        />
        <StatTile
          emoji="📊"
          label="日均"
          value={`${summary.avgPerDay > 0 ? Math.round(summary.avgPerDay / 100) / 10 : 0} L`}
          accent="#3b82f6"
        />
        <StatTile
          emoji="🏆"
          label="最佳一天"
          value={summary.bestDay ? `${(summary.bestDay.ml / 100) / 10 || (summary.bestDay.ml / 1000).toFixed(1)} L` : '—'}
          accent="#a855f7"
        />
      </div>

      {/* 7 天纵向柱状图，更鲜艳 */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700 }}>📈 这 7 天</div>
          <div className="muted" style={{ fontSize: 11 }}>红→黄→绿 = 0%→100% 目标</div>
        </div>
        <WeekBars stats={stats} goalMl={goalMl} today={today} />
      </div>

      {/* Insight */}
      {insight && (
        <div
          className="card-tinted"
          style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{insight.emoji}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{insight.title}</div>
              <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85, lineHeight: 1.5 }}>{insight.body}</div>
            </div>
          </div>
        </div>
      )}

      <BarChartStyles />
    </>
  );
}

// =====================================================
// === 本月 view: heatmap + stats ===
// =====================================================
function MonthView({ stats, summary, prev, goalMl }: {
  stats: DayStat[]; summary: Sum; prev: Sum; goalMl: number;
}) {
  const totalDelta = prev.totalMl > 0
    ? Math.round(((summary.totalMl - prev.totalMl) / prev.totalMl) * 100)
    : null;
  const today = useMemo(() => new Date(), []);
  const monthDates = useMemo(() => getCurrentMonthDates(today), [today]);
  const monthMap = useMemo(() => getCurrentMonthStats(today), [today]);
  const monthName = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}`;

  // 本月 stats（截止今天）
  const monthSoFar = monthDates.filter((d) => d <= today);
  const monthSoFarStats = monthSoFar.map((d) => ({
    date: toDateKey(d),
    drunkMl: monthMap.get(toDateKey(d)) ?? 0,
    entries: [],
  }));
  const monthSoFarSummary = useMemo(
    () => summarize(monthSoFarStats, goalMl),
    [monthSoFarStats, goalMl],
  );

  return (
    <>
      {/* Hero: 本月总计 + 同比 */}
      <div className="card-tinted card-sky" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, letterSpacing: 0.5 }}>本月 · {monthName}</div>
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 4 }}>
              {(monthSoFarSummary.totalMl / 1000).toFixed(1)}<span style={{ fontSize: 18, fontWeight: 600, opacity: 0.7 }}> L</span>
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              已过 {monthSoFar.length} / {monthDates.length} 天
            </div>
          </div>
          {totalDelta !== null && (
            <DeltaBadge delta={totalDelta} label="vs 上月" />
          )}
        </div>
        <div style={{ position: 'absolute', right: -16, bottom: -16, fontSize: 100, opacity: 0.1 }}>📅</div>
      </div>

      {/* Stats 网格 */}
      <div className="stats-grid">
        <StatTile
          emoji="🎯"
          label="达标率"
          value={monthSoFar.length > 0 ? `${Math.round((monthSoFarSummary.daysHit / monthSoFar.length) * 100)}%` : '—'}
          accent="#22c55e"
        />
        <StatTile
          emoji="🔥"
          label="最长连击"
          value={`${monthSoFarSummary.longestStreak} 天`}
          accent="#f97316"
        />
        <StatTile
          emoji="📊"
          label="日均"
          value={`${monthSoFarSummary.avgPerDay > 0 ? (monthSoFarSummary.avgPerDay / 1000).toFixed(1) : 0} L`}
          accent="#3b82f6"
        />
        <StatTile
          emoji="🏆"
          label="最佳"
          value={monthSoFarSummary.bestDay ? `${(monthSoFarSummary.bestDay.ml / 1000).toFixed(1)} L` : '—'}
          accent="#a855f7"
        />
      </div>

      {/* 月历热力图 */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700 }}>📅 月历热力图</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 10, color: 'var(--text-soft)' }}>
            <span>少</span>
            <HeatLegend />
            <span>多</span>
          </div>
        </div>
        <MonthHeatmap monthDates={monthDates} monthMap={monthMap} goalMl={goalMl} today={today} />
      </div>

      {/* 过去 30 天 趋势 bar */}
      <div className="card">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700 }}>📈 过去 30 天趋势</div>
          <div className="muted" style={{ fontSize: 11 }}>虚线 = 目标</div>
        </div>
        <DayBarChart stats={stats} goalMl={goalMl} labelMode="mmdd" />
      </div>

      <BarChartStyles />
    </>
  );
}

// =====================================================
// === 共用组件 ===
// =====================================================
function StatTile({ emoji, label, value, accent }: {
  emoji: string; label: string; value: string; accent: string;
}) {
  return (
    <div className="stat-tile">
      <div style={{ fontSize: 22 }}>{emoji}</div>
      <div style={{ fontSize: 19, fontWeight: 800, color: accent, letterSpacing: '-0.01em', marginTop: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function DeltaBadge({ delta, label }: { delta: number; label: string }) {
  const up = delta > 0;
  const flat = delta === 0;
  const color = flat ? '#94a3b8' : up ? '#16a34a' : '#dc2626';
  const arrow = flat ? '→' : up ? '↑' : '↓';
  return (
    <div style={{
      background: 'white',
      borderRadius: 14,
      padding: '8px 12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      textAlign: 'center',
      minWidth: 78,
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: '-0.02em' }}>
        {arrow} {Math.abs(delta)}%
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-soft)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function WeekBars({ stats, goalMl, today }: {
  stats: DayStat[]; goalMl: number; today: Date;
}) {
  const max = Math.max(...stats.map((s) => s.drunkMl), goalMl);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, height: 160, paddingTop: 10 }}>
      {stats.map((s) => {
        const pct = max > 0 ? s.drunkMl / max : 0;
        const goalPct = goalMl > 0 ? s.drunkMl / goalMl : 0;
        const hit = s.drunkMl >= goalMl && s.drunkMl > 0;
        const isToday = sameDay(new Date(s.date), today);
        const day = new Date(s.date);

        // 颜色按达标比例
        let color = '#e5e7eb'; // empty
        if (s.drunkMl > 0) {
          if (hit) color = '#22c55e';
          else if (goalPct >= 0.66) color = '#84cc16';
          else if (goalPct >= 0.33) color = '#f59e0b';
          else color = '#ef4444';
        }

        return (
          <div key={s.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, height: '100%' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%' }}>
              {hit && <div style={{ textAlign: 'center', fontSize: 14, marginBottom: 2 }}>🏆</div>}
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(pct * 100, s.drunkMl > 0 ? 6 : 4)}%`,
                  background: color,
                  borderRadius: 8,
                  transition: 'height 0.5s cubic-bezier(.2,.7,.2,1)',
                  boxShadow: hit ? '0 0 12px rgba(34,197,94,0.35)' : undefined,
                  position: 'relative',
                }}
              >
                {s.drunkMl > 0 && (
                  <div style={{
                    position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 10, fontWeight: 600, color: 'var(--text-soft)', whiteSpace: 'nowrap',
                  }}>
                    {Math.round(s.drunkMl / 100) / 10}L
                  </div>
                )}
              </div>
            </div>
            <div style={{
              fontSize: 11,
              fontWeight: isToday ? 700 : 500,
              color: isToday ? 'var(--accent-deep)' : 'var(--text-soft)',
            }}>
              {WEEK_LETTERS[day.getDay()]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthHeatmap({ monthDates, monthMap, goalMl, today }: {
  monthDates: Date[]; monthMap: Map<string, number>; goalMl: number; today: Date;
}) {
  // 月初对齐：第一行的开始要看月初是周几（0=日）
  const firstDow = monthDates[0].getDay();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (const d of monthDates) cells.push(d);
  // 补齐到 7 的倍数
  while (cells.length % 7 !== 0) cells.push(null);

  const colorFor = (ml: number, isFuture: boolean): string => {
    if (isFuture) return '#f8fafc';
    if (ml === 0) return '#e5e7eb';
    const ratio = goalMl > 0 ? ml / goalMl : 0;
    if (ratio >= 1) return '#22c55e';
    if (ratio >= 0.66) return '#84cc16';
    if (ratio >= 0.33) return '#f59e0b';
    return '#fca5a5';
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {WEEK_LETTERS.map((l) => (
          <div key={l} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-soft)' }}>{l}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`empty-${i}`} style={{ aspectRatio: '1' }} />;
          const key = toDateKey(d);
          const ml = monthMap.get(key) ?? 0;
          const isFuture = d > today;
          const isToday = sameDay(d, today);
          const bg = colorFor(ml, isFuture);
          const hit = !isFuture && ml >= goalMl && ml > 0;
          return (
            <div
              key={key}
              title={`${d.getMonth() + 1}/${d.getDate()} · ${ml} ml`}
              style={{
                aspectRatio: '1',
                background: bg,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: hit ? 700 : 500,
                color: ml > goalMl * 0.5 ? 'white' : 'var(--text-soft)',
                border: isToday ? '2px solid var(--accent-deep)' : 'none',
                position: 'relative',
              }}
            >
              {d.getDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeatLegend() {
  const colors = ['#e5e7eb', '#fca5a5', '#f59e0b', '#84cc16', '#22c55e'];
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {colors.map((c) => (
        <div key={c} style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
      ))}
    </div>
  );
}

function makeWeekInsight(summary: Sum, prev: Sum): { emoji: string; title: string; body: string } | null {
  if (summary.daysWithRecord === 0) return null;
  if (summary.daysHit === 7) {
    return { emoji: '🏆', title: '完美一周！', body: '7 天全部达标，节奏稳得不行 — 继续保持哦' };
  }
  if (summary.currentStreak >= 3) {
    return { emoji: '🔥', title: `连击 ${summary.currentStreak} 天`, body: '已经连续达标 3 天以上，这就是好习惯诞生的样子' };
  }
  if (prev.totalMl > 0 && summary.totalMl > prev.totalMl * 1.2) {
    return { emoji: '📈', title: '比上周喝得多', body: '本周喝水量比上周高了 20% 以上，进步明显' };
  }
  if (summary.daysHit === 0 && summary.daysWithRecord > 0) {
    return { emoji: '💪', title: '还在路上', body: '本周有记录但还没达标，下一杯就能开始连击' };
  }
  if (summary.daysHit >= 4) {
    return { emoji: '👍', title: `这周达标 ${summary.daysHit} 天`, body: '一半以上的日子都喝够了，节奏不错' };
  }
  return null;
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
              x={x} y={y} width={barW - 2} height={barH} rx={2}
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

function DayBarChart({ stats, goalMl, labelMode }: {
  stats: DayStat[]; goalMl: number; labelMode: 'weekday' | 'mmdd';
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
              x={x} y={y} width={barW - 2} height={barH} rx={2}
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

function BarChartStyles() {
  return (
    <style>{`
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
      .stat-tile {
        background: var(--bg-card);
        border-radius: 16px;
        padding: 14px 12px;
        text-align: center;
        box-shadow: var(--shadow-card);
      }
    `}</style>
  );
}
