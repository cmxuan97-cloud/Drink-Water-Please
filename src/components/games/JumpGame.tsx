import { useEffect, useRef, useState } from 'react';
import { GameProps } from './index';

const GRAVITY = 0.4;
const JUMP_VY = -13;
const PLAYER_VX = 4;
const PLATFORM_COUNT = 14;

interface Platform {
  id: number;
  x: number;
  y: number;
  w: number;
  type: 'normal' | 'break';
  broken: boolean;
  color: string;
}

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface JumpState {
  player: Player;
  platforms: Platform[];
  cameraY: number;
  maxCameraY: number;
  score: number;
  dead: boolean;
  frameCount: number;
  platformIdSeq: number;
}

const PLAT_COLORS = ['#3aa6dd', '#5bbde8', '#48c0f0'];
const BREAK_COLOR = '#f0a070';

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

function makePlatform(id: number, x: number, y: number, score: number): Platform {
  const w = 60 + Math.random() * 40;
  const isBrk = score > 5 && Math.random() < 0.2;
  return {
    id, x, y, w,
    type: isBrk ? 'break' : 'normal',
    broken: false,
    color: isBrk ? BREAK_COLOR : PLAT_COLORS[Math.floor(Math.random() * PLAT_COLORS.length)],
  };
}

function initPlatforms(W: number, H: number, baseSeq: number): { platforms: Platform[]; seq: number } {
  const platforms: Platform[] = [];
  let seq = baseSeq;
  // Starting platform
  platforms.push({ id: seq++, x: W / 2 - 40, y: H - 60, w: 80, type: 'normal', broken: false, color: '#3aa6dd' });
  let y = H - 60;
  for (let i = 0; i < PLATFORM_COUNT - 1; i++) {
    y -= 60 + Math.random() * 40;
    const x = Math.random() * (W - 80);
    platforms.push(makePlatform(seq++, x, y, 0));
  }
  return { platforms, seq };
}

export default function JumpGame({ playerEmoji, onGameOver, onBack, onRestart }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<JumpState | null>(null);
  const rafRef = useRef<number>(0);
  const heldRef = useRef({ left: false, right: false });
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

    const { platforms, seq } = initPlatforms(W, H, 0);
    const startPlat = platforms[0];

    stateRef.current = {
      player: { x: startPlat.x + startPlat.w / 2, y: startPlat.y - 28, vx: 0, vy: JUMP_VY },
      platforms,
      cameraY: 0,
      maxCameraY: 0,
      score: 0,
      dead: false,
      frameCount: 0,
      platformIdSeq: seq,
    };

    let stopped = false;
    let lastScore = 0;

    const spawnPlatforms = (s: JumpState) => {
      const topmost = Math.min(...s.platforms.map(p => p.y));
      while (s.platforms.length < PLATFORM_COUNT) {
        const newY = topmost - (60 + Math.random() * 40);
        const newX = Math.random() * (W - 80);
        s.platforms.push(makePlatform(s.platformIdSeq++, newX, newY, s.score));
      }
    };

    const draw = (s: JumpState) => {
      // Sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#cfe8f5');
      grad.addColorStop(1, '#ecf6fb');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      const camOffset = s.cameraY;

      // Platforms
      for (const p of s.platforms) {
        const screenY = p.y - camOffset;
        if (screenY > H + 20 || screenY + 14 < -20) continue;
        const platH = 14;
        if (p.broken) {
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = '#c0c0c0';
          ctx.lineWidth = 2;
          roundRect(ctx, p.x, screenY, p.w, platH, 7);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          roundRect(ctx, p.x, screenY, p.w, platH, 7);
          ctx.fillStyle = p.color;
          ctx.fill();
          // Highlight
          roundRect(ctx, p.x + 4, screenY + 2, p.w - 8, 4, 3);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fill();
        }
      }

      // Player
      const screenPlayerY = s.player.y - camOffset;
      const emojiSize = 26;
      ctx.font = `${emojiSize}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(playerEmoji, s.player.x, screenPlayerY - emojiSize / 2);
    };

    const loop = () => {
      if (stopped) return;
      const s = stateRef.current!;
      if (s.dead) return;
      s.frameCount++;

      // Input
      const inputDir = heldRef.current.left ? -1 : heldRef.current.right ? 1 : 0;
      s.player.vx = inputDir * PLAYER_VX;

      // Physics
      s.player.vy += GRAVITY;
      s.player.x += s.player.vx;
      s.player.y += s.player.vy;

      // Horizontal wrap
      if (s.player.x < -10) s.player.x = W + 10;
      if (s.player.x > W + 10) s.player.x = -10;

      // Platform collision (only when falling)
      if (s.player.vy > 0) {
        for (const p of s.platforms) {
          if (p.broken) continue;
          const prevY = s.player.y - s.player.vy;
          if (
            s.player.x + 12 > p.x && s.player.x - 12 < p.x + p.w &&
            prevY <= p.y && s.player.y >= p.y
          ) {
            s.player.y = p.y;
            s.player.vy = JUMP_VY;
            if (p.type === 'break') p.broken = true;
            break;
          }
        }
      }

      // Camera
      const targetCamY = s.player.y - H * 0.45;
      if (targetCamY > s.cameraY) {
        // falling — camera catches up but don't scroll down past max
      } else {
        s.cameraY = targetCamY;
      }
      if (s.cameraY > s.maxCameraY) s.maxCameraY = s.cameraY;

      // Score
      s.score = Math.floor(-s.cameraY / 10);
      if (s.score > lastScore) {
        lastScore = s.score;
        setDisplayScore(s.score);
      }

      // Spawn platforms
      s.platforms = s.platforms.filter(p => p.y - s.cameraY < H + 100);
      spawnPlatforms(s);

      // Death: fell off bottom
      if (s.player.y - s.cameraY > H + 60) {
        s.dead = true;
        draw(s);
        setPhase('over');
        onGameOver(s.score);
        return;
      }

      draw(s);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(rafRef.current); };
  }, [playerEmoji, onGameOver]);

  const btnStyle: React.CSSProperties = {
    width: 64, height: 64, borderRadius: 999,
    background: 'rgba(31,42,68,0.18)', color: '#fff',
    border: 'none', cursor: 'pointer', fontSize: 26,
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
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1a2638' }}>🌤️ 越跳越高</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#647c91' }}>高度</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1f2a44' }}>{displayScore}m</div>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ flex: 1, display: 'block', touchAction: 'none' }}
      />

      {/* Controls — left/right only */}
      <div style={{
        flexShrink: 0, height: 120,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '0 40px',
        background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)',
        touchAction: 'none',
      }}>
        <button
          style={btnStyle}
          onPointerDown={() => { heldRef.current.left = true; }}
          onPointerUp={() => { heldRef.current.left = false; }}
          onPointerLeave={() => { heldRef.current.left = false; }}
        >
          ←
        </button>
        <div style={{ fontSize: 13, color: '#93a8b8', fontWeight: 500 }}>跳跳跳！</div>
        <button
          style={btnStyle}
          onPointerDown={() => { heldRef.current.right = true; }}
          onPointerUp={() => { heldRef.current.right = false; }}
          onPointerLeave={() => { heldRef.current.right = false; }}
        >
          →
        </button>
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
            <div style={{ fontSize: 36, marginBottom: 8 }}>🌤️</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a2638', marginBottom: 6 }}>游戏结束</div>
            <div style={{ fontSize: 14, color: '#647c91', marginBottom: 4 }}>跳到了</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#1f2a44', marginBottom: 16 }}>{displayScore}m</div>
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
