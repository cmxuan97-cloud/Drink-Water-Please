import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Search, Tent, Trees, Trophy, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { ANIMALS } from '../data/animals';
import AnimalIcon from '../components/AnimalIcon';
import FriendCard from '../components/FriendCard';
import {
  ackInbox, fetchFriends, fetchInbox, removeFriend, respondToRequest,
  searchUsers, sendFriendRequest,
  type Friend, type FriendRequest, type InboxEvent, type SearchResult,
} from '../lib/social';
import { getCurrentUsername } from '../lib/auth';
import { syncProfile } from '../lib/profile';

type Tab = 'friends' | 'inbox' | 'requests' | 'search';

export default function Friends() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [inbox, setInbox] = useState<InboxEvent[]>([]);
  const [unread, setUnread] = useState(0);
  // 初始 loaded=false → 显示 skeleton，避免进页面瞬间闪一下"没有好友"
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 搜索
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  const username = useMemo(() => getCurrentUsername(), []);

  const loadFriends = useCallback(async () => {
    if (!username) return;
    setErr(null);
    const [fr, ib] = await Promise.all([fetchFriends(), fetchInbox()]);
    if (fr.error) setErr(fr.error);
    setFriends(fr.friends);
    setIncoming(fr.incoming);
    setOutgoing(fr.outgoing);
    setInbox(ib.events);
    setUnread(ib.unread);
    setLoaded(true);
  }, [username]);

  // 进入 inbox tab 时自动标记已读
  useEffect(() => {
    if (tab !== 'inbox' || !username || inbox.length === 0) return;
    void ackInbox();
    setUnread(0);
  }, [tab, username, inbox.length]);

  useEffect(() => {
    if (!username) return;
    // 先推一份最新的 profile 上去，再加载好友列表
    void (async () => {
      await syncProfile();
      await loadFriends();
    })();
  }, [username, loadFriends]);

  // 搜索 debounce
  useEffect(() => {
    if (tab !== 'search') return;
    const q = searchQ.trim();
    if (!q) { setSearchResults([]); return; }
    const t = window.setTimeout(async () => {
      setSearching(true);
      const r = await searchUsers(q);
      setSearchResults(r.results);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ, tab]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const onSendRequest = async (user: SearchResult) => {
    if (sentTo.has(user.username)) return;
    setSentTo(prev => new Set(prev).add(user.username));
    const r = await sendFriendRequest(user.username);
    if (!r.ok) {
      setSentTo(prev => { const n = new Set(prev); n.delete(user.username); return n; });
      showToast(r.error ?? '发送失败');
    } else {
      showToast(r.autoAccepted ? `${user.displayName} 已成为好友` : `请求已发给 ${user.displayName}`);
      void loadFriends();
    }
  };

  const onRespond = async (req: FriendRequest, accept: boolean) => {
    const r = await respondToRequest(req.clientId, accept);
    if (!r.ok) {
      showToast(r.error ?? '处理失败');
      return;
    }
    showToast(accept ? `${req.displayName} 加入好友 🎉` : '已忽略');
    void loadFriends();
  };

  const onRemove = async (friend: Friend) => {
    if (!confirm(`从好友列表移除 ${friend.displayName}？`)) return;
    const r = await removeFriend(friend.clientId);
    if (!r.ok) { showToast(r.error ?? '删除失败'); return; }
    showToast('已移除');
    void loadFriends();
  };

  if (!username) {
    // 未注册账号 → 引导到 settings 的注册面板
    return (
      <div className="page">
        <header className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
          <h1 className="page-title">好友</h1>
          <span style={{ width: 48 }} />
        </header>
        <div
          className="card-tinted"
          style={{
            marginTop: 16,
            textAlign: 'center',
            background: 'linear-gradient(135deg, #fef3c7, #fcd34d)',
            paddingBottom: 24,
          }}
        >
          <div style={{ fontSize: 48, marginTop: 4 }}>👋💧</div>
          <div style={{ fontWeight: 800, fontSize: 19, marginTop: 8, color: '#78350f' }}>
            跟朋友一起喝水吧！
          </div>
          <div style={{ fontSize: 14, marginTop: 10, lineHeight: 1.7, color: '#92400e' }}>
            注册个账号就能加好友<br />
            互相看见今天有没有喝水、互递杯水
          </div>
          <button
            className="btn btn-full"
            style={{
              marginTop: 22,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: 'white',
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(217,119,6,0.32)',
            }}
            onClick={() => navigate('/settings?register=1&from=friends')}
          >
            <Users size={15} style={{ marginRight: 6, verticalAlign: -2 }} /> 去注册
          </button>
        </div>
      </div>
    );
  }

  const reqBadge = incoming.length > 0 ? incoming.length : null;

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
        <h1 className="page-title">好友</h1>
        <span style={{ width: 48 }} />
      </header>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -10, marginBottom: 14 }}>
        <div className="muted" style={{ fontSize: 13 }}>@{username}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => navigate('/leaderboard')}
            style={{
              padding: '6px 12px', borderRadius: 999,
              background: 'rgba(245,158,11,0.12)', color: '#b45309',
              fontSize: 12, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <Trophy size={13} /> 排行榜
          </button>
          <button
            onClick={() => navigate('/teams')}
            style={{
              padding: '6px 12px', borderRadius: 999,
              background: 'rgba(16,185,129,0.12)', color: '#047857',
              fontSize: 12, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <Tent size={13} /> 小队
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        background: 'var(--bg-card)',
        borderRadius: 14,
        padding: 4,
        gap: 2,
        boxShadow: 'var(--shadow-card)',
        marginBottom: 16,
      }}>
        {([
          { id: 'friends', label: `好友 ${friends.length || ''}`.trim() },
          { id: 'inbox', label: '收件', badge: unread > 0 ? unread : null },
          { id: 'requests', label: '请求', badge: reqBadge },
          { id: 'search', label: '搜索' },
        ] as Array<{ id: Tab; label: string; badge?: number | null }>).map(t => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '10px 8px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                color: active ? 'white' : 'var(--text-soft)',
                background: active ? 'var(--accent)' : 'transparent',
                position: 'relative',
                transition: 'background 0.18s, color 0.18s',
              }}
            >
              {t.label}
              {t.badge ? (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  minWidth: 16, height: 16, padding: '0 4px',
                  borderRadius: 999, fontSize: 10,
                  fontWeight: 700, color: 'white',
                  background: '#ef4444',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{t.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {err && (
        <div className="card-tinted" style={{ background: 'rgba(217,83,79,0.12)', color: '#b03028', fontSize: 13, marginBottom: 12 }}>
          {err}
        </div>
      )}

      {/* 公共公园入口 — 显眼大按钮 */}
      <button
        onClick={() => navigate('/community')}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '16px 18px',
          borderRadius: 18,
          background: 'linear-gradient(135deg, #a8d850, #6cab30)',
          color: 'white',
          border: 'none',
          boxShadow: '0 6px 18px rgba(60, 130, 40, 0.28)',
          cursor: 'pointer',
          textAlign: 'left',
          marginBottom: 14,
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'rgba(255,255,255,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Trees size={26} strokeWidth={2} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2 }}>去公共公园</div>
          <div style={{ fontSize: 12, opacity: 0.92, marginTop: 3 }}>
            看朋友的小伙伴 · 一起互动
          </div>
        </div>
        <span style={{ fontSize: 22, opacity: 0.9, fontWeight: 600 }}>›</span>
      </button>

      {/* === FRIENDS TAB === */}
      {tab === 'friends' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!loaded ? (
            // 加载中 — 显示 skeleton 卡片占位，不要闪 "没有好友"
            <>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: 12, background: 'var(--bg-card)', borderRadius: 16,
                  boxShadow: 'var(--shadow-card)', opacity: 0.5,
                }}>
                  <div style={{ width: 72, height: 72, borderRadius: 999, background: 'rgba(0,0,0,0.06)' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ height: 14, width: '60%', background: 'rgba(0,0,0,0.06)', borderRadius: 6 }} />
                    <div style={{ height: 11, width: '40%', background: 'rgba(0,0,0,0.05)', borderRadius: 6 }} />
                    <div style={{ height: 11, width: '70%', background: 'rgba(0,0,0,0.04)', borderRadius: 6, marginTop: 4 }} />
                  </div>
                </div>
              ))}
            </>
          ) : friends.length === 0 ? (
            <div className="card-tinted card-sky" style={{ textAlign: 'center', padding: 20 }}>
              <Users size={36} strokeWidth={1.5} color="var(--accent-deep)" style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 700, fontSize: 15 }}>还没有好友</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                去搜索栏找朋友的用户名加好友
              </div>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 14, fontSize: 13 }}
                onClick={() => setTab('search')}
              >
                <Search size={14} style={{ marginRight: 4 }} /> 去搜索
              </button>
            </div>
          ) : (
            friends.map(f => (
              <div key={f.clientId} style={{ position: 'relative' }}>
                <FriendCard friend={f} onAction={showToast} />
                <button
                  onClick={() => onRemove(f)}
                  aria-label="移除好友"
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 28, height: 28, borderRadius: 999,
                    background: 'rgba(0,0,0,0.04)', color: 'var(--text-mute)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <UserMinus size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* === INBOX TAB === */}
      {tab === 'inbox' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {inbox.length === 0 ? (
            <div className="card-tinted card-sky" style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 36 }}>📭</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginTop: 8 }}>暂时没有消息</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                好友送来的水和加油会出现在这里
              </div>
            </div>
          ) : (
            inbox.map((ev) => {
              const animal = ev.fromCompanionId
                ? ANIMALS.find(a => a.id === ev.fromCompanionId)
                : ev.fromCharId ? ANIMALS.find(a => a.customArt === ev.fromCharId) : undefined;
              const isWater = ev.type === 'water';
              const isNote = ev.type === 'note';
              const mins = Math.max(1, Math.round((Date.now() - ev.createdAt) / 60000));
              const ago = mins < 60 ? `${mins}分钟前` : mins < 1440 ? `${Math.round(mins / 60)}小时前` : `${Math.round(mins / 1440)}天前`;
              const bg = isWater
                ? 'rgba(58,166,221,0.18)'
                : isNote
                  ? 'rgba(16,185,129,0.18)'
                  : 'rgba(245,158,11,0.18)';
              const badge = isWater ? '💧' : isNote ? '✉️' : (ev.emoji ?? '🎉');
              const verb = isWater
                ? '叫你去喝水 💧'
                : isNote
                  ? '在你主页留言 ✉️'
                  : `送了 ${ev.emoji ?? '🎉'} 给你`;
              return (
                <div key={ev.uid} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: 12, background: 'var(--bg-card)', borderRadius: 14,
                  boxShadow: 'var(--shadow-card)',
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 999,
                    background: bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    position: 'relative',
                  }}>
                    {animal ? <AnimalIcon animal={animal} size={42} /> : '?'}
                    <span style={{
                      position: 'absolute', bottom: -2, right: -2,
                      fontSize: 16, background: 'white',
                      width: 22, height: 22, borderRadius: 999,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                    }}>
                      {badge}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>
                      <span style={{ fontWeight: 700 }}>{ev.fromDisplayName}</span>{' '}
                      <span style={{ color: 'var(--text-soft)' }}>{verb}</span>
                    </div>
                    {ev.text && (isNote || isWater) && (
                      <div style={{ fontSize: 13, marginTop: 3, color: 'var(--text)', fontStyle: 'italic' }}>
                        "{ev.text}"
                      </div>
                    )}
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{ago}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* === REQUESTS TAB === */}
      {tab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              收到的请求 {incoming.length > 0 && `(${incoming.length})`}
            </div>
            {incoming.length === 0 ? (
              <div className="muted" style={{ fontSize: 13, padding: 10 }}>暂时没有新请求</div>
            ) : (
              incoming.map(req => {
                const animal = req.companionId
                  ? ANIMALS.find(a => a.id === req.companionId)
                  : req.charId ? ANIMALS.find(a => a.customArt === req.charId) : undefined;
                return (
                  <div key={req.clientId} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: 12, background: 'var(--bg-card)', borderRadius: 14,
                    boxShadow: 'var(--shadow-card)', marginBottom: 8,
                  }}>
                    <div style={{ width: 48, height: 48, borderRadius: 999, background: 'rgba(58,166,221,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {animal ? <AnimalIcon animal={animal} size={42} /> : '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{req.displayName}</div>
                      <div className="muted" style={{ fontSize: 12 }}>@{req.username}</div>
                    </div>
                    <button
                      onClick={() => onRespond(req, true)}
                      aria-label="接受"
                      style={{
                        width: 36, height: 36, borderRadius: 999,
                        background: '#10b981', color: 'white',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => onRespond(req, false)}
                      aria-label="拒绝"
                      style={{
                        width: 36, height: 36, borderRadius: 999,
                        background: 'rgba(0,0,0,0.06)', color: 'var(--text-soft)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, marginTop: 8 }}>
              我发出的 {outgoing.length > 0 && `(${outgoing.length})`}
            </div>
            {outgoing.length === 0 ? (
              <div className="muted" style={{ fontSize: 13, padding: 10 }}>没有等待中的请求</div>
            ) : (
              outgoing.map(req => (
                <div key={req.clientId} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: 10, background: 'var(--bg-card)', borderRadius: 12,
                  boxShadow: 'var(--shadow-card)', marginBottom: 6, opacity: 0.7,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>{req.displayName}</div>
                    <div className="muted" style={{ fontSize: 11 }}>@{req.username} · 等待对方接受</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* === SEARCH TAB === */}
      {tab === 'search' && (
        <div>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-mute)' }} />
            <input
              type="text"
              placeholder="输入用户名搜索"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              style={{
                width: '100%', padding: '12px 14px 12px 40px',
                borderRadius: 12, border: '1px solid var(--line)',
                background: 'var(--bg-card)', fontSize: 15,
                outline: 'none',
              }}
            />
          </div>

          {searching && <div className="muted" style={{ fontSize: 13, padding: 8 }}>搜索中…</div>}
          {!searching && searchQ && searchResults.length === 0 && (
            <div className="muted" style={{ fontSize: 13, padding: 8 }}>没找到匹配的用户</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {searchResults.map(u => {
              const animal = u.companionId
                ? ANIMALS.find(a => a.id === u.companionId)
                : u.charId ? ANIMALS.find(a => a.customArt === u.charId) : undefined;
              const sent = sentTo.has(u.username);
              return (
                <div key={u.username} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: 10, background: 'var(--bg-card)', borderRadius: 12,
                  boxShadow: 'var(--shadow-card)',
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 999, background: 'rgba(58,166,221,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {animal ? <AnimalIcon animal={animal} size={38} /> : '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.displayName}</div>
                    <div className="muted" style={{ fontSize: 12 }}>@{u.username}</div>
                  </div>
                  <button
                    onClick={() => onSendRequest(u)}
                    disabled={sent}
                    style={{
                      padding: '7px 12px', borderRadius: 999,
                      fontSize: 13, fontWeight: 600,
                      background: sent ? 'rgba(0,0,0,0.06)' : 'var(--accent)',
                      color: sent ? 'var(--text-soft)' : 'white',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {sent ? <>已发送</> : <><UserPlus size={13} /> 加</>}
                  </button>
                </div>
              );
            })}
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
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          zIndex: 100,
          animation: 'fadeUp 0.25s ease-out',
        }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translate(-50%,8px)} to{opacity:1;transform:translate(-50%,0)} }
      `}</style>
    </div>
  );
}
