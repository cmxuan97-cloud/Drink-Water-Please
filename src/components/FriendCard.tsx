import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ANIMALS } from '../data/animals';
import { sendCheer, sendWater, type Friend } from '../lib/social';
import AnimalIcon from './AnimalIcon';
import ProgressRing from './ProgressRing';
import { Award, Flame, Trees } from 'lucide-react';

const CHEER_OPTIONS = ['🎉', '❤️', '👏', '💪', '🌟', '🔥'];

type Props = {
  friend: Friend;
  onAction?: (msg: string) => void;
};

export default function FriendCard({ friend, onAction }: Props) {
  const animal = friend.companionId ? ANIMALS.find(a => a.id === friend.companionId) : undefined;
  const [busy, setBusy] = useState(false);
  const [showCheers, setShowCheers] = useState(false);

  const onSendWater = async () => {
    if (busy) return;
    setBusy(true);
    const r = await sendWater(friend.clientId);
    setBusy(false);
    onAction?.(r.ok ? `给 ${friend.displayName} 递了杯水 💧` : (r.error ?? '失败'));
  };

  const onSendCheer = async (emoji: string) => {
    setShowCheers(false);
    if (busy) return;
    setBusy(true);
    const r = await sendCheer(friend.clientId, emoji);
    setBusy(false);
    onAction?.(r.ok ? `已发送 ${emoji} 给 ${friend.displayName}` : (r.error ?? '失败'));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        background: 'var(--bg-card)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ProgressRing pct={friend.todayPctGoal} size={72} stroke={6}>
          {animal ? (
            <AnimalIcon animal={animal} size={48} />
          ) : (
            <div style={{
              width: 48, height: 48, borderRadius: 999,
              background: 'rgba(58,166,221,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
            }}>?</div>
          )}
        </ProgressRing>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
            {friend.displayName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>
            @{friend.username}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: 'var(--text-soft)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Flame size={12} color="#f59e0b" /> {friend.currentStreak} 天
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Award size={12} color="#a855f7" /> {friend.unlockedCount}
            </span>
            <span style={{ fontWeight: 600, color: friend.todayPctGoal >= 100 ? '#10b981' : 'var(--text-soft)' }}>
              今日 {friend.todayPctGoal}%
            </span>
          </div>
        </div>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Link
          to={`/u/${encodeURIComponent(friend.username)}/park`}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 999,
            background: 'rgba(16,185,129,0.14)', color: '#047857',
            fontSize: 13, fontWeight: 600, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}
        >
          <Trees size={13} /> 去公园
        </Link>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSendWater}
          disabled={busy}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 999,
            background: 'rgba(58,166,221,0.12)',
            color: 'var(--accent-deep)',
            fontSize: 13, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            transition: 'background 0.15s',
          }}
        >
          💧 递杯水
        </button>
        <div style={{ flex: 1, position: 'relative' }}>
          <button
            onClick={() => setShowCheers((v) => !v)}
            disabled={busy}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 999,
              background: 'rgba(245,158,11,0.14)',
              color: '#b45309',
              fontSize: 13, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}
          >
            🎉 加油
          </button>
          {showCheers && (
            <div
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)', left: 0, right: 0,
                background: 'white',
                borderRadius: 14,
                padding: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 4,
                zIndex: 10,
                animation: 'pop-up 0.18s ease-out',
              }}
            >
              {CHEER_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => onSendCheer(e)}
                  style={{
                    padding: 6, borderRadius: 8, fontSize: 20, background: 'transparent',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes pop-up { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  );
}
