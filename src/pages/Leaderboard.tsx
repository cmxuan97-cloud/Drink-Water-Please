import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Flame, Trophy } from 'lucide-react';
import { ANIMALS } from '../data/animals';
import AnimalIcon from '../components/AnimalIcon';
import { fetchLeaderboard, type LeaderboardRow } from '../lib/social';
import { getCurrentUsername } from '../lib/auth';

const medal = (rank: number): { emoji: string; bg: string } => {
  if (rank === 1) return { emoji: '🥇', bg: 'linear-gradient(135deg, #fef3c7, #fcd34d)' };
  if (rank === 2) return { emoji: '🥈', bg: 'linear-gradient(135deg, #f1f5f9, #cbd5e1)' };
  if (rank === 3) return { emoji: '🥉', bg: 'linear-gradient(135deg, #fde68a, #d97706)' };
  return { emoji: '', bg: 'var(--bg-card)' };
};

export default function Leaderboard() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const username = getCurrentUsername();

  useEffect(() => {
    if (!username) { setBusy(false); return; }
    void (async () => {
      const r = await fetchLeaderboard();
      if (r.error) setErr(r.error);
      setRows(r.rows);
      setBusy(false);
    })();
  }, [username]);

  if (!username) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
          <h1 className="page-title">排行榜</h1>
          <span style={{ width: 48 }} />
        </header>
        <div className="card-tinted card-sky" style={{ marginTop: 16, textAlign: 'center' }}>
          <Trophy size={42} strokeWidth={1.6} color="var(--accent-deep)" style={{ marginTop: 8 }} />
          <div style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>登录后才能看排行</div>
          <button
            className="btn btn-full"
            style={{ marginTop: 16 }}
            onClick={() => navigate('/settings?register=1&from=leaderboard')}
          >
            去注册
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
        <h1 className="page-title">排行榜</h1>
        <span style={{ width: 48 }} />
      </header>

      <div className="muted" style={{ fontSize: 13, marginTop: -10, marginBottom: 14 }}>
        按连续达标天数排序 · 包括你和好友
      </div>

      {err && (
        <div className="card-tinted" style={{ background: 'rgba(217,83,79,0.12)', color: '#b03028', fontSize: 13, marginBottom: 12 }}>
          {err}
        </div>
      )}

      {busy ? (
        <div className="muted" style={{ textAlign: 'center', padding: 20 }}>加载中…</div>
      ) : rows.length === 0 ? (
        <div className="card-tinted card-sky" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 36 }}>👥</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 8 }}>还没有好友</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            加几个好友再来比拼
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => navigate('/friends')}>
            去加好友
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row, i) => {
            const rank = i + 1;
            const m = medal(rank);
            const animal = row.companionId ? ANIMALS.find((a) => a.id === row.companionId) : undefined;
            return (
              <div
                key={row.clientId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 12, borderRadius: 14,
                  background: row.isMe ? 'linear-gradient(135deg, #d7eef9, #bfe2f1)' : m.bg,
                  border: row.isMe ? '2px solid var(--accent)' : 'none',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div style={{
                  width: 36, textAlign: 'center', fontSize: 22, fontWeight: 800,
                  color: rank <= 3 ? '#92400e' : 'var(--text-soft)',
                }}>
                  {m.emoji || `#${rank}`}
                </div>
                {animal ? (
                  <AnimalIcon animal={animal} size={42} />
                ) : (
                  <div style={{ width: 42, height: 42, borderRadius: 999, background: 'rgba(0,0,0,0.06)' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>
                    {row.displayName} {row.isMe && <span style={{ fontSize: 11, color: 'var(--accent-deep)' }}>(我)</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 2, fontSize: 11.5, color: 'var(--text-soft)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Flame size={11} color="#f59e0b" /> {row.currentStreak}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Award size={11} color="#a855f7" /> {row.unlockedCount}
                    </span>
                    <span>累计 {row.totalCompletedDays} 天</span>
                  </div>
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 700,
                  color: row.todayPctGoal >= 100 ? '#10b981' : 'var(--text-soft)',
                  minWidth: 40, textAlign: 'right',
                }}>
                  {row.todayPctGoal}%
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
