import { useEffect, useRef, useState } from 'react';
import { GameProps } from './index';

const COLS = 17;
const ROWS = 22;
const INIT_INTERVAL = 160;
const MIN_INTERVAL = 70;

type Pt = { x: number; y: number };

interface SnakeState {
  snake: Pt[];
  dir: Pt;
  nextDir: Pt;
  food: Pt;
  score: number;
  eaten: number;
  lastMoveTime: number;
  moveInterval: number;
  dead: boolean;
}

function randFood(snake: Pt[]): Pt {
  let x: number, y: number;
  do {
    x = Math.floor(Math.random() * COLS);
    y = Math.floor(Math.random() * ROWS);
  } while (snake.some(s => s.x === x && s.y === y));
  return { x, y };
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

export default function SnakeGame({ onGameOver, onBack, onRestart }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SnakeState | null>(null);
  const rafRef = useRef<number>(0);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

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
      { x: 8, y: 11 }, { x: 7, y: 11 }, { x: 6, y: 11 },
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
      // Clean background — solid cream
      ctx.fillStyle = '#f4f9fc';
      ctx.fillRect(0, 0, W, H);

      // Subtle dot grid (very faint)
      ctx.fillStyle = 'rgba(58,166,221,0.10)';
      for (let i = 0; i < COLS; i++) {
        for (let j = 0; j < ROWS; j++) {
          ctx.fillRect(i * cellW + cellW / 2 - 1, j * cellH + cellH / 2 - 1, 2, 2);
        }
      }

      // Food: red apple circle
      const fx = s.food.x * cellW + cellW / 2;
      const fy = s.food.y * cellH + cellH / 2;
      const fr = Math.min(cellW, cellH) * 0.36;
      ctx.beginPath();
      ctx.arc(fx, fy, fr, 0, Math.PI * 2);
      ctx.fillStyle = '#e74c3c';
      ctx.fill();
      // Apple highlight
      ctx.beginPath();
      ctx.arc(fx - fr * 0.3, fy - fr * 0.3, fr * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
      // Apple stem
      ctx.fillStyle = '#5d4a2a';
      ctx.fillRect(fx - 1, fy - fr - 3, 2, 4);

      // Snake body
      for (let i = s.snake.length - 1; i >= 0; i--) {
        const seg = s.snake[i];
        const pad = 2;
        const isHead = i === 0;
        roundRect(ctx, seg.x * cellW + pad, seg.y * cellH + pad, cellW - pad * 2, cellH - pad * 2, 5);
        ctx.fillStyle = isHead ? '#2e8b57' : (i % 2 === 0 ? '#3fa56a' : '#4ab277');
        ctx.fill();

        // Head: eyes
        if (isHead) {
          const cx = seg.x * cellW + cellW / 2;
          const cy = seg.y * cellH + cellH / 2;
          const eyeOff = cellW * 0.18;
          const eyeR = cellW * 0.10;
          let ex1 = cx, ey1 = cy, ex2 = cx, ey2 = cy;
          if (s.dir.x === 1) { ex1 = cx + eyeOff; ey1 = cy - eyeOff; ex2 = cx + eyeOff; ey2 = cy + eyeOff; }
          else if (s.dir.x === -1) { ex1 = cx - eyeOff; ey1 = cy - eyeOff; ex2 = cx - eyeOff; ey2 = cy + eyeOff; }
          else if (s.dir.y === -1) { ex1 = cx - eyeOff; ey1 = cy - eyeOff; ex2 = cx + eyeOff; ey2 = cy - eyeOff; }
          else { ex1 = cx - eyeOff; ey1 = cy + eyeOff; ex2 = cx + eyeOff; ey2 = cy + eyeOff; }
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1a2638';
          ctx.beginPath(); ctx.arc(ex1, ey1, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(ex2, ey2, eyeR * 0.55, 0, Math.PI * 2); ctx.fill();
        }
      }
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

        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
          s.dead = true;
          draw();
          setPhase('over');
          onGameOverRef.current(s.score);
          return;
        }
        if (s.snake.some(seg => seg.x === nx && seg.y === ny)) {
          s.dead = true;
          draw();
          setPhase('over');
          onGameOverRef.current(s.score);
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
          setDisplayScore(s.score);
          s.food = randFood(s.snake);
          if (s.eaten % 5 === 0) {
            s.moveInterval = Math.max(MIN_INTERVAL, s.moveInterval - 12);
          }
        }
        draw();
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    draw();
    rafRef.current = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(rafRef.current); };
  }, []);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !stateRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const s = stateRef.current;
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15) { touchStartRef.current = null; return; }
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0 && s.dir.x !== -1) s.nextDir = { x: 1, y: 0 };
      else if (dx < 0 && s.dir.x !== 1) s.nextDir = { x: -1, y: 0 };
    } else {
      if (dy > 0 && s.dir.y !== -1) s.nextDir = { x: 0, y: 1 };
      else if (dy < 0 && s.dir.y !== 1) s.nextDir = { x: 0, y: -1 };
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
    width: 56, height: 56, borderRadius: 999,
    background: '#1f2a44', color: '#fff',
    border: 'none', cursor: 'pointer', fontSize: 22, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitUserSelect: 'none', userSelect: 'none',
    touchAction: 'manipulation',
    boxShadow: '0 4px 12px rgba(31,42,68,0.25)',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'rgba(255,255,255,0.9)',
      }}>
        <div style={{ fontSize: 14, color: '#647c91' }}>得分</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#1f2a44', letterSpacing: '0.5px' }}>{displayScore}</div>
      </div>

      <canvas
        ref={canvasRef}
        style={{ flex: 1, display: 'block', touchAction: 'none', background: '#f4f9fc' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      <div style={{
        flexShrink: 0, padding: '14px 0 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.7)',
        touchAction: 'none',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '56px 56px 56px', gridTemplateRows: '56px 56px', gap: 8 }}>
          <div />
          <button style={btnStyle} onPointerDown={() => setDir(0, -1)}>↑</button>
          <div />
          <button style={btnStyle} onPointerDown={() => setDir(-1, 0)}>←</button>
          <button style={btnStyle} onPointerDown={() => setDir(0, 1)}>↓</button>
          <button style={btnStyle} onPointerDown={() => setDir(1, 0)}>→</button>
        </div>
      </div>

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
            minWidth: 240,
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🐍</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a2638', marginBottom: 6 }}>游戏结束</div>
            <div style={{ fontSize: 14, color: '#647c91', marginBottom: 4 }}>得分</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: '#1f2a44', marginBottom: 18 }}>{displayScore}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={onRestart}
                style={{
                  borderRadius: 999, background: '#1f2a44', color: '#fff',
                  border: 'none', cursor: 'pointer',
                  padding: '13px 24px', fontSize: 15, fontWeight: 600,
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
                  padding: '13px 24px', fontSize: 15, fontWeight: 600,
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
