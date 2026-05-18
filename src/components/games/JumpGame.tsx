import { useEffect, useRef, useState } from 'react';
import { GameProps } from './index';

const GRAVITY = 0.42;
const JUMP_VY = -12;
const PLAYER_VX = 4.2;
const PLATFORM_COUNT = 12;
const PLATFORM_W = 78;
const PLATFORM_H = 14;
const PLAYER_R = 16;

interface Platform {
  x: number;
  y: number;
  type: 'normal' | 'break';
  broken: boolean;
}

interface JumpState {
  player: { x: number; y: number; vx: number; vy: number; facing: -1 | 1 };
  platforms: Platform[];
  cameraY: number;
  maxHeight: number;
  score: number;
  dead: boolean;
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

function makePlatform(x: number, y: number, score: number): Platform {
  const isBrk = score > 8 && Math.random() < 0.18;
  return { x, y, type: isBrk ? 'break' : 'normal', broken: false };
}

function initPlatforms(W: number, H: number): Platform[] {
  const platforms: Platform[] = [];
  platforms.push({ x: W / 2 - PLATFORM_W / 2, y: H - 80, type: 'normal', broken: false });
  let y = H - 80;
  for (let i = 0; i < PLATFORM_COUNT - 1; i++) {
    y -= 65 + Math.random() * 35;
    const x = 10 + Math.random() * (W - PLATFORM_W - 20);
    platforms.push(makePlatform(x, y, 0));
  }
  return platforms;
}

export default function JumpGame({ onGameOver, onBack, onRestart }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<JumpState | null>(null);
  const rafRef = useRef<number>(0);
  const heldRef = useRef({ left: false, right: false });
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

    const platforms = initPlatforms(W, H);
    const start = platforms[0];
    stateRef.current = {
      player: {
        x: start.x + PLATFORM_W / 2,
        y: start.y - PLAYER_R,
        vx: 0, vy: JUMP_VY, facing: 1,
      },
      platforms,
      cameraY: 0,
      maxHeight: 0,
      score: 0,
      dead: false,
    };

    let stopped = false;
    let lastScore = 0;

    const drawRabbit = (x: number, y: number, facing: 1 | -1) => {
      // y is the BOTTOM (feet) of the rabbit; draw centered above
      const r = PLAYER_R;
      const cy = y - r;
      // Ears
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.4, cy - r * 0.95, r * 0.22, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + r * 0.4, cy - r * 0.95, r * 0.22, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      // Inner ears
      ctx.fillStyle = '#fad6dc';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.4, cy - r * 0.85, r * 0.10, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + r * 0.4, cy - r * 0.85, r * 0.10, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      // Body
      ctx.beginPath();
      ctx.arc(x, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(31,42,68,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // Eyes (facing direction)
      const eyeOff = r * 0.32;
      ctx.fillStyle = '#1a2638';
      ctx.beginPath(); ctx.arc(x - eyeOff * facing, cy - r * 0.1, r * 0.10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + eyeOff * facing * 0.6, cy - r * 0.1, r * 0.10, 0, Math.PI * 2); ctx.fill();
      // Nose
      ctx.fillStyle = '#f4a4b4';
      ctx.beginPath();
      ctx.arc(x + facing * r * 0.05, cy + r * 0.15, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
    };

    const draw = (s: JumpState) => {
      // Static gradient background (cached via fill)
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#cfe8f5');
      grad.addColorStop(1, '#ecf6fb');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Soft cloud accents (cheap, decorative)
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      const cloudY1 = ((s.cameraY * 0.3) % H + H) % H;
      ctx.beginPath();
      ctx.arc(W * 0.2, cloudY1, 18, 0, Math.PI * 2);
      ctx.arc(W * 0.27, cloudY1 - 5, 14, 0, Math.PI * 2);
      ctx.arc(W * 0.33, cloudY1, 12, 0, Math.PI * 2);
      ctx.fill();
      const cloudY2 = ((s.cameraY * 0.3 + H * 0.5) % H + H) % H;
      ctx.beginPath();
      ctx.arc(W * 0.7, cloudY2, 16, 0, Math.PI * 2);
      ctx.arc(W * 0.78, cloudY2 - 4, 12, 0, Math.PI * 2);
      ctx.fill();

      // Platforms
      for (const p of s.platforms) {
        const screenY = p.y - s.cameraY;
        if (screenY > H + 20 || screenY + PLATFORM_H < -20) continue;
        if (p.broken) {
          ctx.strokeStyle = '#c0c8d0';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          roundRect(ctx, p.x, screenY, PLATFORM_W, PLATFORM_H, 7);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Shadow
          roundRect(ctx, p.x, screenY + 3, PLATFORM_W, PLATFORM_H, 7);
          ctx.fillStyle = 'rgba(31,50,80,0.08)';
          ctx.fill();
          // Body
          roundRect(ctx, p.x, screenY, PLATFORM_W, PLATFORM_H, 7);
          ctx.fillStyle = p.type === 'break' ? '#f0a070' : '#3aa6dd';
          ctx.fill();
          // Top highlight
          roundRect(ctx, p.x + 4, screenY + 2, PLATFORM_W - 8, 3, 2);
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fill();
        }
      }

      // Player
      drawRabbit(s.player.x, s.player.y - s.cameraY, s.player.facing);
    };

    const loop = () => {
      if (stopped) return;
      const s = stateRef.current!;
      if (s.dead) return;

      // Input
      const inputDir = heldRef.current.left ? -1 : heldRef.current.right ? 1 : 0;
      s.player.vx = inputDir * PLAYER_VX;
      if (inputDir !== 0) s.player.facing = inputDir as 1 | -1;

      // Physics
      s.player.vy += GRAVITY;
      const prevY = s.player.y;
      s.player.x += s.player.vx;
      s.player.y += s.player.vy;

      // Horizontal wrap
      if (s.player.x < -PLAYER_R) s.player.x = W + PLAYER_R;
      if (s.player.x > W + PLAYER_R) s.player.x = -PLAYER_R;

      // Platform collision (falling only)
      if (s.player.vy > 0) {
        for (const p of s.platforms) {
          if (p.broken) continue;
          if (
            s.player.x + PLAYER_R * 0.7 > p.x &&
            s.player.x - PLAYER_R * 0.7 < p.x + PLATFORM_W &&
            prevY <= p.y && s.player.y >= p.y
          ) {
            s.player.y = p.y;
            s.player.vy = JUMP_VY;
            if (p.type === 'break') p.broken = true;
            break;
          }
        }
      }

      // Camera follows up
      const target = s.player.y - H * 0.45;
      if (target < s.cameraY) s.cameraY = target;
      const heightUnits = -s.cameraY;
      if (heightUnits > s.maxHeight) s.maxHeight = heightUnits;
      s.score = Math.floor(s.maxHeight / 12);
      if (s.score > lastScore) { lastScore = s.score; setDisplayScore(s.score); }

      // Recycle platforms
      s.platforms = s.platforms.filter(p => p.y - s.cameraY < H + 80);
      while (s.platforms.length < PLATFORM_COUNT) {
        const top = Math.min(...s.platforms.map(p => p.y));
        const newY = top - (65 + Math.random() * 35);
        const newX = 10 + Math.random() * (W - PLATFORM_W - 20);
        s.platforms.push(makePlatform(newX, newY, s.score));
      }

      // Death
      if (s.player.y - s.cameraY > H + 40) {
        s.dead = true;
        draw(s);
        setPhase('over');
        onGameOverRef.current(s.score);
        return;
      }

      draw(s);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(rafRef.current); };
  }, []);

  const btnStyle: React.CSSProperties = {
    width: 72, height: 72, borderRadius: 999,
    background: '#1f2a44', color: '#fff',
    border: 'none', cursor: 'pointer', fontSize: 28, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitUserSelect: 'none', userSelect: 'none',
    touchAction: 'manipulation',
    boxShadow: '0 4px 12px rgba(31,42,68,0.25)',
  };

  const hold = (key: 'left' | 'right', v: boolean) => () => { heldRef.current[key] = v; };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'rgba(255,255,255,0.9)',
      }}>
        <div style={{ fontSize: 14, color: '#647c91' }}>高度</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1f2a44' }}>{displayScore}</div>
          <div style={{ fontSize: 14, color: '#647c91', marginLeft: 2 }}>m</div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        style={{ flex: 1, display: 'block', touchAction: 'none' }}
      />

      <div style={{
        flexShrink: 0, padding: '14px 32px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.7)',
        touchAction: 'none',
      }}>
        <button
          style={btnStyle}
          onPointerDown={hold('left', true)}
          onPointerUp={hold('left', false)}
          onPointerLeave={hold('left', false)}
          onPointerCancel={hold('left', false)}
        >
          ←
        </button>
        <button
          style={btnStyle}
          onPointerDown={hold('right', true)}
          onPointerUp={hold('right', false)}
          onPointerLeave={hold('right', false)}
          onPointerCancel={hold('right', false)}
        >
          →
        </button>
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
            <div style={{ fontSize: 36, marginBottom: 8 }}>🐰</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a2638', marginBottom: 6 }}>游戏结束</div>
            <div style={{ fontSize: 14, color: '#647c91', marginBottom: 4 }}>跳到了</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: '#1f2a44', marginBottom: 18 }}>{displayScore} m</div>
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
