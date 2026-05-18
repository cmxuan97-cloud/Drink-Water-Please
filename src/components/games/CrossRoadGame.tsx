import { useEffect, useRef, useState } from 'react';
import { GameProps } from './index';

const LANES = 7;
const CAR_COLORS = ['#e57373', '#ffb74d', '#64b5f6', '#ba68c8', '#4db6ac'];

interface Car {
  lane: number;
  x: number;
  speed: number;
  w: number;
  color: string;
}

interface CrossState {
  player: { lane: number; col: number; animY: number; animX: number };
  cars: Car[];
  lives: number;
  score: number;
  phase: 'playing' | 'flash' | 'dead';
  flashTimer: number;
  frame: number;
  speedMult: number;
}

const COLS = 9;

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

function initCars(W: number, rowH: number): Car[] {
  const cars: Car[] = [];
  for (let lane = 1; lane <= 5; lane++) {
    const dir = lane % 2 === 0 ? 1 : -1;
    const baseSpeed = (0.8 + lane * 0.15) * dir;
    const carW = rowH * 1.3;
    const count = 2;
    const spacing = W / count;
    for (let i = 0; i < count; i++) {
      cars.push({
        lane,
        x: i * spacing + Math.random() * 40,
        speed: baseSpeed,
        w: carW,
        color: CAR_COLORS[(lane + i) % CAR_COLORS.length],
      });
    }
  }
  return cars;
}

export default function CrossRoadGame({ onGameOver, onBack, onRestart }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<CrossState | null>(null);
  const rafRef = useRef<number>(0);
  const onGameOverRef = useRef(onGameOver);
  onGameOverRef.current = onGameOver;

  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
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

    const rowH = H / LANES;
    const colW = W / COLS;

    stateRef.current = {
      player: { lane: 6, col: Math.floor(COLS / 2), animY: 6 * rowH + rowH / 2, animX: Math.floor(COLS / 2) * colW + colW / 2 },
      cars: initCars(W, rowH),
      lives: 3,
      score: 0,
      phase: 'playing',
      flashTimer: 0,
      frame: 0,
      speedMult: 1,
    };

    let stopped = false;

    const getLaneY = (lane: number) => lane * rowH + rowH / 2;
    const getColX = (col: number) => col * colW + colW / 2;

    const drawCar = (car: Car) => {
      const carY = car.lane * rowH;
      const carH = rowH * 0.62;
      const yPad = (rowH - carH) / 2;
      // Body
      roundRect(ctx, car.x, carY + yPad, car.w, carH, 6);
      ctx.fillStyle = car.color;
      ctx.fill();
      // Windshield band
      const winW = car.w * 0.35;
      const winX = car.speed > 0 ? car.x + car.w - winW - 6 : car.x + 6;
      roundRect(ctx, winX, carY + yPad + carH * 0.18, winW, carH * 0.4, 3);
      ctx.fillStyle = 'rgba(40,55,80,0.55)';
      ctx.fill();
      // Headlights (front of car)
      const lightX = car.speed > 0 ? car.x + car.w - 4 : car.x;
      ctx.beginPath();
      ctx.arc(lightX, carY + yPad + carH * 0.5, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff3a0';
      ctx.fill();
    };

    const drawFrog = (x: number, y: number) => {
      const size = Math.min(colW, rowH) * 0.38;
      // Body
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = '#5cb85c';
      ctx.fill();
      // Belly
      ctx.beginPath();
      ctx.ellipse(x, y + size * 0.25, size * 0.65, size * 0.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#c8e6a0';
      ctx.fill();
      // Eyes
      const eyeR = size * 0.32;
      const eyeOff = size * 0.45;
      ctx.fillStyle = '#5cb85c';
      ctx.beginPath(); ctx.arc(x - eyeOff, y - eyeOff * 0.85, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + eyeOff, y - eyeOff * 0.85, eyeR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - eyeOff, y - eyeOff * 0.85, eyeR * 0.65, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + eyeOff, y - eyeOff * 0.85, eyeR * 0.65, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a2638';
      ctx.beginPath(); ctx.arc(x - eyeOff, y - eyeOff * 0.85, eyeR * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + eyeOff, y - eyeOff * 0.85, eyeR * 0.35, 0, Math.PI * 2); ctx.fill();
    };

    const draw = () => {
      const s = stateRef.current!;

      // Lanes
      for (let i = 0; i < LANES; i++) {
        if (i === 0) ctx.fillStyle = '#9ed29a'; // goal grass
        else if (i === LANES - 1) ctx.fillStyle = '#b3dba8'; // start grass
        else ctx.fillStyle = '#5a6068'; // road dark
        ctx.fillRect(0, i * rowH, W, rowH);
      }

      // Dashed lane lines
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([16, 14]);
      for (let i = 2; i < LANES - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * rowH);
        ctx.lineTo(W, i * rowH);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Curbs
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, rowH - 2, W, 2);
      ctx.fillRect(0, (LANES - 1) * rowH, W, 2);

      // Goal label
      ctx.font = `700 ${rowH * 0.28}px -apple-system,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#2e6e2e';
      ctx.fillText('🏁 终点', W / 2, rowH / 2);

      // Cars
      for (const car of s.cars) drawCar(car);

      // Player frog (skip blink frames during flash)
      const show = s.phase !== 'flash' || Math.floor(s.frame / 5) % 2 === 0;
      if (show) drawFrog(s.player.animX, s.player.animY);
    };

    const checkCollision = (px: number, py: number) => {
      const s = stateRef.current!;
      const playerR = Math.min(colW, rowH) * 0.35;
      for (const car of s.cars) {
        const carY = car.lane * rowH + (rowH - rowH * 0.62) / 2;
        const carH = rowH * 0.62;
        if (
          px + playerR > car.x + 4 &&
          px - playerR < car.x + car.w - 4 &&
          py + playerR > carY + 4 &&
          py - playerR < carY + carH - 4
        ) return true;
      }
      return false;
    };

    const loop = () => {
      if (stopped) return;
      const s = stateRef.current!;
      s.frame++;

      // Smooth player animation
      const tY = getLaneY(s.player.lane);
      const tX = getColX(s.player.col);
      s.player.animY += (tY - s.player.animY) * 0.3;
      s.player.animX += (tX - s.player.animX) * 0.3;

      // Move cars
      for (const car of s.cars) {
        car.x += car.speed * s.speedMult;
        if (car.speed > 0 && car.x > W + 20) car.x = -car.w - 20;
        if (car.speed < 0 && car.x + car.w < -20) car.x = W + 20;
      }

      // Collision
      if (s.phase === 'playing' && s.player.lane >= 1 && s.player.lane <= 5) {
        if (checkCollision(s.player.animX, s.player.animY)) {
          s.lives--;
          setDisplayLives(s.lives);
          if (s.lives <= 0) {
            s.phase = 'dead';
            draw();
            setPhase('over');
            onGameOverRef.current(s.score);
            return;
          }
          s.phase = 'flash';
          s.flashTimer = 90;
          s.player.lane = 6;
          s.player.col = Math.floor(COLS / 2);
        }
      }

      if (s.phase === 'flash') {
        s.flashTimer--;
        if (s.flashTimer <= 0) s.phase = 'playing';
      }

      draw();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(rafRef.current); };
  }, []);

  const move = (dir: 'up' | 'down' | 'left' | 'right') => {
    const s = stateRef.current;
    if (!s || s.phase === 'dead') return;

    if (dir === 'up') {
      if (s.player.lane > 0) s.player.lane--;
      if (s.player.lane === 0) {
        s.score++;
        setDisplayScore(s.score);
        s.speedMult *= 1.08;
        s.player.lane = 6;
        s.player.col = Math.floor(COLS / 2);
      }
    } else if (dir === 'down' && s.player.lane < LANES - 1) {
      s.player.lane++;
    } else if (dir === 'left' && s.player.col > 0) {
      s.player.col--;
    } else if (dir === 'right' && s.player.col < COLS - 1) {
      s.player.col++;
    }
  };

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15) { touchStartRef.current = null; return; }
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
    touchStartRef.current = null;
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
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 18 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} style={{ opacity: i < displayLives ? 1 : 0.25, transition: 'opacity 0.2s' }}>❤️</span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#647c91' }}>过关</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1f2a44' }}>{displayScore}</div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        style={{ flex: 1, display: 'block', touchAction: 'none' }}
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
          <button style={btnStyle} onPointerDown={() => move('up')}>↑</button>
          <div />
          <button style={btnStyle} onPointerDown={() => move('left')}>←</button>
          <button style={btnStyle} onPointerDown={() => move('down')}>↓</button>
          <button style={btnStyle} onPointerDown={() => move('right')}>→</button>
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
            <div style={{ fontSize: 36, marginBottom: 8 }}>🐸</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a2638', marginBottom: 6 }}>游戏结束</div>
            <div style={{ fontSize: 14, color: '#647c91', marginBottom: 4 }}>过马路</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: '#1f2a44', marginBottom: 18 }}>{displayScore} 次</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={onRestart} style={{ borderRadius: 999, background: '#1f2a44', color: '#fff', border: 'none', cursor: 'pointer', padding: '13px 24px', fontSize: 15, fontWeight: 600 }}>再来一局</button>
              <button onClick={onBack} style={{ borderRadius: 999, background: 'rgba(58,166,221,0.1)', color: '#1d7fb8', border: 'none', cursor: 'pointer', padding: '13px 24px', fontSize: 15, fontWeight: 600 }}>换游戏</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
