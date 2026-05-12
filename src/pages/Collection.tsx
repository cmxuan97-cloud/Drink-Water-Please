import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ANIMALS, daysToNextUnlock, unlockCount } from '../data/animals';
import { getCompanionId, getCompletedDays, setCompanionId } from '../lib/storage';
import AnimalIcon from '../components/AnimalIcon';

export default function Collection() {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [companionId, setCompanionIdState] = useState<string | null>(null);

  useEffect(() => {
    setCompleted(getCompletedDays());
    setCompanionIdState(getCompanionId());
  }, []);

  const pickCompanion = (id: string) => {
    setCompanionId(id);
    setCompanionIdState(id);
  };

  const unlocked = useMemo(() => unlockCount(completed.length), [completed.length]);
  const toNext = useMemo(() => daysToNextUnlock(completed.length), [completed.length]);
  const featuredAnimal = ANIMALS[Math.max(0, unlocked - 1)];
  const nextAnimal = ANIMALS[unlocked];
  const progressPct = toNext > 0 ? ((2 - toNext) / 2) * 100 : 100;

  const selected = selectedIdx !== null ? ANIMALS[selectedIdx] : null;
  const isSelectedLocked = selectedIdx !== null && selectedIdx >= unlocked;

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
              已收集 {unlocked} / {ANIMALS.length}
            </div>
          </div>
        </div>
      </div>

      {/* unlock progress */}
      {nextAnimal ? (
        <div className="card">
          <div className="row-between" style={{ marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>下一位伙伴</div>
              <div className="muted" style={{ fontSize: 12 }}>
                还需达标 {toNext} 天 · 已完成 {completed.length} 天
              </div>
            </div>
            <div aria-hidden>
              <AnimalIcon animal={nextAnimal} size={52} locked />
            </div>
          </div>
          <div
            style={{
              height: 8,
              background: 'var(--accent-soft)',
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #7dd3fc, #3aa6dd)',
                borderRadius: 999,
                transition: 'width 0.4s',
              }}
            />
          </div>
        </div>
      ) : (
        <div className="card-tinted card-mint">
          <div style={{ fontWeight: 700, fontSize: 16 }}>🎉 全部收集完毕！</div>
          <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>
            你是真正的喝水冠军
          </div>
        </div>
      )}

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
                  ? `再达标 ${Math.max(1, selectedIdx! * 2 - completed.length)} 天就能解锁 · 排在第 ${selectedIdx! + 1} 位`
                  : selected.hint}
              </div>
            </div>
            <button className="back-btn" onClick={() => setSelectedIdx(null)} aria-label="关闭">✕</button>
          </div>
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
        <span className="muted">{unlocked}/{ANIMALS.length}</span>
      </div>

      <div className="animal-grid">
        {ANIMALS.map((a, i) => {
          const locked = i >= unlocked;
          const isCompanion = companionId === a.id || (companionId === null && i === unlocked - 1);
          return (
            <button
              key={a.id}
              className={`animal-cell${locked ? ' locked-cell' : ''}${selectedIdx === i ? ' selected' : ''}`}
              onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
              aria-label={locked ? '未解锁' : a.name}
            >
              <AnimalIcon animal={a} size={58} locked={locked} />
              {locked && <span className="animal-lock" aria-hidden>🔒</span>}
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
        .animal-lock {
          position: absolute;
          top: 6px;
          right: 6px;
          font-size: 10px;
          opacity: 0.6;
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
