import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ANIMALS, availableTokens, daysToNextToken, earnedTokens } from '../data/animals';
import {
  addUnlockedId,
  ensureUnlockedMigration,
  getCompanionId,
  getCompletedDays,
  setCompanionId,
} from '../lib/storage';
import AnimalIcon from '../components/AnimalIcon';

export default function Collection() {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [companionId, setCompanionIdState] = useState<string | null>(null);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null);

  const orderedIds = useMemo(() => ANIMALS.map((a) => a.id), []);

  useEffect(() => {
    setCompleted(getCompletedDays());
    setCompanionIdState(getCompanionId());
    setUnlockedIds(ensureUnlockedMigration(getCompletedDays().length, orderedIds));
  }, [orderedIds]);

  const unlockedSet = useMemo(() => new Set(unlockedIds), [unlockedIds]);
  const unlockedCount = unlockedIds.length;
  const tokens = availableTokens(completed.length, unlockedCount);
  const earned = earnedTokens(completed.length);
  const toNext = daysToNextToken(completed.length);

  const pickCompanion = (id: string) => {
    setCompanionId(id);
    setCompanionIdState(id);
  };

  const onUnlock = (id: string) => {
    if (tokens <= 0) return;
    const next = addUnlockedId(id, 'a-kiwi');
    setUnlockedIds(next);
    setJustUnlocked(id);
    setTimeout(() => setJustUnlocked(null), 2400);
  };

  const featuredAnimal = ANIMALS.find((a) => a.id === unlockedIds[unlockedIds.length - 1]) ?? ANIMALS[0];
  const selected = selectedIdx !== null ? ANIMALS[selectedIdx] : null;
  const isSelectedLocked = selected ? !unlockedSet.has(selected.id) : false;

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
        <h1 className="page-title">我的小伙伴</h1>
        <span style={{ width: 48 }} />
      </header>

      {/* hero card */}
      <div className="card-tinted card-sky" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="row" style={{ gap: 16 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 20,
              background: 'rgba(255,255,255,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AnimalIcon animal={featuredAnimal} size={68} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{featuredAnimal.name}</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
              {featuredAnimal.hint}
            </div>
            <div className="tag" style={{ marginTop: 8, background: 'rgba(255,255,255,0.7)' }}>
              已收集 {unlockedCount} / {ANIMALS.length}
            </div>
          </div>
        </div>
      </div>

      {/* Token 状态卡 */}
      <div className={tokens > 0 ? 'card-tinted card-mint' : 'card'}>
        <div className="row-between">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>
              🎫 解锁机会：{tokens}
            </div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.78 }}>
              {tokens > 0
                ? '点下面任意未解锁动物 → 选择「用 1 个机会解锁」'
                : unlockedCount >= ANIMALS.length
                  ? '🎉 全部收集完毕，你是真正的喝水冠军'
                  : `距离下一个机会还需 ${toNext} 天饮水达标`}
            </div>
            <div style={{ fontSize: 11, marginTop: 2, opacity: 0.6 }}>
              累计获得 {earned} 个 · 已使用 {Math.max(0, unlockedCount - 1)} 个
            </div>
          </div>
          <div style={{ fontSize: 40 }}>🎫</div>
        </div>
        {/* 进度条 */}
        {unlockedCount < ANIMALS.length && (
          <div
            style={{
              height: 8,
              background: 'rgba(255,255,255,0.55)',
              borderRadius: 999,
              overflow: 'hidden',
              marginTop: 10,
            }}
          >
            <div
              style={{
                width: `${((2 - toNext) / 2) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #7cd49a, #3a8a5a)',
                borderRadius: 999,
                transition: 'width 0.4s',
              }}
            />
          </div>
        )}
      </div>

      {/* selected detail */}
      {selected && (
        <div className="card">
          <div className="row" style={{ gap: 14 }}>
            <div style={{ flexShrink: 0 }}>
              <AnimalIcon animal={selected} size={64} locked={isSelectedLocked} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {isSelectedLocked ? '??? 未解锁' : selected.name}
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                {isSelectedLocked
                  ? tokens > 0
                    ? '你有解锁机会，可以让它加入小队！'
                    : `还需达标 ${toNext} 天，再获得 1 个机会`
                  : selected.hint}
              </div>
            </div>
            <button className="back-btn" onClick={() => setSelectedIdx(null)} aria-label="关闭">✕</button>
          </div>
          {isSelectedLocked && tokens > 0 && (
            <button
              className="btn btn-full"
              style={{ marginTop: 14 }}
              onClick={() => onUnlock(selected.id)}
            >
              🔓 用 1 个机会解锁
            </button>
          )}
          {!isSelectedLocked && (
            <button
              className={companionId === selected.id ? 'btn btn-full' : 'btn btn-ghost btn-full'}
              style={{ marginTop: 14 }}
              onClick={() => pickCompanion(selected.id)}
              disabled={companionId === selected.id}
            >
              {companionId === selected.id ? '✓ 已是主页伙伴' : '设为主页伙伴'}
            </button>
          )}
        </div>
      )}

      {/* grid */}
      <div className="row-between" style={{ marginTop: 4, paddingLeft: 4 }}>
        <h2 style={{ fontSize: 17, margin: 0, fontWeight: 700 }}>每只小动物</h2>
        <span className="muted">{unlockedCount}/{ANIMALS.length}</span>
      </div>

      <div className="animal-grid">
        {ANIMALS.map((a, i) => {
          const locked = !unlockedSet.has(a.id);
          const canUnlock = locked && tokens > 0;
          const isCompanion = companionId === a.id;
          const wasJustUnlocked = justUnlocked === a.id;
          return (
            <button
              key={a.id}
              className={`animal-cell${locked ? ' locked-cell' : ''}${selectedIdx === i ? ' selected' : ''}${canUnlock ? ' can-unlock' : ''}${wasJustUnlocked ? ' just-unlocked' : ''}`}
              onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
              aria-label={locked ? '未解锁' : a.name}
            >
              <AnimalIcon animal={a} size={58} locked={locked} />
              {locked && !canUnlock && <span className="animal-lock" aria-hidden>🔒</span>}
              {canUnlock && <span className="animal-token" aria-hidden>🎫</span>}
              {!locked && isCompanion && <span className="animal-badge" aria-hidden>🏠</span>}
            </button>
          );
        })}
      </div>

      <style>{`
        .animal-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .animal-cell {
          position: relative;
          aspect-ratio: 1;
          background: var(--bg-card);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow-card);
          padding: 0;
          overflow: hidden;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .animal-cell:active { transform: scale(0.95); }
        .animal-cell.selected {
          box-shadow: 0 0 0 3px var(--accent), var(--shadow-card);
        }
        /* 可解锁的格子用金黄发光提示 */
        .animal-cell.can-unlock {
          box-shadow: 0 0 0 2px #ffc04a, 0 4px 14px rgba(255, 192, 74, 0.35);
          animation: cell-glow 1.8s ease-in-out infinite;
        }
        @keyframes cell-glow {
          0%, 100% { box-shadow: 0 0 0 2px #ffc04a, 0 4px 14px rgba(255, 192, 74, 0.35); }
          50%      { box-shadow: 0 0 0 3px #ffd86c, 0 6px 18px rgba(255, 216, 108, 0.55); }
        }
        .animal-cell.just-unlocked {
          animation: cell-pop 1.2s cubic-bezier(.2,1.4,.4,1);
        }
        @keyframes cell-pop {
          0%   { transform: scale(0.7); }
          50%  { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        .animal-lock {
          position: absolute;
          top: 6px;
          right: 6px;
          font-size: 10px;
          opacity: 0.6;
        }
        .animal-token {
          position: absolute;
          top: 4px;
          right: 4px;
          font-size: 14px;
        }
        .animal-badge {
          position: absolute;
          top: 4px;
          left: 4px;
          font-size: 12px;
          background: var(--accent);
          color: white;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
