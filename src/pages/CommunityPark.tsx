// 公共公园 — 看好友主页设的小伙伴 + 互动
// 跟 Park.tsx (我的私人公园) 不同：这里展示的是 friends 的 companionId，不剧透他们的全部解锁。
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplet, MessageCircleHeart, Send, Sparkles, UserSearch } from 'lucide-react';
import { ANIMALS } from '../data/animals';
import Character from '../components/Character';
import { getCurrentUsername } from '../lib/auth';
import {
  fetchFriends, leaveParkNote, sendCheer, sendWater,
  type Friend,
} from '../lib/social';

const CHEER_EMOJIS = ['👏', '🎉', '💪', '❤️', '🔥', '✨'];

type ActionState = null | 'water' | 'cheer' | 'note';

export default function CommunityPark() {
  const navigate = useNavigate();
  const username = useMemo(() => getCurrentUsername(), []);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Interaction sheet state
  const [target, setTarget] = useState<Friend | null>(null);
  const [action, setAction] = useState<ActionState>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  useEffect(() => {
    if (!username) { setBusy(false); return; }
    void (async () => {
      const r = await fetchFriends();
      if (r.error) setErr(r.error);
      setFriends(r.friends ?? []);
      setBusy(false);
    })();
  }, [username]);

  const closeSheet = () => { setTarget(null); setAction(null); setDraft(''); };

  const onSendWater = async () => {
    if (!target) return;
    setPosting(true);
    const r = await sendWater(target.clientId, draft.trim() || undefined);
    setPosting(false);
    if (!r.ok) { showToast(r.error ?? '失败'); return; }
    showToast(`💧 已给 ${target.displayName} 递水`);
    closeSheet();
  };

  const onSendCheer = async (emoji: string) => {
    if (!target) return;
    setPosting(true);
    const r = await sendCheer(target.clientId, emoji);
    setPosting(false);
    if (!r.ok) { showToast(r.error ?? '失败'); return; }
    showToast(`${emoji} 已送达`);
    closeSheet();
  };

  const onLeaveNote = async () => {
    if (!target || !draft.trim()) return;
    setPosting(true);
    const r = await leaveParkNote(target.username, draft.trim());
    setPosting(false);
    if (!r.ok) { showToast(r.error ?? '失败'); return; }
    showToast(`✉️ 留言已送达`);
    closeSheet();
  };

  if (!username) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
          <h1 className="page-title">公共公园</h1>
          <span style={{ width: 48 }} />
        </header>
        <div className="card-tinted card-sky" style={{ marginTop: 16, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>登录后才能进公共公园</div>
          <button
            className="btn btn-full"
            style={{ marginTop: 12 }}
            onClick={() => navigate('/settings?register=1&from=friends')}
          >
            去注册
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
        <h1 className="page-title">公共公园</h1>
        <span style={{ width: 48 }} />
      </header>

      <div className="muted" style={{ fontSize: 13, marginTop: -10, marginBottom: 12 }}>
        看看朋友们的小伙伴在干嘛 · 点一下可以互动
      </div>

      {err && (
        <div className="warn" style={{ fontSize: 13, marginBottom: 12 }}>{err}</div>
      )}

      {busy ? (
        <div className="muted" style={{ textAlign: 'center', padding: 24 }}>加载中…</div>
      ) : friends.length === 0 ? (
        <div className="card-tinted card-sky" style={{ textAlign: 'center', padding: 22 }}>
          <UserSearch size={36} strokeWidth={1.5} style={{ marginBottom: 8, color: 'var(--accent-deep)' }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>公园里还没有朋友</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            加几个好友，他们的小伙伴会出现在这里
          </div>
          <button
            className="btn"
            style={{ marginTop: 14 }}
            onClick={() => navigate('/friends')}
          >
            去找朋友 →
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
        }}>
          {friends.map((f) => (
            <FriendLot key={f.clientId} friend={f} onTap={() => { setTarget(f); setAction(null); }} />
          ))}
        </div>
      )}

      {/* === Interaction sheet === */}
      {target && (
        <div
          onClick={closeSheet}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(20,40,60,0.5)', zIndex: 60,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 20,
              width: '100%',
              maxWidth: 480,
              boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
            }}
          >
            {/* Target preview */}
            <div className="row" style={{ gap: 12, marginBottom: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 999, background: 'rgba(58,166,221,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {(() => {
                  const a = target.companionId ? ANIMALS.find((x) => x.id === target.companionId) : undefined;
                  return a ? <Character id={a.customArt} mood="idle" size={48} static /> : <span style={{ fontSize: 22 }}>?</span>;
                })()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{target.displayName}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  今日 {target.todayPctGoal}% · 🔥 {target.currentStreak} 天
                </div>
              </div>
            </div>

            {action === null && (
              <>
                <button className="btn-pill" style={pillStyle} onClick={() => setAction('water')}>
                  <Droplet size={16} color="#3aa6dd" /> 递杯水
                </button>
                <button className="btn-pill" style={pillStyle} onClick={() => setAction('cheer')}>
                  <Sparkles size={16} color="#f59e0b" /> 送鼓励
                </button>
                <button className="btn-pill" style={pillStyle} onClick={() => setAction('note')}>
                  <MessageCircleHeart size={16} color="#ec4899" /> 留言
                </button>
                <button
                  className="btn-pill"
                  style={{ ...pillStyle, color: 'var(--text-soft)' }}
                  onClick={() => { closeSheet(); navigate(`/u/${target.username}/park`); }}
                >
                  去 Ta 的主页 →
                </button>
                <button
                  className="btn-pill"
                  style={{ ...pillStyle, color: 'var(--text-mute)', marginTop: 8 }}
                  onClick={closeSheet}
                >
                  关闭
                </button>
              </>
            )}

            {action === 'water' && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                  💧 给 {target.displayName} 递杯水
                </div>
                <input
                  className="input"
                  placeholder="留个话（可选）"
                  value={draft}
                  maxLength={80}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                />
                <button className="btn btn-full" style={{ marginTop: 10 }} onClick={onSendWater} disabled={posting}>
                  <Send size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
                  {posting ? '送出中…' : '送出'}
                </button>
                <button className="btn-pill" style={{ ...pillStyle, marginTop: 8, color: 'var(--text-soft)' }} onClick={() => setAction(null)}>
                  ← 返回
                </button>
              </div>
            )}

            {action === 'cheer' && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                  ✨ 送个鼓励给 {target.displayName}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                  {CHEER_EMOJIS.map((e) => (
                    <button
                      key={e}
                      disabled={posting}
                      onClick={() => onSendCheer(e)}
                      style={{
                        fontSize: 28, padding: 8,
                        background: 'rgba(245,158,11,0.08)',
                        borderRadius: 14,
                        aspectRatio: '1 / 1',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <button className="btn-pill" style={{ ...pillStyle, marginTop: 10, color: 'var(--text-soft)' }} onClick={() => setAction(null)}>
                  ← 返回
                </button>
              </div>
            )}

            {action === 'note' && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                  ✉️ 给 {target.displayName} 留言
                </div>
                <textarea
                  className="input"
                  placeholder="说点什么（120 字以内）"
                  value={draft}
                  maxLength={120}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  autoFocus
                  style={{ resize: 'vertical', minHeight: 70 }}
                />
                <button
                  className="btn btn-full"
                  style={{ marginTop: 10 }}
                  onClick={onLeaveNote}
                  disabled={posting || !draft.trim()}
                >
                  <Send size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
                  {posting ? '送出中…' : '送出'}
                </button>
                <button className="btn-pill" style={{ ...pillStyle, marginTop: 8, color: 'var(--text-soft)' }} onClick={() => setAction(null)}>
                  ← 返回
                </button>
              </div>
            )}
          </div>
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

const pillStyle: CSSProperties = {
  width: '100%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '13px 16px',
  fontSize: 14,
  fontWeight: 600,
  background: 'rgba(0,0,0,0.04)',
  marginBottom: 6,
};

// === 单个朋友的「公园角落」 ===
function FriendLot({ friend, onTap }: { friend: Friend; onTap: () => void }) {
  const animal = friend.companionId ? ANIMALS.find((a) => a.id === friend.companionId) : undefined;
  // 根据进度选 mood — 让朋友的小伙伴根据 Ta 今天的状态展示不同表情
  const pct = friend.todayPctGoal;
  const mood: 'happy' | 'idle' | 'thirsty' | 'dying' =
    pct >= 100 ? 'happy' :
    pct >= 50  ? 'idle' :
    pct >= 20  ? 'thirsty' :
                 'dying';

  return (
    <button
      onClick={onTap}
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, #d1eebe, #a5d68f)',
        borderRadius: 18,
        padding: 12,
        textAlign: 'center',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      {/* grass blade decoration */}
      <span style={{ position: 'absolute', bottom: 4, left: 10, fontSize: 14, opacity: 0.45 }}>🌱</span>
      <span style={{ position: 'absolute', bottom: 4, right: 10, fontSize: 14, opacity: 0.45 }}>🌸</span>

      <div style={{
        height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {animal ? (
          <Character id={animal.customArt} mood={mood} size={84} />
        ) : (
          <div style={{ fontSize: 40, opacity: 0.5 }}>?</div>
        )}
      </div>
      <div style={{
        marginTop: 4,
        fontWeight: 700, fontSize: 13,
        color: '#0c3d12',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {friend.displayName}
      </div>
      <div style={{
        fontSize: 11, color: '#2a6b30', fontWeight: 600, marginTop: 2,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        <span>今日 {pct}%</span>
        <span>·</span>
        <span>🔥 {friend.currentStreak}</span>
      </div>
    </button>
  );
}
