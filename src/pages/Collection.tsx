import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ANIMALS, Animal, availableTokens, daysToNextToken, earnedTokens } from '../data/animals';
import {
  addUnlockedId,
  ensureUnlockedMigration,
  getCompanionId,
  getCompletedDays,
  setCompanionId,
} from '../lib/storage';
import AnimalIcon from '../components/AnimalIcon';
import { syncCompanionToServer } from '../lib/push';

const CELEBRATE_EMOJIS = ['🎉', '🎊', '✨', '🌟', '💖', '🎈', '⭐', '💫', '🌈', '🎁', '💕', '🥳'];

export default function Collection() {
  const navigate = useNavigate();
  const [completed, setCompleted] = useState<string[]>([]);
  const [companionId, setCompanionIdState] = useState<string | null>(null);
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const [popupAnimal, setPopupAnimal] = useState<Animal | null>(null);
  const [popupStage, setPopupStage] = useState<'view' | 'unlocked'>('view');
  const [celebrate, setCelebrate] = useState(false);

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

  const onUnlock = (id: string) => {
    if (tokens <= 0) return;
    const next = addUnlockedId(id, 'a-kiwi');
    setUnlockedIds(next);
    setPopupStage('unlocked');
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 3200);
  };

  const closePopup = () => {
    setPopupAnimal(null);
    setPopupStage('view');
  };

  const onPickCompanion = (id: string) => {
    setCompanionId(id);
    setCompanionIdState(id);
    closePopup();
    // 让推送通知立刻用新伙伴的口吻说话
    void syncCompanionToServer(id);
  };

  const onCellClick = (animal: Animal) => {
    setPopupStage('view');
    setPopupAnimal(animal);
  };

  const featuredAnimal = ANIMALS.find((a) => a.id === unlockedIds[unlockedIds.length - 1]) ?? ANIMALS[0];

  const isPopupLocked = popupAnimal ? !unlockedSet.has(popupAnimal.id) : false;
  const popupIsCompanion = popupAnimal ? companionId === popupAnimal.id : false;

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
              🔑 解锁钥匙：{tokens}
            </div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.78 }}>
              {tokens > 0
                ? '点下面任意未解锁动物 → 用钥匙解锁'
                : unlockedCount >= ANIMALS.length
                  ? '🎉 全部收集完毕，你是真正的喝水冠军'
                  : `距离下一把钥匙还需 ${toNext} 天饮水达标`}
            </div>
            <div style={{ fontSize: 11, marginTop: 2, opacity: 0.6 }}>
              累计获得 {earned} 把 · 已使用 {Math.max(0, unlockedCount - 1)} 把
            </div>
          </div>
          <div style={{ fontSize: 40 }}>🔑</div>
        </div>
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

      {/* grid */}
      <div className="row-between" style={{ marginTop: 4, paddingLeft: 4 }}>
        <h2 style={{ fontSize: 17, margin: 0, fontWeight: 700 }}>每只小动物</h2>
        <span className="muted">{unlockedCount}/{ANIMALS.length}</span>
      </div>

      <div className="animal-grid">
        {ANIMALS.map((a) => {
          const locked = !unlockedSet.has(a.id);
          const canUnlock = locked && tokens > 0;
          const isCompanion = companionId === a.id;
          return (
            <button
              key={a.id}
              className={`animal-cell${locked ? ' locked-cell' : ''}${canUnlock ? ' can-unlock' : ''}`}
              onClick={() => onCellClick(a)}
              aria-label={locked ? '未解锁' : a.name}
            >
              <AnimalIcon animal={a} size={58} locked={locked} />
              {locked && !canUnlock && <span className="animal-lock" aria-hidden>🔒</span>}
              {canUnlock && <span className="animal-token" aria-hidden>🔑</span>}
              {!locked && isCompanion && <span className="animal-badge" aria-hidden>🏠</span>}
            </button>
          );
        })}
      </div>

      {/* === 弹窗 === */}
      {popupAnimal && (
        <div className="animal-modal-backdrop" onClick={closePopup}>
          <div
            className={`animal-modal${popupStage === 'unlocked' ? ' just-unlocked' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="animal-modal-close" onClick={closePopup} aria-label="关闭">✕</button>

            <div className="animal-modal-art">
              <AnimalIcon
                animal={popupAnimal}
                size={140}
                locked={isPopupLocked && popupStage === 'view'}
              />
            </div>

            {isPopupLocked && popupStage === 'view' ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 20, marginTop: 8 }}>??? 未解锁</div>
                {tokens > 0 ? (
                  <>
                    <div className="muted" style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6 }}>
                      用 <strong style={{ color: 'var(--accent-deep)' }}>1 把 🔑 钥匙</strong> 解锁<br />
                      让它加入你的喝水小队
                    </div>
                    <button
                      className="btn btn-full"
                      style={{ marginTop: 18 }}
                      onClick={() => onUnlock(popupAnimal.id)}
                    >
                      🔑 用钥匙解锁
                    </button>
                  </>
                ) : (
                  <>
                    <div className="muted" style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6 }}>
                      你还没有可用的钥匙<br />
                      再 <strong>达标 {toNext} 天</strong> 就能拿到下一把
                    </div>
                    <button
                      className="btn btn-full"
                      style={{
                        marginTop: 18,
                        background: 'linear-gradient(135deg, #f9a8d4, #f472b6)',
                        color: '#fff',
                      }}
                      onClick={closePopup}
                    >
                      我知道了
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                {popupStage === 'unlocked' && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--mint-text)',
                      fontWeight: 700,
                      letterSpacing: 1,
                      marginTop: 4,
                    }}
                  >
                    🎉 新伙伴解锁
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: 22, marginTop: 4 }}>{popupAnimal.name}</div>
                <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>{popupAnimal.hint}</div>
                <button
                  className={popupIsCompanion ? 'btn btn-full' : 'btn btn-ghost btn-full'}
                  style={{ marginTop: 18 }}
                  onClick={() => onPickCompanion(popupAnimal.id)}
                  disabled={popupIsCompanion}
                >
                  {popupIsCompanion ? '✓ 已是主页伙伴' : '设为主页伙伴'}
                </button>
              </>
            )}

          </div>
        </div>
      )}

      {/* === 解锁庆祝 emoji 爆发 — 全屏覆盖 === */}
      {celebrate && (
        <div className="celebrate-fx" aria-hidden>
          {CELEBRATE_EMOJIS.map((emoji, i) => (
            <span
              key={i}
              className="ce-emoji"
              style={{
                left: `${50 + (Math.random() - 0.5) * 10}%`,
                top: `${50 + (Math.random() - 0.5) * 10}%`,
                animationDelay: `${i * 0.06}s`,
                ['--ang' as any]: `${(360 / CELEBRATE_EMOJIS.length) * i}deg`,
                ['--dist' as any]: `${180 + (i % 3) * 60}px`,
              }}
            >
              {emoji}
            </span>
          ))}
        </div>
      )}

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
        .animal-cell.can-unlock {
          box-shadow: 0 0 0 2px #ffc04a, 0 4px 14px rgba(255, 192, 74, 0.35);
          animation: cell-glow 1.8s ease-in-out infinite;
        }
        @keyframes cell-glow {
          0%, 100% { box-shadow: 0 0 0 2px #ffc04a, 0 4px 14px rgba(255, 192, 74, 0.35); }
          50%      { box-shadow: 0 0 0 3px #ffd86c, 0 6px 18px rgba(255, 216, 108, 0.55); }
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

        /* 弹窗 */
        .animal-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(20, 40, 60, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 24px;
          animation: bg-fade 0.25s ease-out;
        }
        @keyframes bg-fade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .animal-modal {
          position: relative;
          background: white;
          border-radius: 28px;
          padding: 24px 24px 28px;
          max-width: 340px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
          animation: modal-pop 0.4s cubic-bezier(.2,1.4,.4,1);
        }
        @keyframes modal-pop {
          0%   { opacity: 0; transform: scale(0.85) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animal-modal.just-unlocked {
          animation: modal-celebrate 0.7s cubic-bezier(.2,1.6,.4,1);
        }
        @keyframes modal-celebrate {
          0%   { transform: scale(0.5) rotate(-8deg); }
          50%  { transform: scale(1.08) rotate(2deg); }
          100% { transform: scale(1) rotate(0); }
        }
        .animal-modal-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: rgba(0,0,0,0.05);
          color: var(--text-soft);
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
        }
        .animal-modal-close:hover {
          background: rgba(0,0,0,0.1);
        }
        .animal-modal-art {
          display: flex;
          justify-content: center;
          margin-top: 8px;
        }

        /* 庆祝爆发 — 全屏覆盖，emoji 从中心向各方向飞 */
        .celebrate-fx {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 200;
          overflow: hidden;
        }
        .ce-emoji {
          position: absolute;
          font-size: 36px;
          transform: translate(-50%, -50%);
          animation: ce-burst 2.4s cubic-bezier(.2,.8,.2,1) forwards;
          opacity: 0;
        }
        @keyframes ce-burst {
          0%   {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(var(--ang)) translateY(0) rotate(calc(-1 * var(--ang))) scale(0.3);
          }
          15%  { opacity: 1; }
          70%  { opacity: 1; }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(var(--ang)) translateY(calc(-1 * var(--dist))) rotate(calc(-1 * var(--ang))) scale(1.4);
          }
        }
      `}</style>
    </div>
  );
}
