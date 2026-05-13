import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, Bell, BarChart3, Cloud, Droplet,
  Key, LogIn, RefreshCw, Target, TrendingUp, User, Users,
} from 'lucide-react';

type Stats = {
  asOf: string;
  counts: {
    pushSubscriptions: number;
    subscriptionRecords: number;
    stateBackups: number;
    registeredAccounts: number;
    backupCodes: number;
    progressRecords: number;
  };
  activity: { activeLastHour: number; activeLast24h: number; sampleSize: number };
  today: { date: string; usersWithDrink: number; goalHit: number; totalLitres: number; sampleSize: number };
  health: { totalFailedAcks: number; avgFailedAcksPerSub: number };
  distribution: {
    topCompanions: Array<[string, number]>;
    pushModeBreakdown: Record<string, number>;
  };
};

type UserRow = {
  clientId: string;
  username: string | null;
  displayName: string | null;
  hasPush: boolean;
  pushMode: string | null;
  companion: string | null;
  tz: string | null;
  lastSentMinAgo: number | null;
  lastAckMinAgo: number | null;
  failedAcks: number;
  todayDrunkMl: number | null;
  todayGoalMl: number | null;
  todayPct: number | null;
  hasState: boolean;
};

const K_ADMIN_SECRET = 'dw:adminSecret';

export default function Admin() {
  const navigate = useNavigate();
  const [secret, setSecret] = useState<string>(() => sessionStorage.getItem(K_ADMIN_SECRET) || '');
  const [authed, setAuthed] = useState<boolean>(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<'recent' | 'drunk' | 'fails'>('recent');

  const fetchAll = async (sec: string, sortBy: string) => {
    setLoading(true);
    setError(null);
    try {
      const [statsResp, usersResp] = await Promise.all([
        fetch(`/api/admin/stats?secret=${encodeURIComponent(sec)}`),
        fetch(`/api/admin/users?secret=${encodeURIComponent(sec)}&sort=${sortBy}&limit=200`),
      ]);
      if (!statsResp.ok) {
        const j = await statsResp.json().catch(() => ({}));
        throw new Error(j.error || `stats ${statsResp.status}`);
      }
      if (!usersResp.ok) {
        const j = await usersResp.json().catch(() => ({}));
        throw new Error(j.error || `users ${usersResp.status}`);
      }
      const sj = await statsResp.json();
      const uj = await usersResp.json();
      setStats(sj);
      setUsers(uj.rows ?? []);
      setAuthed(true);
      sessionStorage.setItem(K_ADMIN_SECRET, sec);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  };

  // 进入页面如果 sessionStorage 有 secret 自动登录
  useEffect(() => {
    const cached = sessionStorage.getItem(K_ADMIN_SECRET);
    if (cached) void fetchAll(cached, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 排序变更
  useEffect(() => {
    if (authed && secret) void fetchAll(secret, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const onLogin = (e: React.FormEvent) => {
    e.preventDefault();
    void fetchAll(secret, sort);
  };

  const onLogout = () => {
    sessionStorage.removeItem(K_ADMIN_SECRET);
    setSecret('');
    setAuthed(false);
    setStats(null);
    setUsers([]);
  };

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/')}>← 返回</button>
        <h1 className="page-title">📊 Admin</h1>
        <span style={{ width: 48 }}>
          {authed && (
            <button
              className="btn-pill"
              onClick={onLogout}
              style={{ fontSize: 11, padding: '4px 10px' }}
            >登出</button>
          )}
        </span>
      </header>

      {!authed && (
        <form className="card" onSubmit={onLogin}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Key size={18} />
            <div style={{ fontWeight: 700, fontSize: 16 }}>Admin Login</div>
          </div>
          <input
            className="input"
            type="password"
            placeholder="ADMIN_SECRET"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoFocus
          />
          {error && (
            <div className="warn" style={{ marginTop: 10, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          <button
            className="btn btn-full"
            style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            type="submit"
            disabled={loading || !secret}
          >
            {loading ? '…' : (<><LogIn size={15} /> 登录</>)}
          </button>
          <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
            密钥在 Vercel 项目的 Environment Variables 里加 <code>ADMIN_SECRET</code> 字段（≥8 位）。仅本地 sessionStorage 缓存，关浏览器即失效。
          </div>
        </form>
      )}

      {authed && stats && (
        <>
          <div className="row-between" style={{ marginTop: 4, marginBottom: 4 }}>
            <span className="muted" style={{ fontSize: 11 }}>
              更新于 {new Date(stats.asOf).toLocaleTimeString('zh-CN', { hour12: false })}
            </span>
            <button
              className="btn-pill"
              onClick={() => fetchAll(secret, sort)}
              disabled={loading}
              style={{ fontSize: 11, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <RefreshCw size={12} className={loading ? 'spin' : ''} /> 刷新
            </button>
          </div>

          {/* === 顶部统计卡片 === */}
          <div className="admin-grid">
            <AdminTile Icon={Users} label="注册账号" value={stats.counts.registeredAccounts} accent="#a855f7" />
            <AdminTile Icon={Cloud} label="云备份用户" value={stats.counts.stateBackups} accent="#3b82f6" />
            <AdminTile Icon={Bell} label="已订阅推送" value={stats.counts.pushSubscriptions} accent="#f97316" />
            <AdminTile Icon={Activity} label="1h 内活跃" value={stats.activity.activeLastHour} accent="#22c55e" />
            <AdminTile Icon={User} label="24h 活跃" value={stats.activity.activeLast24h} accent="#10b981" />
            <AdminTile Icon={Key} label="备份码已生成" value={stats.counts.backupCodes} accent="#eab308" />
          </div>

          {/* === 今日数据 === */}
          <div className="card-tinted card-sky" style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 600 }}>今日 ({stats.today.date})</div>
            <div className="row-between" style={{ marginTop: 8 }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {stats.today.totalLitres} <span style={{ fontSize: 16, opacity: 0.7 }}>L</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>所有用户今日总饮水</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  <Droplet size={16} style={{ display: 'inline', verticalAlign: -2 }} /> {stats.today.usersWithDrink} 人
                </div>
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>有记录 · 达标 {stats.today.goalHit} 人</div>
              </div>
            </div>
          </div>

          {/* === 健康状况 === */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Target size={16} /> 推送健康
            </div>
            <div className="row-between" style={{ fontSize: 12 }}>
              <span className="muted">累计未 ack 次数（样本 {stats.activity.sampleSize}）</span>
              <span style={{ fontWeight: 700 }}>{stats.health.totalFailedAcks}</span>
            </div>
            <div className="row-between" style={{ fontSize: 12, marginTop: 4 }}>
              <span className="muted">平均每订阅未 ack</span>
              <span style={{ fontWeight: 700 }}>{stats.health.avgFailedAcksPerSub}</span>
            </div>
            <div className="muted" style={{ fontSize: 10, marginTop: 6 }}>
              连续 50 次未 ack 会自动清理（zombie cleanup）
            </div>
          </div>

          {/* === 流行度 === */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <TrendingUp size={16} /> 主页伙伴 Top 5
            </div>
            {stats.distribution.topCompanions.length === 0 ? (
              <div className="muted" style={{ fontSize: 12 }}>暂无数据</div>
            ) : (
              <div>
                {stats.distribution.topCompanions.map(([id, count]) => (
                  <div key={id} className="row-between" style={{ fontSize: 12, padding: '4px 0' }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace' }}>{id}</span>
                    <span style={{ fontWeight: 700 }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <BarChart3 size={16} /> 推送频率偏好
            </div>
            {Object.entries(stats.distribution.pushModeBreakdown).map(([m, c]) => (
              <div key={m} className="row-between" style={{ fontSize: 12, padding: '4px 0' }}>
                <span>{m}</span>
                <span style={{ fontWeight: 700 }}>{c}</span>
              </div>
            ))}
          </div>

          {/* === 用户列表 === */}
          <div className="card">
            <div className="row-between" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={16} /> 用户 ({users.length})
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['recent', 'drunk', 'fails'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={sort === s ? 'btn-pill btn-pill-active' : 'btn-pill'}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                  >
                    {s === 'recent' ? '最近' : s === 'drunk' ? '喝最多' : '失败最多'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {users.map((u) => (
                <div key={u.clientId} className="admin-user-row">
                  <div className="row-between">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                      {u.username ? (
                        <span style={{ fontWeight: 700, fontSize: 13 }}>@{u.username}</span>
                      ) : (
                        <span className="muted" style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
                          {u.clientId.slice(0, 12)}…
                        </span>
                      )}
                      {u.hasPush && <Bell size={11} style={{ color: '#16a34a' }} />}
                      {u.hasState && <Cloud size={11} style={{ color: '#3b82f6' }} />}
                    </div>
                    {u.todayPct !== null && (
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        color: u.todayPct >= 100 ? '#16a34a' : u.todayPct >= 50 ? '#eab308' : '#dc2626',
                      }}>{u.todayPct}%</span>
                    )}
                  </div>
                  <div className="row-between muted" style={{ fontSize: 11, marginTop: 4 }}>
                    <span>
                      {u.companion || '(none)'}
                      {u.pushMode && ` · ${u.pushMode}`}
                      {u.todayDrunkMl !== null && ` · ${u.todayDrunkMl} ml`}
                    </span>
                    <span>
                      {u.failedAcks > 0 && (
                        <span style={{ color: '#dc2626' }}>fails: {u.failedAcks}</span>
                      )}
                      {u.failedAcks > 0 && ' · '}
                      ack {u.lastAckMinAgo === null ? '—' : `${u.lastAckMinAgo}m`}
                    </span>
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <div className="muted" style={{ fontSize: 12, textAlign: 'center', padding: 16 }}>
                  暂无用户数据
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style>{`
        .admin-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .admin-tile {
          background: var(--bg-card);
          border-radius: 14px;
          padding: 10px 8px;
          text-align: center;
          box-shadow: var(--shadow-card);
        }
        .admin-tile-value {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .admin-tile-label {
          font-size: 10px;
          color: var(--text-soft);
          margin-top: 2px;
          line-height: 1.3;
        }
        .admin-user-row {
          background: var(--bg-card);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function AdminTile({ Icon, label, value, accent }: {
  Icon: typeof Bell; label: string; value: number; accent: string;
}) {
  return (
    <div className="admin-tile">
      <Icon size={18} color={accent} strokeWidth={1.8} />
      <div className="admin-tile-value" style={{ color: accent }}>{value}</div>
      <div className="admin-tile-label">{label}</div>
    </div>
  );
}
