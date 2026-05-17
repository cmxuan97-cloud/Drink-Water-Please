import { useEffect, useRef, useState } from 'react';
import { GameProps } from './index';

const LANES = 7; // 0=goal(top), 1-5=car lanes, 6=start(bottom)
const CAR_COLORS = ['#e57373', '#ff8a65', '#ffd54f', '#81c784', '#64b5f6', '#ba68c8'];

interface Car {
  id: number;
  lane: number; // 1-5
  x: number;
  speed: number; // px/frame, negative=left
  w: number;
  color: string;
}

interface CrossState {
  player: { lane: number; x: number; animY: number; targetLane: number };
  cars: Car[];
  lives: number;
  score: number;
  phase: 'playing' | 'flash' | 'dead';
  flashTimer: number;
  frameCount: number;
  speedMult: number;
  carIdSeq: number;
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

function initCars(W: number, speedMult: number): Car[] {
  const lanes = [1, 2, 3, 4, 5];
  const cars: Car[] = [];
  let idSeq = 0;
  for (const lane of lanes) {
    const count = lane % 2 === 0 ? 2 : 3;
    const dir = lane % 2 === 0 ? 1 : -1;
    const baseSpeed = (1.5 + lane * 0.3) * speedMult;
    const carW = 60 + Math.random() * 30;
    const spacing = W / count;
    for (let i = 0; i < count; i++) {
      cars.push({
        id: idSeq++,
        lane,
        x: i * spacing,
        speed: dir * baseSpeed,
        w: carW,
        color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
      });
    }
  }
  return cars;
}

export default function CrossRoadGame({ playerEmoji, onGameOver, onBack, onRestart }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<CrossState | null>(null);
  const rafRef = useRef<number>(0);
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

    const rowH = H / LANES;
    const playerW = rowH * 0.6;
    const playerH = rowH * 0.6;

    stateRef.current = {
      player: { lane: 6, x: W / 2, animY: 6 * rowH + rowH / 2, targetLane: 6 },
      cars: initCars(W, 1),
      lives: 3,
      score: 0,
      phase: 'playing',
      flashTimer: 0,
      frameCount: 0,
      speedMult: 1,
      carIdSeq: 100,
    };

    let stopped = false;

    const getLaneY = (lane: number) => lane * rowH + rowH / 2;

    const draw = () => {
      const s = stateRef.current!;

      // Background lanes
      for (let i = 0; i < LANES; i++) {
        if (i === 0) ctx.fillStyle = '#a8d5a2'; // goal: green
        else if (i === LANES - 1) ctx.fillStyle = '#b8d4a8'; // start: lighter green
        else ctx.fillStyle = '#ccc'; // road
        ctx.fillRect(0, i * rowH, W, rowH);

        // Lane dividers
        if (i > 0 && i < LANES - 1 && i < LANES - 2) {
          ctx.setLineDash([20, 16]);
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, (i + 1) * rowH);
          ctx.lineTo(W, (i + 1) * rowH);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Road edges
      ctx.fillStyle = '#b8b8b8';
      ctx.fillRect(0, rowH, W, 2);
      ctx.fillRect(0, (LANES - 1) * rowH - 2, W, 2);

      // Goal text
      ctx.font = `bold ${rowH * 0.35}px -apple-system,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#2e7556';
      ctx.fillText('🏁 安全区', W / 2, rowH / 2);

      // Cars
      for (const car of s.cars) {
        const carY = car.lane * rowH;
        const carH = rowH * 0.65;
        const carTopPad = (rowH - carH) / 2;
        roundRect(ctx, car.x, carY + carTopPad, car.w, carH, 8);
        ctx.fillStyle = car.color;
        ctx.fill();
        // Windshield
        const winW = car.w * 0.3;
        const winH = carH * 0.35;
        roundRect(ctx, car.x + (car.speed > 0 ? car.w - winW - 6 : 6), carY + carTopPad + carH * 0.15, winW, winH, 4);
        ctx.fillStyle = 'rgba(173,216,230,0.8)';
        ctx.fill();
        // Wheels
        const wheelR = carH * 0.15;
        for (const wx of [car.x + car.w * 0.2, car.x + car.w * 0.8]) {
          ctx.beginPath();
          ctx.arc(wx, carY + carTopPad + carH - wheelR * 0.5, wheelR, 0, Math.PI * 2);
          ctx.fillStyle = '#333';
          ctx.fill();
        }
      }

      // Player
      const playerY = s.player.animY;
      const show = s.phase !== 'flash' || Math.floor(s.frameCount / 4) % 2 === 0;
      if (show) {
        const emojiSize = rowH * 0.65;
        ctx.font = `${emojiSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(playerEmoji, s.player.x, playerY);
      }

      // Lives
      ctx.font = `${rowH * 0.45}px serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      for (let i = 0; i < s.lives; i++) {
        ctx.fillText('❤️', 8 + i * rowH * 0.5, rowH + 6);
      }
    };

    const checkCollision = (px: number, py: number) => {
      const s = stateRef.current!;
      const pHalfW = playerW / 2 * 0.7;
      const pHalfH = playerH / 2 * 0.7;
      for (const car of s.cars) {
        const carY = car.lane * rowH + (rowH - rowH * 0.65) / 2;
        const carH = rowH * 0.65;
        const shrink = 6;
        if (
          px + pHalfW > car.x + shrink &&
          px - pHalfW < car.x + car.w - shrink &&
          py + pHalfH > carY + shrink &&
          py - pHalfH < carY + carH - shrink
        ) return true;
      }
      return false;
    };

    const loop = () => {
      if (stopped) return;
      const s = stateRef.current!;
      s.frameCount++;

      // Animate player Y
      const targetY = getLaneY(s.player.lane);
      s.player.animY += (targetY - s.player.animY) * 0.25;

      // Move cars
      for (const car of s.cars) {
        car.x += car.speed * s.speedMult;
        if (car.speed > 0 && car.x > W) car.x = -car.w;
        if (car.speed < 0 && car.x + car.w < 0) car.x = W;
      }

      // Collision (only in car lanes and not flashing)
      if (s.phase === 'playing' && s.player.lane >= 1 && s.player.lane <= 5) {
        if (checkCollision(s.player.x, s.player.animY)) {
          s.lives--;
          if (s.lives <= 0) {
            s.phase = 'dead';
            draw();
            setPhase('over');
            onGameOver(s.score);
            return;
          }
          s.phase = 'flash';
          s.flashTimer = 90;
          s.player.lane = 6;
          s.player.animY = getLaneY(6);
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
  }, [playerEmoji, onGameOver]);

  const move = (dir: 'up' | 'down' | 'left' | 'right') => {
    const s = stateRef.current;
    if (!s || s.phase === 'dead') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dir === 'up' && s.player.lane > 0) {
      s.player.lane--;
      if (s.player.lane === 0) {
        // Reached goal!
        s.score++;
        setDisplayScore(s.score);
        s.speedMult *= 1.05;
        s.player.lane = 6;
        s.player.animY = canvas.offsetHeight * (6 / LANES) + (canvas.offsetHeight / LANES) / 2;
      }
    } else if (dir === 'down' && s.player.lane < LANES - 1) {
      s.player.lane++;
    } else if (dir === 'left') {
      s.player.x = Math.max(20, s.player.x - 30);
    } else if (dir === 'right') {
      s.player.x = Math.min((canvas?.offsetWidth ?? 360) - 20, s.player.x + 30);
    }
  };

  // Touch swipe
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 20 ? 'right' : 'left');
    } else {
      move(dy > 20 ? 'down' : 'up');
    }
    touchStartRef.current = null;
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
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2638' }}>🐸 过马路</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#647c91' }}>过马路</div>
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
          <button style={btnStyle} onPointerDown={() => move('up')}>↑</button>
          <div />
          <button style={btnStyle} onPointerDown={() => move('left')}>←</button>
          <button style={btnStyle} onPointerDown={() => move('down')}>↓</button>
          <button style={btnStyle} onPointerDown={() => move('right')}>→</button>
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
            <div style={{ fontSize: 36, marginBottom: 8 }}>🚗</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a2638', marginBottom: 6 }}>游戏结束</div>
            <div style={{ fontSize: 14, color: '#647c91', marginBottom: 4 }}>成功过马路</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#1f2a44', marginBottom: 16 }}>{displayScore} 次</div>
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
