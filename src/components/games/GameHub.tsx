import { useState } from 'react';
import { GameId, GAME_LS_KEYS, GAME_META } from './index';
import SnakeGame from './SnakeGame';
import CrossRoadGame from './CrossRoadGame';
import JumpGame from './JumpGame';

interface GameHubProps {
  onClose: () => void;
}

const getBest = (id: GameId): number =>
  parseInt(localStorage.getItem(GAME_LS_KEYS[id]) ?? '0', 10);

export default function GameHub({ onClose }: GameHubProps) {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [restartCount, setRestartCount] = useState(0);
  const [bestScores, setBestScores] = useState<Record<GameId, number>>({
    snake: getBest('snake'),
    cross: getBest('cross'),
    jump: getBest('jump'),
  });

  const handleGameOver = (id: GameId, score: number) => {
    const key = GAME_LS_KEYS[id];
    const prev = parseInt(localStorage.getItem(key) ?? '0', 10);
    if (score > prev) localStorage.setItem(key, String(score));
    setBestScores(cur => ({ ...cur, [id]: Math.max(cur[id], score) }));
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(20,40,60,0.55)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
      }}
      onClick={activeGame ? undefined : onClose}
    >
      <div
        style={{
          position: 'relative',
          width: '100%', maxWidth: 480,
          height: '100%',
          background: 'linear-gradient(180deg, #cfe8f5 0%, #ecf6fb 100%)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(58,166,221,0.12)',
          flexShrink: 0,
        }}>
          {activeGame ? (
            <button
              onClick={() => setActiveGame(null)}
              style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: '2px 8px 2px 0' }}
            >
              ←
            </button>
          ) : (
            <div style={{ width: 36 }} />
          )}
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2638' }}>
            {activeGame ? GAME_META[activeGame].name : '🎮 小游戏'}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 999,
              background: 'rgba(58,166,221,0.12)',
              border: 'none', cursor: 'pointer',
              fontSize: 18, color: '#647c91',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {activeGame === null ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(['snake', 'cross', 'jump'] as GameId[]).map(id => {
              const meta = GAME_META[id];
              return (
                <div key={id} style={{
                  background: '#fff',
                  borderRadius: 22,
                  boxShadow: '0 6px 24px rgba(31,50,80,0.06)',
                  padding: '20px',
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: 'linear-gradient(135deg, #d7eef9, #b8dff0)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, flexShrink: 0,
                  }}>
                    {meta.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#1a2638', marginBottom: 3 }}>
                      {meta.name}
                    </div>
                    <div style={{ fontSize: 13, color: '#647c91', marginBottom: 8 }}>
                      {meta.desc}
                    </div>
                    {bestScores[id] > 0 && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: 'rgba(58,166,221,0.1)', borderRadius: 999,
                        padding: '3px 10px', fontSize: 12, color: '#1d7fb8', fontWeight: 600,
                        marginBottom: 8,
                      }}>
                        ⭐ 最高 {bestScores[id]}
                      </div>
                    )}
                    <div>
                      <button
                        onClick={() => { setRestartCount(0); setActiveGame(id); }}
                        style={{
                          borderRadius: 999, background: '#1f2a44', color: '#fff',
                          border: 'none', cursor: 'pointer',
                          padding: '9px 20px', fontSize: 14, fontWeight: 600,
                          boxShadow: '0 4px 12px rgba(31,42,68,0.2)',
                        }}
                      >
                        开始游戏
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ height: 'max(16px, env(safe-area-inset-bottom, 16px))' }} />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeGame === 'snake' && (
              <SnakeGame
                key={restartCount}
                onGameOver={(s) => handleGameOver('snake', s)}
                onBack={() => setActiveGame(null)}
                onRestart={() => setRestartCount(n => n + 1)}
              />
            )}
            {activeGame === 'cross' && (
              <CrossRoadGame
                key={restartCount}
                onGameOver={(s) => handleGameOver('cross', s)}
                onBack={() => setActiveGame(null)}
                onRestart={() => setRestartCount(n => n + 1)}
              />
            )}
            {activeGame === 'jump' && (
              <JumpGame
                key={restartCount}
                onGameOver={(s) => handleGameOver('jump', s)}
                onBack={() => setActiveGame(null)}
                onRestart={() => setRestartCount(n => n + 1)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
