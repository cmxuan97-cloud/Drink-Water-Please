import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, LogOut, Plus, UserPlus, Users } from 'lucide-react';
import { ANIMALS } from '../data/animals';
import AnimalIcon from '../components/AnimalIcon';
import ProgressRing from '../components/ProgressRing';
import { createTeam, fetchMyTeams, joinTeam, leaveTeam, type Team } from '../lib/social';
import { getCurrentUsername } from '../lib/auth';

export default function Teams() {
  const navigate = useNavigate();
  const username = getCurrentUsername();
  const [teams, setTeams] = useState<Team[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // create/join 表单
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [formBusy, setFormBusy] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const load = async () => {
    setBusy(true);
    setErr(null);
    const r = await fetchMyTeams();
    if (r.error) setErr(r.error);
    setTeams(r.teams);
    setBusy(false);
  };

  useEffect(() => {
    if (!username) { setBusy(false); return; }
    void load();
  }, [username]);

  if (!username) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
          <h1 className="page-title">小队</h1>
          <span style={{ width: 48 }} />
        </header>
        <div className="card-tinted card-sky" style={{ marginTop: 16, textAlign: 'center' }}>
          <Users size={42} strokeWidth={1.6} color="var(--accent-deep)" />
          <div style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>登录后才能组队</div>
          <button
            className="btn btn-full"
            style={{ marginTop: 16 }}
            onClick={() => navigate('/settings?register=1&from=teams')}
          >
            去注册
          </button>
        </div>
      </div>
    );
  }

  const onCreate = async () => {
    if (!newName.trim()) return;
    setFormBusy(true);
    const r = await createTeam(newName);
    setFormBusy(false);
    if (!r.ok) { showToast(r.error ?? '失败'); return; }
    setNewName('');
    setShowCreate(false);
    showToast(`「${newName}」创建好啦，把队码 ${r.joinCode} 发给朋友`);
    void load();
  };

  const onJoin = async () => {
    if (!joinCode.trim()) return;
    setFormBusy(true);
    const r = await joinTeam(joinCode);
    setFormBusy(false);
    if (!r.ok) { showToast(r.error ?? '失败'); return; }
    setJoinCode('');
    setShowJoin(false);
    showToast(`已加入 ${r.name}`);
    void load();
  };

  const onLeave = async (team: Team) => {
    if (!confirm(`确定要离开「${team.name}」？`)) return;
    const r = await leaveTeam(team.id);
    if (!r.ok) { showToast(r.error ?? '失败'); return; }
    showToast('已离开');
    void load();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(
      () => showToast(`已复制队码 ${code}`),
      () => showToast('复制失败，手动选中吧'),
    );
  };

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
        <h1 className="page-title">小队</h1>
        <span style={{ width: 48 }} />
      </header>

      <div className="muted" style={{ fontSize: 13, marginTop: -10, marginBottom: 14 }}>
        和朋友组队一起冲达标 · 最多 5 个小队 / 每队 10 人
      </div>

      {/* 顶部两个 action */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => { setShowCreate(true); setShowJoin(false); }}
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 14,
            background: 'linear-gradient(135deg, #6ee7b7, #10b981)',
            color: 'white', fontWeight: 700, fontSize: 14,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: '0 4px 14px rgba(16,185,129,0.28)',
          }}
        >
          <Plus size={16} /> 创建小队
        </button>
        <button
          onClick={() => { setShowJoin(true); setShowCreate(false); }}
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 14,
            background: 'linear-gradient(135deg, #93c5fd, #3b82f6)',
            color: 'white', fontWeight: 700, fontSize: 14,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: '0 4px 14px rgba(59,130,246,0.28)',
          }}
        >
          <UserPlus size={16} /> 加入小队
        </button>
      </div>

      {/* 创建表单 */}
      {showCreate && (
        <div className="card-tinted card-mint" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>取个队名</div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="例如：早起喝水大队"
            maxLength={20}
            style={{
              width: '100%', padding: '10px 12px',
              borderRadius: 10, border: '1px solid var(--line)',
              background: 'white', fontSize: 14, outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowCreate(false)}>取消</button>
            <button className="btn" style={{ flex: 1 }} onClick={onCreate} disabled={formBusy || !newName.trim()}>
              {formBusy ? '...' : '创建'}
            </button>
          </div>
        </div>
      )}

      {/* 加入表单 */}
      {showJoin && (
        <div className="card-tinted card-sky" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>输入 6 位队码</div>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            autoCapitalize="characters"
            style={{
              width: '100%', padding: '10px 12px',
              borderRadius: 10, border: '1px solid var(--line)',
              background: 'white', fontSize: 16, letterSpacing: 4, fontWeight: 700,
              textAlign: 'center', outline: 'none', fontFamily: 'monospace',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowJoin(false)}>取消</button>
            <button className="btn" style={{ flex: 1 }} onClick={onJoin} disabled={formBusy || joinCode.length !== 6}>
              {formBusy ? '...' : '加入'}
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className="card-tinted" style={{ background: 'rgba(217,83,79,0.12)', color: '#b03028', fontSize: 13, marginBottom: 12 }}>
          {err}
        </div>
      )}

      {/* 小队列表 */}
      {busy ? (
        <div className="muted" style={{ textAlign: 'center', padding: 20 }}>加载中…</div>
      ) : teams.length === 0 ? (
        <div className="card-tinted card-sky" style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 36 }}>🏕️</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginTop: 8 }}>你还没有小队</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            创建一个邀请朋友，或用队码加入别人的
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {teams.map((team) => {
            const allHit = team.memberProfiles.length > 0 && team.memberProfiles.every((m) => m.todayPctGoal >= 100);
            return (
              <div key={team.id} style={{
                background: 'var(--bg-card)', borderRadius: 16, padding: 14,
                boxShadow: 'var(--shadow-card)',
              }}>
                <div className="row-between" style={{ marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17 }}>{team.name}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {team.members.length} 人 · {allHit ? '今日全员达标 🎉' : '加油喝水！'}
                    </div>
                  </div>
                  <button
                    onClick={() => onLeave(team)}
                    aria-label="离开"
                    style={{
                      width: 32, height: 32, borderRadius: 999,
                      background: 'rgba(0,0,0,0.05)', color: 'var(--text-soft)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <LogOut size={14} />
                  </button>
                </div>

                {/* 队码 */}
                <button
                  onClick={() => copyCode(team.joinCode)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(58,166,221,0.10)',
                    color: 'var(--accent-deep)',
                    padding: '5px 10px', borderRadius: 999,
                    fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                    letterSpacing: 2,
                    marginBottom: 12,
                  }}
                >
                  队码 {team.joinCode} <Copy size={11} />
                </button>

                {/* 成员栅格 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10 }}>
                  {team.memberProfiles.map((m) => {
                    const animal = m.companionId ? ANIMALS.find((a) => a.id === m.companionId) : undefined;
                    return (
                      <div key={m.clientId} style={{ textAlign: 'center' }}>
                        <ProgressRing pct={m.todayPctGoal} size={64} stroke={5}>
                          {animal ? <AnimalIcon animal={animal} size={42} /> : '?'}
                        </ProgressRing>
                        <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.displayName}
                        </div>
                        <div style={{ fontSize: 10.5, color: m.todayPctGoal >= 100 ? '#10b981' : 'var(--text-soft)', fontWeight: 600 }}>
                          {m.todayPctGoal}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
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
