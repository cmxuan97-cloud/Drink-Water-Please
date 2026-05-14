// 好友的公园（只读）：动物收集格 + 留言区
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Award, Calendar, Droplet, Flame, Gift, Send, Trophy } from 'lucide-react';
import { ANIMALS } from '../data/animals';
import AnimalIcon from '../components/AnimalIcon';
import ProgressRing from '../components/ProgressRing';
import { leaveParkNote, visitFriendPark, type ParkNote, type PublicProfile } from '../lib/social';
import { getCurrentUsername } from '../lib/auth';

export default function FriendPark() {
  const navigate = useNavigate();
  const { username: targetUsername } = useParams<{ username: string }>();
  const myUsername = getCurrentUsername();

  const [profile, setProfile] = useState<(PublicProfile & { clientId: string }) | null>(null);
  const [notes, setNotes] = useState<ParkNote[]>([]);
  const [isSelf, setIsSelf] = useState(false);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const load = async () => {
    if (!targetUsername) return;
    setBusy(true);
    const r = await visitFriendPark(targetUsername);
    if (r.error) setErr(r.error);
    setProfile(r.profile ?? null);
    setNotes(r.notes);
    setIsSelf(r.isSelf);
    setBusy(false);
  };

  useEffect(() => {
    if (!myUsername || !targetUsername) { setBusy(false); return; }
    void load();
  }, [myUsername, targetUsername]);

  const onPost = async () => {
    if (!draft.trim() || !targetUsername) return;
    setPosting(true);
    const r = await leaveParkNote(targetUsername, draft);
    setPosting(false);
    if (!r.ok) { showToast(r.error ?? '失败'); return; }
    setDraft('');
    showToast('留言已送达 ✉️');
    if (r.note) setNotes((prev) => [r.note!, ...prev]);
  };

  if (!myUsername) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
          <h1 className="page-title">好友公园</h1>
          <span style={{ width: 48 }} />
        </header>
        <div className="card-tinted card-sky" style={{ marginTop: 16, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>登录后才能逛公园</div>
          <button
            className="btn btn-full"
            style={{ marginTop: 16 }}
            onClick={() => navigate('/settings?register=1&from=friends')}
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
        <h1 className="page-title">{isSelf ? '我的公园' : `${profile?.displayName ?? '...'}的公园`}</h1>
        <span style={{ width: 48 }} />
      </header>

      {err && (
        <div className="card-tinted" style={{ background: 'rgba(217,83,79,0.12)', color: '#b03028', fontSize: 13 }}>
          {err}
        </div>
      )}

      {busy ? (
        <div className="muted" style={{ textAlign: 'center', padding: 20 }}>加载中…</div>
      ) : profile ? (
        <>
          {/* === Hero / profile === */}
          <div
            className="card-tinted"
            style={{
              background: 'linear-gradient(135deg, #a8d850, #6cab30)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* 草地装饰 */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.15, pointerEvents: 'none' }}>
              <svg viewBox="0 0 100 60" width="100%" height="100%" preserveAspectRatio="none">
                <ellipse cx="20" cy="55" rx="14" ry="3" fill="white" />
                <ellipse cx="55" cy="50" rx="18" ry="3" fill="white" />
                <ellipse cx="82" cy="56" rx="12" ry="3" fill="white" />
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
              <ProgressRing
                pct={profile.todayPctGoal}
                size={88}
                stroke={7}
                trackColor="rgba(255,255,255,0.32)"
                fillColor="white"
              >
                {(() => {
                  const animal = profile.companionId ? ANIMALS.find((a) => a.id === profile.companionId) : undefined;
                  return animal ? <AnimalIcon animal={animal} size={60} /> : <span style={{ fontSize: 36 }}>?</span>;
                })()}
              </ProgressRing>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 19 }}>{profile.displayName}</div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>@{profile.username}</div>
                <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 13 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Flame size={14} /> {profile.currentStreak} 天
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Award size={14} /> {profile.unlockedCount}
                  </span>
                  <span style={{ fontWeight: 700 }}>今日 {profile.todayPctGoal}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* === 动物收集 (仅自己可见) 或 成就板 (好友访客) === */}
          {isSelf ? (
            <div style={{ marginTop: 16 }}>
              <div className="row-between" style={{ marginBottom: 8 }}>
                <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700 }}>我的小伙伴</h2>
                <span className="muted" style={{ fontSize: 12 }}>{profile.unlockedCount} 只</span>
              </div>
              <div style={{
                background: 'linear-gradient(180deg, #c9e9b1, #a5d68f)',
                borderRadius: 16,
                padding: 14,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
                gap: 12,
                boxShadow: 'var(--shadow-card)',
              }}>
                {(profile.unlockedIds ?? []).map((id) => {
                  const animal = ANIMALS.find((a) => a.id === id);
                  if (!animal) return null;
                  const isCompanion = profile.companionId === id;
                  return (
                    <div key={id} style={{ position: 'relative', textAlign: 'center' }}>
                      <div style={{
                        background: 'rgba(255,255,255,0.7)',
                        borderRadius: 14,
                        padding: 6,
                        border: isCompanion ? '2px solid #f59e0b' : 'none',
                        boxShadow: '0 2px 6px rgba(0,40,0,0.12)',
                      }}>
                        <AnimalIcon animal={animal} size={48} />
                      </div>
                      {isCompanion && (
                        <span style={{
                          position: 'absolute', top: -6, right: -4,
                          fontSize: 14, background: 'white',
                          width: 20, height: 20, borderRadius: 999,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.18)',
                        }}>👑</span>
                      )}
                      <div style={{
                        fontSize: 10, fontWeight: 600,
                        marginTop: 4,
                        color: '#1a4010',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {animal.name.slice(0, 4)}
                      </div>
                    </div>
                  );
                })}
                {(profile.unlockedIds ?? []).length === 0 && (
                  <div className="muted" style={{ gridColumn: '1 / -1', textAlign: 'center', fontSize: 13, padding: 12 }}>
                    Ta 还没解锁动物
                  </div>
                )}
              </div>
            </div>
          ) : (
            <AchievementBoard profile={profile} totalAnimals={ANIMALS.length} />
          )}

          {/* === 留言板 === */}
          <div style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: 16, margin: 0, marginBottom: 8, fontWeight: 700 }}>
              {isSelf ? '收到的留言' : '在公园里留个言'}
            </h2>

            {!isSelf && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="留个言（120 字以内）"
                  maxLength={120}
                  onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) onPost(); }}
                  style={{
                    flex: 1, padding: '10px 14px',
                    borderRadius: 999, border: '1px solid var(--line)',
                    background: 'var(--bg-card)', fontSize: 14, outline: 'none',
                  }}
                />
                <button
                  onClick={onPost}
                  disabled={posting || !draft.trim()}
                  style={{
                    width: 44, height: 44, borderRadius: 999,
                    background: draft.trim() ? 'var(--accent)' : 'rgba(0,0,0,0.06)',
                    color: 'white',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.18s',
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notes.length === 0 ? (
                <div className="muted" style={{ fontSize: 13, padding: 12, textAlign: 'center' }}>
                  {isSelf ? '还没收到留言' : '还没人留过言 — 来当第一个吧'}
                </div>
              ) : (
                notes.map((n) => {
                  const animal = n.fromCharId ? ANIMALS.find((a) => a.customArt === n.fromCharId) : undefined;
                  const mins = Math.max(1, Math.round((Date.now() - n.createdAt) / 60000));
                  const ago = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
                  return (
                    <div key={n.uid} style={{
                      display: 'flex', gap: 10,
                      padding: 12, background: 'var(--bg-card)',
                      borderRadius: 14, boxShadow: 'var(--shadow-card)',
                    }}>
                      <div style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(58,166,221,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {animal ? <AnimalIcon animal={animal} size={36} /> : '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{n.fromDisplayName}</span>
                          <span className="muted" style={{ fontSize: 11 }}>{ago}</span>
                        </div>
                        <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.4 }}>
                          {n.message}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="muted" style={{ textAlign: 'center', padding: 20 }}>找不到这个用户</div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 'max(28px, env(safe-area-inset-bottom, 16px))', left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(31,42,68,0.94)', color: 'white',
          padding: '10px 18px', borderRadius: 999,
          fontSize: 13, fontWeight: 500,
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)', zIndex: 100,
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// === 访客看到的成就板（隐藏具体动物，避免剧透） ===
function AchievementBoard({
  profile, totalAnimals,
}: {
  profile: PublicProfile & { clientId: string };
  totalAnimals: number;
}) {
  const drunkMl = profile.todayDrunkMl ?? 0;
  const pct = profile.todayPctGoal ?? 0;
  const peak = profile.peakStreak ?? Math.max(profile.currentStreak, 0);
  return (
    <div style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 16, margin: 0, marginBottom: 8, fontWeight: 700 }}>Ta 的成就</h2>

      {/* 今日 — 全宽 + 进度条 */}
      <div style={{
        background: 'linear-gradient(135deg, #e7f4ff, #cfe6ff)',
        borderRadius: 16,
        padding: 14,
        boxShadow: 'var(--shadow-card)',
        marginBottom: 10,
      }}>
        <div className="row-between" style={{ marginBottom: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1d5d8f', fontWeight: 600 }}>
            <Droplet size={14} /> 今日
          </span>
          <span style={{ fontSize: 13, color: '#1d5d8f', fontWeight: 700 }}>{pct}%</span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#0c3d66' }}>
          {drunkMl} <span style={{ fontSize: 13, fontWeight: 500, color: '#3b6f99' }}>ml</span>
        </div>
        <div style={{
          marginTop: 8, height: 8, borderRadius: 999,
          background: 'rgba(0,0,0,0.06)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(100, pct)}%`, height: '100%',
            background: 'linear-gradient(90deg, #7dd3fc, #3aa6dd)',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* 2×2 stat grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
      }}>
        <StatCard
          icon={<Flame size={14} color="#f97316" />}
          label="当前 streak"
          value={profile.currentStreak}
          unit="天连续"
          tint="rgba(249,115,22,0.10)"
        />
        <StatCard
          icon={<Trophy size={14} color="#f59e0b" />}
          label="最长 streak"
          value={peak}
          unit="天"
          tint="rgba(245,158,11,0.10)"
        />
        <StatCard
          icon={<Calendar size={14} color="#10b981" />}
          label="累计达标"
          value={profile.totalCompletedDays}
          unit="天"
          tint="rgba(16,185,129,0.10)"
        />
        <StatCard
          icon={<Gift size={14} color="#a855f7" />}
          label="解锁进度"
          value={profile.unlockedCount}
          unit={`/ ${totalAnimals}`}
          tint="rgba(168,85,247,0.10)"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, unit, tint,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  unit: string;
  tint: string;
}) {
  return (
    <div style={{
      background: tint,
      border: '1px solid rgba(0,0,0,0.04)',
      borderRadius: 14,
      padding: 12,
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-soft)', fontWeight: 600 }}>
        {icon}
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
        {value}
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-soft)', marginLeft: 4 }}>
          {unit}
        </span>
      </div>
    </div>
  );
}
