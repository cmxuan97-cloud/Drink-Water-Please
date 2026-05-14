import { ANIMALS } from '../data/animals';
import type { Friend } from '../lib/social';
import AnimalIcon from './AnimalIcon';
import ProgressRing from './ProgressRing';
import { Award, Flame } from 'lucide-react';

type Props = {
  friend: Friend;
  onRemove?: () => void;
};

export default function FriendCard({ friend }: Props) {
  const animal = friend.companionId ? ANIMALS.find(a => a.id === friend.companionId) : undefined;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: 'var(--bg-card)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-card)',
      }}
    >
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
  );
}
