import { useEffect, useRef, useState } from 'react';
import { GameProps } from './index';

const COLS = 20;
const ROWS = 20;
const FOOD_EMOJIS = ['🍎', '💧', '🌟', '🍇', '🍓', '🍊'];
const INIT_INTERVAL = 200;
const MIN_INTERVAL = 80;

type Pt = { x: number; y: number };

interface SnakeState {
  snake: Pt[];
  dir: Pt;
  nextDir: Pt;
  food: { x: number; y: number; emoji: string };
  score: number;
  eaten: number;
  lastMoveTime: number;
  moveInterval: number;
  dead: boolean;
}

function randFood(snake: Pt[]): { x: number; y: number; emoji: string } {
  let x: number, y: number;
  do {
    x = Math.floor(Math.random() * COLS);
    y = Math.floor(Math.random() * ROWS);
  } while (snake.some(s => s.x === x && s.y === y));
  return { x, y, emoji: FOOD_EMOJIS[Math.floor(Math.random() * FOOD_EMOJIS.length)] };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export default function SnakeGame({ playerEmoji, onGameOver, onBack, onRestart }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SnakeState | null>(null);
  const rafRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [phase, setPhase] = useState<'playing' | 'over'>('playing');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const cellW = W / COLS;
    const cellH = H / ROWS;

    const initSnake: Pt[] = [
      { x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 },
    ];
    stateRef.current = {
      snake: initSnake,
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      food: randFood(initSnake),
      score: 0,
      eaten: 0,
      lastMoveTime: 0,
      moveInterval: INIT_INTERVAL,
      dead: false,
    };

    let stopped = false;

    const draw = () => {
      const s = stateRef.current!;
      // Background
      ctx.fillStyle = '#e8f4fb';
      ctx.fillRect(0, 0, W, H);
      // Grid
      ctx.strokeStyle = 'rgba(58,166,221,0.1)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= COLS; i++) {
        ctx.beginPath(); ctx.moveTo(i * cellW, 0); ctx.lineTo(i * cellW, H); ctx.stroke();
      }
      for (let j = 0; j <= ROWS; j++) {
        ctx.beginPath(); ctx.moveTo(0, j * cellH); ctx.lineTo(W, j * cellH); ctx.stroke();
      }

      // Snake body (all but head)
      for (let i = 1; i < s.snake.length; i++) {
        const seg = s.snake[i];
        const pad = 2;
        roundRect(ctx, seg.x * cellW + pad, seg.y * cellH + pad, cellW - pad * 2, cellH - pad * 2, 4);
        ctx.fillStyle = i === s.snake.length - 1 ? '#7bc8e8' : '#3aa6dd';
        ctx.fill();
      }

      // Food emoji
      const foodSize = Math.min(cellW, cellH) * 0.85;
      ctx.font = `${foodSize}px serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(
        s.food.emoji,
        s.food.x * cellW + cellW / 2,
        s.food.y * cellH + cellH / 2,
      );

      // Snake head emoji
      const head = s.snake[0];
      const headSize = Math.min(cellW, cellH) * 0.9;
      ctx.save();
      if (s.dir.x < 0) {
        ctx.translate(head.x * cellW + cellW, head.y * cellH);
        ctx.scale(-1, 1);
        ctx.font = `${headSize}px serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(playerEmoji, cellW / 2, cellH / 2);
      } else {
        ctx.font = `${headSize}px serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(playerEmoji, head.x * cellW + cellW / 2, head.y * cellH + cellH / 2);
      }
      ctx.restore();
    };

    const loop = (ts: number) => {
      if (stopped) return;
      const s = stateRef.current!;
      if (s.dead) return;

      if (ts - s.lastMoveTime >= s.moveInterval) {
        s.lastMoveTime = ts;
        s.dir = s.nextDir;

        const head = s.snake[0];
        const nx = head.x + s.dir.x;
        const ny = head.y + s.dir.y;

        // Wall collision
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
          s.dead = true;
          draw();
          setPhase('over');
          onGameOver(s.score);
          return;
        }
        // Self collision
        if (s.snake.some(seg => seg.x === nx && seg.y === ny)) {
          s.dead = true;
          draw();
          setPhase('over');
          onGameOver(s.score);
          return;
        }

        const newHead = { x: nx, y: ny };
        const ate = nx === s.food.x && ny === s.food.y;
        const newSnake = [newHead, ...s.snake];
        if (!ate) newSnake.pop();
        s.snake = newSnake;

        if (ate) {
          s.score += 1;
          s.eaten += 1;
          scoreRef.current = s.score;
          setDisplayScore(s.score);
          s.food = randFood(s.snake);
          if (s.eaten % 5 === 0) {
            s.moveInterval = Math.max(MIN_INTERVAL, s.moveInterval - 20);
          }
        }
      }

      draw();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(rafRef.current); };
  }, [playerEmoji, onGameOver]);

  // Touch swipe on canvas
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !stateRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const s = stateRef.current;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 20 && s.dir.x !== -1) s.nextDir = { x: 1, y: 0 };
      else if (dx < -20 && s.dir.x !== 1) s.nextDir = { x: -1, y: 0 };
    } else {
      if (dy > 20 && s.dir.y !== -1) s.nextDir = { x: 0, y: 1 };
      else if (dy < -20 && s.dir.y !== 1) s.nextDir = { x: 0, y: -1 };
    }
    touchStartRef.current = null;
  };

  const setDir = (dx: number, dy: number) => {
    const s = stateRef.current;
    if (!s || s.dead) return;
    if (dx === 1 && s.dir.x !== -1) s.nextDir = { x: 1, y: 0 };
    else if (dx === -1 && s.dir.x !== 1) s.nextDir = { x: -1, y: 0 };
    else if (dy === 1 && s.dir.y !== -1) s.nextDir = { x: 0, y: 1 };
    else if (dy === -1 && s.dir.y !== 1) s.nextDir = { x: 0, y: -1 };
  };

  const btnStyle: React.CSSProperties = {
    width: 52, height: 52, borderRadius: 999,
    background: 'rgba(31,42,68,0.18)', color: '#fff',
    border: 'none', cursor: 'pointer', fontSize: 22,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitUserSelect: 'none', userSelect: 'none',
    touchAction: 'manipulation',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Score bar */}
      <div style={{
        flexShrink: 0, height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2638' }}>🐍 贪吃蛇</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#647c91' }}>得分</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1f2a44' }}>{displayScore}</div>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ flex: 1, display: 'block', touchAction: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {/* Controls */}
      <div style={{
        flexShrink: 0, height: 120,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)',
        touchAction: 'none',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '52px 52px 52px', gridTemplateRows: '52px 52px', gap: 6 }}>
          <div />
          <button style={btnStyle} onPointerDown={() => setDir(0, -1)}>↑</button>
          <div />
          <button style={btnStyle} onPointerDown={() => setDir(-1, 0)}>←</button>
          <button style={btnStyle} onPointerDown={() => setDir(0, 1)}>↓</button>
          <button style={btnStyle} onPointerDown={() => setDir(1, 0)}>→</button>
        </div>
      </div>

      {/* Game over overlay */}
      {phase === 'over' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(20,40,60,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: 22,
            padding: '28px 24px', textAlign: 'center',
            boxShadow: '0 12px 40px rgba(31,50,80,0.18)',
            minWidth: 220,
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🐍</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a2638', marginBottom: 6 }}>游戏结束</div>
            <div style={{ fontSize: 14, color: '#647c91', marginBottom: 4 }}>得分</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#1f2a44', marginBottom: 16 }}>{displayScore}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={onRestart}
                style={{
                  borderRadius: 999, background: '#1f2a44', color: '#fff',
                  border: 'none', cursor: 'pointer',
                  padding: '12px 24px', fontSize: 15, fontWeight: 600,
                }}
              >
                再来一局
              </button>
              <button
                onClick={onBack}
                style={{
                  borderRadius: 999,
                  background: 'rgba(58,166,221,0.1)', color: '#1d7fb8',
                  border: 'none', cursor: 'pointer',
                  padding: '12px 24px', fontSize: 15, fontWeight: 600,
                }}
              >
                换游戏
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
