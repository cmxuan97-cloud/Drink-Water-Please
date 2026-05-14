import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ANIMALS } from '../data/animals';
import { getCompanionId, getUnlockedIds } from '../lib/storage';
import Character from '../components/Character';

// ╔══════════════════════════════════════════════════════════════════════════╗
//   Constants
// ╚══════════════════════════════════════════════════════════════════════════╝

const SCENE_W = 540;
const SCENE_H = 1080;

const TICK_MS = 650;
const ANIMAL_SIZE = 58;
const ANIMAL_HIT_R = 38;     // tap-radius for animals
const INTERACT_DIST = 64;
const MAX_ANIMALS = 6;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;

// ── Zones (top-down regions of grass) ──────────────────────────────────────
type Zone = 'upper' | 'middle' | 'lower';
type Action = 'walking' | 'idle' | 'friendly' | 'fight' | 'dragged';

const ZONE_CONFIG: Record<Zone, { minX: number; maxX: number; minY: number; maxY: number }> = {
  // Widened zones so animals can roam the side meadows too
  upper:  { minX: 55,  maxX: 490, minY: 235, maxY: 350 },
  middle: { minX: 200, maxX: 510, minY: 460, maxY: 700 },
  lower:  { minX: 55,  maxX: 500, minY: 725, maxY: 895 },
};

// ── Speech pools ───────────────────────────────────────────────────────────
const SPEECH_LINES = [
  '好渴啊…想喝水', '今天天气真好', '宝藏到底在哪里？', '蝴蝶蝴蝶~',
  '走累了，歇会儿', '我闻到饼干味了', '你看到我的尾巴了吗？', '嗨~',
  '好困哦 zzz', '刚才那只好凶！', '山好高啊', '我今天好开心',
  '肚子咕咕叫', '想去看湖', '咦，是月亮？', '鱼鱼鱼！',
  '想吃西瓜', '主人在干嘛', '公园真大', '想跟你聊天',
];

const TAP_LINES = [
  '干嘛~', '嘿嘿被发现啦', '主人好~', '挠我挠我', '别戳啦~',
  '今天主人好热情', '抱抱', '咯咯咯', '哈喽~', '心动了 ❤',
];

const DRAG_LINES = {
  taken_from_water: ['又要爬过去了 :(', '我都快到湖边了！', '哼，不去湖边了', '气死我了'],
  taken_from_fire:  ['正在烤暖呢…', '火好暖啊…', '放我回去！'],
  taken_from_interact: ['正聊着呢…', '别打扰我们！', '哎呀~'],
  to_water:        ['谢谢主人带我来湖边！', '终于可以喝水了', '哇~湖！'],
  to_fire:         ['嗯~暖暖的', '烤火去咯', '主人懂我'],
  to_x_marker:     ['是这里吗？挖宝？', '我闻到金子味了'],
  random:          ['哇~飞起来了', '诶？好高', '主人在干嘛', '放我下来啦', '咦…搬家了？', '抓住啦~'],
  rain_extra:      ['雨好凉爽', '别让我淋湿啦', '雨里跳舞~'],
};

const NIGHT_LINES = ['好困啊…zzz', '星星好多', '月亮好圆', '夜里好安静'];
const RAIN_LINES = ['又下雨啦~', '想躲雨', '雨好凉', '我会淋湿的！'];

// ── Scene tap targets ──────────────────────────────────────────────────────
type TapTarget =
  | { kind: string; type: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: string; type: 'circle'; x: number; y: number; r: number };

// Tree positions (must roughly match the SVG; used only for tap hit-testing)
const TREE_POSITIONS: Array<[number, number, number]> = [
  // top pine line (y=208, height ~50)
  [20, 208, 50], [70, 208, 60], [120, 208, 55], [170, 208, 50], [220, 208, 60],
  [270, 208, 55], [320, 208, 50], [370, 208, 60], [420, 208, 55], [470, 208, 50],
  [510, 208, 60],
  // cabin trees
  [340, 395, 45], [465, 395, 42],
  // upper scattered
  [50, 410, 48], [250, 345, 36], [310, 345, 32],
  // middle pines
  [210, 555, 48], [185, 595, 42], [195, 655, 50], [355, 555, 36],
  [470, 560, 42], [490, 610, 38], [235, 690, 44], [460, 680, 42],
  // lower pines
  [50, 870, 56], [130, 750, 42], [155, 710, 36], [465, 810, 50],
  [495, 850, 46], [420, 760, 40], [295, 770, 38],
  // lake-edge pines
  [30, 905, 42], [490, 1010, 36], [510, 935, 40],
];

const SCENE_TARGETS: TapTarget[] = [
  { kind: 'cabin_top', type: 'rect',   x: 360, y: 340, w: 80,  h: 60 },
  { kind: 'cabin_mid', type: 'rect',   x: 395, y: 470, w: 76,  h: 60 },
  { kind: 'campfire',  type: 'circle', x: 270, y: 615, r: 28 },
  { kind: 'boat',      type: 'rect',   x: 285, y: 950, w: 48,  h: 30 },
  { kind: 'x_marker',  type: 'circle', x: 380, y: 760, r: 18 },
  { kind: 'small_lake',type: 'rect',   x: 30,  y: 320, w: 190, h: 80 },
  { kind: 'lake',      type: 'rect',   x: 40,  y: 905, w: 460, h: 145 },
  { kind: 'river',     type: 'rect',   x: 75,  y: 420, w: 100, h: 480 },
  // trees auto-added below
  ...TREE_POSITIONS.map(([x, y]) => ({
    kind: 'tree', type: 'circle' as const, x, y: y - 25, r: 22,
  })),
];

// ╔══════════════════════════════════════════════════════════════════════════╗
//   Types
// ╚══════════════════════════════════════════════════════════════════════════╝

type Sprite = {
  id: string;
  charId: string;
  x: number;
  y: number;
  zone: Zone;
  facing: 'left' | 'right';
  action: Action;
  targetX: number;
  targetY: number;
  speed: number;
  peer?: string;
  timer: number;
  speech?: { text: string; expiresAt: number };
  isDragging?: boolean;
};

type Fx = {
  uid: string;
  x: number;
  y: number;
  kind: 'friendly' | 'fight' | 'tap-heart';
};

type SceneFx = {
  uid: string;
  kind: 'bird' | 'ripple' | 'fish' | 'fire-burst' | 'dig';
  x: number;
  y: number;
  expiresAt: number;
};

type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
type Weather = 'sunny' | 'cloudy' | 'rain';

type Transform = { tx: number; ty: number; zoom: number };

// ╔══════════════════════════════════════════════════════════════════════════╗
//   Pure helpers
// ╚══════════════════════════════════════════════════════════════════════════╝

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pickRandom = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function pickTarget(zone: Zone, cx: number, cy: number): { tx: number; ty: number } {
  const { minX, maxX, minY, maxY } = ZONE_CONFIG[zone];
  for (let i = 0; i < 8; i++) {
    const tx = rand(minX, maxX);
    const ty = rand(minY, maxY);
    if (Math.hypot(tx - cx, ty - cy) >= 30) return { tx, ty };
  }
  return { tx: rand(minX, maxX), ty: rand(minY, maxY) };
}

function hitTargetAt(targets: TapTarget[], x: number, y: number): TapTarget | null {
  for (const t of targets) {
    if (t.type === 'circle') {
      if (Math.hypot(x - t.x, y - t.y) <= t.r) return t;
    } else {
      if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return t;
    }
  }
  return null;
}

function hitTestAnimal(sprites: Sprite[], sceneX: number, sceneY: number): Sprite | null {
  let closest: Sprite | null = null;
  let closestD = ANIMAL_HIT_R;
  for (const sp of sprites) {
    const cy = sp.y - ANIMAL_SIZE / 2;
    const d = Math.hypot(sceneX - sp.x, sceneY - cy);
    if (d <= closestD) { closest = sp; closestD = d; }
  }
  return closest;
}

function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 19) return 'dusk';
  return 'night';
}

function pickWeather(): Weather {
  const r = Math.random();
  if (r < 0.65) return 'sunny';
  if (r < 0.9)  return 'cloudy';
  return 'rain';
}

// ── Drag mood routing ──────────────────────────────────────────────────────

function nearbyTarget(x: number, y: number): string | null {
  // Returns the kind of nearby scene target, or null
  // Lake (big and small) + fire + X
  if (y >= 900 && x >= 40 && x <= 500) return 'lake';
  if (y >= 320 && y <= 400 && x >= 30 && x <= 220) return 'small_lake';
  if (Math.hypot(x - 270, y - 615) < 70) return 'fire';
  if (Math.hypot(x - 380, y - 760) < 30) return 'x_marker';
  if (x >= 75 && x <= 175 && y >= 420 && y <= 900) return 'river';
  return null;
}

function pickDragLine(
  startCtx: string | null,
  endCtx: string | null,
  startAction: Action,
  weather: Weather,
): string {
  // 1. Destination matters most
  if (endCtx === 'lake' || endCtx === 'small_lake' || endCtx === 'river') {
    return pickRandom(DRAG_LINES.to_water);
  }
  if (endCtx === 'fire') return pickRandom(DRAG_LINES.to_fire);
  if (endCtx === 'x_marker') return pickRandom(DRAG_LINES.to_x_marker);
  // 2. Otherwise, why are they upset?
  if (startCtx === 'lake' || startCtx === 'small_lake' || startCtx === 'river') {
    return pickRandom(DRAG_LINES.taken_from_water);
  }
  if (startCtx === 'fire') return pickRandom(DRAG_LINES.taken_from_fire);
  if (startAction === 'friendly' || startAction === 'fight') {
    return pickRandom(DRAG_LINES.taken_from_interact);
  }
  // 3. Weather flavor
  if (weather === 'rain' && Math.random() < 0.4) return pickRandom(DRAG_LINES.rain_extra);
  // 4. Default
  return pickRandom(DRAG_LINES.random);
}

// ╔══════════════════════════════════════════════════════════════════════════╗
//   Init & tick
// ╚══════════════════════════════════════════════════════════════════════════╝

function initSprites(unlockedIds: string[], companionId: string | null): Sprite[] {
  const ordered = [
    ...unlockedIds.filter(id => id === companionId),
    ...unlockedIds.filter(id => id !== companionId),
  ].slice(0, MAX_ANIMALS);

  const initZones: Zone[] = ['middle', 'upper', 'lower', 'middle', 'upper', 'lower'];
  return ordered.map((id, i) => {
    const animal = ANIMALS.find(a => a.id === id)!;
    const zone = initZones[i % initZones.length];
    const { minX, maxX, minY, maxY } = ZONE_CONFIG[zone];
    const x = rand(minX, maxX);
    const y = rand(minY, maxY);
    const { tx, ty } = pickTarget(zone, x, y);
    return {
      id, charId: animal.customArt,
      x, y, zone,
      facing: tx > x ? 'right' : 'left',
      action: 'walking', targetX: tx, targetY: ty,
      speed: rand(16, 24), timer: 0,
    };
  });
}

function doTick(prev: Sprite[]): { sprites: Sprite[]; newFx: Fx[] } {
  const newFx: Fx[] = [];
  let s = prev.map(sp => ({ ...sp }));

  // 1. Countdown timers
  s = s.map(sp => {
    if (sp.isDragging || sp.action === 'dragged') return sp;
    if ((sp.action === 'friendly' || sp.action === 'fight') && sp.timer > 0) {
      const t = sp.timer - 1;
      if (t === 0) {
        const { tx, ty } = pickTarget(sp.zone, sp.x, sp.y);
        return { ...sp, action: 'walking' as Action, timer: 0, peer: undefined, targetX: tx, targetY: ty };
      }
      return { ...sp, timer: t };
    }
    if (sp.action === 'idle' && sp.timer > 0) {
      const t = sp.timer - 1;
      if (t === 0) return { ...sp, action: 'walking' as Action, timer: 0 };
      return { ...sp, timer: t };
    }
    return sp;
  });

  // 2. Move walking animals
  s = s.map(sp => {
    if (sp.action !== 'walking' || sp.isDragging) return sp;
    const dx = sp.targetX - sp.x;
    const dy = sp.targetY - sp.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) {
      let newZone = sp.zone;
      const rz = Math.random();
      if (sp.zone === 'upper' && rz < 0.18) newZone = 'middle';
      else if (sp.zone === 'lower' && rz < 0.18) newZone = 'middle';
      else if (sp.zone === 'middle' && rz < 0.18) newZone = Math.random() < 0.5 ? 'upper' : 'lower';
      const { tx, ty } = pickTarget(newZone, sp.x, sp.y);
      return {
        ...sp,
        zone: newZone,
        action: 'idle' as Action, timer: randInt(1, 2),
        targetX: tx, targetY: ty,
        facing: tx > sp.x ? 'right' : 'left',
      };
    }
    const step = Math.min(dist, sp.speed);
    return {
      ...sp,
      x: sp.x + (dx / dist) * step,
      y: sp.y + (dy / dist) * step,
      facing: dx > 0 ? 'right' : 'left',
    };
  });

  // 3. New interactions among walking/idle (skip dragging)
  const free = s.filter(sp => !sp.isDragging && (sp.action === 'walking' || sp.action === 'idle'));
  outer:
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      const a = free[i], b = free[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) > INTERACT_DIST) continue;
      const isFight = Math.random() < 0.38;
      const kind: Action = isFight ? 'fight' : 'friendly';
      const dur = isFight ? 5 : 4;
      const mx = (a.x + b.x) / 2;
      const my = Math.min(a.y, b.y) - 12;
      newFx.push({ uid: `${Date.now()}-${i}-${j}`, x: mx, y: my, kind: isFight ? 'fight' : 'friendly' });
      s = s.map(sp => {
        if (sp.id === a.id) return { ...sp, action: kind, timer: dur, peer: b.id, facing: a.x <= b.x ? 'right' : 'left' };
        if (sp.id === b.id) return { ...sp, action: kind, timer: dur, peer: a.id, facing: b.x <= a.x ? 'right' : 'left' };
        return sp;
      });
      break outer;
    }
  }

  return { sprites: s, newFx };
}

// ╔══════════════════════════════════════════════════════════════════════════╗
//   SVG components
// ╚══════════════════════════════════════════════════════════════════════════╝

function Pine({ x, y, h = 60 }: { x: number; y: number; h?: number }) {
  const w = h * 0.42;
  return (
    <g>
      <rect x={x - 3.5} y={y - 4} width="7" height="14" rx="1" fill="#5a3818" />
      <polygon points={`${x},${y - h} ${x - w},${y - 3} ${x + w},${y - 3}`} fill="#2a5a1a" />
      <polygon points={`${x},${y - h + 6} ${x - w * 0.82},${y - h * 0.4} ${x + w * 0.82},${y - h * 0.4}`} fill="#3a7a26" />
      <polygon points={`${x},${y - h + 10} ${x - w * 0.55},${y - h * 0.7} ${x + w * 0.55},${y - h * 0.7}`} fill="#4e9332" />
    </g>
  );
}

function Mountain({ x, y, w = 130, h = 130, snow = true }: { x: number; y: number; w?: number; h?: number; snow?: boolean }) {
  const peakY = y - h;
  const snowH = h * 0.42;
  return (
    <g>
      <polygon points={`${x - w / 2},${y} ${x},${peakY} ${x + w / 2},${y}`} fill="#a09484" />
      <polygon points={`${x - w / 2},${y} ${x},${peakY} ${x - 4},${y}`} fill="#8a7e6e" />
      {snow && (
        <>
          <path
            d={`M${x - w * 0.27},${peakY + snowH} Q${x - w * 0.18},${peakY + snowH - 5} ${x - w * 0.1},${peakY + snowH + 2} Q${x - w * 0.04},${peakY + snowH - 6} ${x},${peakY + snowH} Q${x + w * 0.05},${peakY + snowH - 5} ${x + w * 0.13},${peakY + snowH} Q${x + w * 0.2},${peakY + snowH - 4} ${x + w * 0.27},${peakY + snowH + 4} L${x},${peakY} Z`}
            fill="#f8f4ec"
          />
          <polygon points={`${x},${peakY} ${x - 4},${peakY + snowH * 0.6} ${x + 4},${peakY + snowH * 0.5}`} fill="#dfd8c8" opacity="0.6" />
        </>
      )}
    </g>
  );
}

function Cabin({ x, y, w = 64, lit = false }: { x: number; y: number; w?: number; lit?: boolean }) {
  const h = w * 0.78;
  return (
    <g>
      <ellipse cx={x + w / 2} cy={y + 4} rx={w * 0.55} ry={6} fill="#1a3008" opacity="0.25" />
      <rect x={x} y={y - h} width={w} height={h} fill="#b07440" rx="2" />
      <line x1={x} y1={y - h * 0.7} x2={x + w} y2={y - h * 0.7} stroke="#7a4a20" strokeWidth="1.2" />
      <line x1={x} y1={y - h * 0.4} x2={x + w} y2={y - h * 0.4} stroke="#7a4a20" strokeWidth="1.2" />
      <polygon points={`${x - 6},${y - h} ${x + w + 6},${y - h} ${x + w / 2},${y - h - h * 0.55}`} fill="#5a3a1c" />
      <polygon points={`${x + w / 2},${y - h - h * 0.55} ${x + w + 6},${y - h} ${x + w / 2},${y - h * 0.95}`} fill="#3e2812" />
      <rect x={x + w * 0.6} y={y - h - h * 0.45} width="6" height="14" fill="#3a2410" />
      <ellipse cx={x + w * 0.6 + 3} cy={y - h - h * 0.5} rx="4" ry="3" fill="#888076" opacity="0.7" />
      <rect x={x + w * 0.4} y={y - h * 0.55} width={w * 0.2} height={h * 0.55} fill="#3a2008" rx="1" />
      <rect x={x + w * 0.45} y={y - h * 0.42} width="3" height="3" rx="1" fill="#f8e040" />
      {/* Window — gets bright when lit */}
      <rect
        x={x + w * 0.1} y={y - h * 0.75}
        width={w * 0.22} height={h * 0.22}
        fill={lit ? '#fff0a0' : '#a8d8e0'}
        stroke="#5a3a20" strokeWidth="1.5" rx="1"
        style={{ transition: 'fill 0.25s' }}
      />
      {lit && (
        <circle cx={x + w * 0.1 + w * 0.11} cy={y - h * 0.64} r={w * 0.32} fill="#fff0a0" opacity="0.35" />
      )}
      <line x1={x + w * 0.1 + w * 0.11} y1={y - h * 0.75} x2={x + w * 0.1 + w * 0.11} y2={y - h * 0.53} stroke="#5a3a20" strokeWidth="0.8" />
    </g>
  );
}

function Tent({ x, y, h = 50, color = '#f0e4c8' }: { x: number; y: number; h?: number; color?: string }) {
  const w = h * 1.05;
  return (
    <g>
      <ellipse cx={x} cy={y + 3} rx={w * 0.55} ry={4} fill="#1a3008" opacity="0.25" />
      <polygon points={`${x},${y - h} ${x - w / 2},${y} ${x + w / 2},${y}`} fill={color} />
      <polygon points={`${x},${y - h} ${x},${y} ${x + w / 2},${y}`} fill="#c0b496" />
      <line x1={x} y1={y - h} x2={x} y2={y - h - 6} stroke="#6a4828" strokeWidth="1.5" />
      <circle cx={x} cy={y - h - 7} r="2" fill="#d84020" />
      <polygon points={`${x},${y - h * 0.75} ${x - 7},${y} ${x + 7},${y}`} fill="#7a6a4e" />
      <line x1={x - w / 2} y1={y} x2={x + w / 2} y2={y} stroke="#c83828" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function Campfire({ x, y, burst = false }: { x: number; y: number; burst?: boolean }) {
  const scale = burst ? 1.7 : 1;
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Warm glow rings — pulse but don't move the flame */}
      <circle cx={0} cy={-12} r={42} fill="#ff9040" opacity="0.10" className="pk-fire-glow-1" />
      <circle cx={0} cy={-12} r={28} fill="#ffb050" opacity="0.18" className="pk-fire-glow-2" />
      <circle cx={0} cy={-14} r={18} fill="#ffd060" opacity="0.28" className="pk-fire-glow-3" />

      {/* Ground shadow + logs */}
      <ellipse cx={0} cy={4} rx={22} ry={5} fill="#1a3008" opacity="0.3" />
      <rect x={-20} y={-2} width="40" height="7" rx="2.5" fill="#5a3818" transform="rotate(-12)" />
      <rect x={-18} y={-2} width="36" height="6" rx="2.5" fill="#7a4828" transform="rotate(14)" />

      {/* Static flame */}
      <g style={{ transform: `scale(${scale})`, transformOrigin: 'center bottom', transition: 'transform 0.25s' }}>
        <path d="M-9 -4 Q-14 -22 -5 -26 Q-2 -16 0 -30 Q4 -18 8 -24 Q13 -14 9 -4 Z" fill="#f47020" />
        <path d="M-5 -4 Q-7 -17 -2 -20 Q0 -12 2 -22 Q5 -16 7 -18 Q7 -9 5 -4 Z" fill="#f8d040" />
      </g>

      {/* Slow rising embers — tiny glowing dots */}
      <circle cx={-3} cy={-18} r={0.9} fill="#ffd060" className="pk-ember pk-ember-1" />
      <circle cx={2}  cy={-22} r={0.7} fill="#ff9040" className="pk-ember pk-ember-2" />
      <circle cx={5}  cy={-15} r={0.8} fill="#ffe080" className="pk-ember pk-ember-3" />
      <circle cx={-4} cy={-12} r={0.6} fill="#ffa050" className="pk-ember pk-ember-4" />

      {burst && (
        <g>
          {[-18, -8, 8, 18].map((dx, i) => (
            <circle key={i} cx={dx} cy={-30} r="2.5" fill="#ffd040" className="pk-spark" style={{ animationDelay: `${i * 0.06}s` }} />
          ))}
        </g>
      )}
    </g>
  );
}

function Boat({ x, y }: { x: number; y: number }) {
  return (
    <g style={{ transition: 'transform 4s cubic-bezier(0.4, 0, 0.6, 1)', transform: `translate(${x - 290}px, 0)` }}>
      <g transform="translate(290, 970)">
        <ellipse cx={18} cy={14 + (y - 970)} rx={26} ry={3.5} fill="#1a3030" opacity="0.35" />
        <path d={`M0 ${8 + (y - 970)} L36 ${8 + (y - 970)} L31 ${16 + (y - 970)} L5 ${16 + (y - 970)} Z`} fill="#a06030" />
        <rect x={5} y={6 + (y - 970)} width="26" height="3" rx="1" fill="#b87040" />
        <line x1={18} y1={6 + (y - 970)} x2={18} y2={-14 + (y - 970)} stroke="#5a3a20" strokeWidth="1.8" />
        <polygon points={`18,${-14 + (y - 970)} 18,${-2 + (y - 970)} 32,${-8 + (y - 970)}`} fill="#d83828" />
      </g>
    </g>
  );
}

function Bush({ x, y, r = 12 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x + r * 0.6} cy={y} r={r * 0.7} fill="#3a7028" />
      <circle cx={x - r * 0.5} cy={y} r={r * 0.75} fill="#3a7028" />
      <circle cx={x} cy={y - r * 0.5} r={r * 0.8} fill="#4a8a30" />
      <circle cx={x + r * 0.25} cy={y - r * 0.2} r={r * 0.5} fill="#5aa040" opacity="0.85" />
    </g>
  );
}

function Rock({ x, y, w = 30 }: { x: number; y: number; w?: number }) {
  return (
    <g>
      <ellipse cx={x + w * 0.1} cy={y + 4} rx={w * 0.7} ry={6} fill="#1a3030" opacity="0.3" />
      <path d={`M${x - w / 2} ${y} Q${x - w / 2 + 2} ${y - w * 0.5} ${x - w * 0.1} ${y - w * 0.55} Q${x + w * 0.2} ${y - w * 0.65} ${x + w * 0.4} ${y - w * 0.4} Q${x + w / 2} ${y - w * 0.1} ${x + w / 2 - 4} ${y} Z`} fill="#a89a88" />
      <path d={`M${x - w / 2} ${y} Q${x - w / 2 + 2} ${y - w * 0.5} ${x - w * 0.1} ${y - w * 0.55} L${x - w * 0.1} ${y} Z`} fill="#7e7064" />
    </g>
  );
}

function Mushroom({ x, y, color = '#d83828' }: { x: number; y: number; color?: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 2} rx={6} ry={1.5} fill="#1a3008" opacity="0.3" />
      <rect x={x - 2} y={y - 5} width="4" height="7" rx="1.5" fill="#f8e8c0" />
      <path d={`M ${x - 7} ${y - 5} Q ${x - 7} ${y - 11} ${x} ${y - 11} Q ${x + 7} ${y - 11} ${x + 7} ${y - 5} Z`} fill={color} />
      <circle cx={x - 2.5} cy={y - 8} r="1.1" fill="white" opacity="0.75" />
      <circle cx={x + 2} cy={y - 6.5} r="0.9" fill="white" opacity="0.65" />
    </g>
  );
}

function Stump({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 2} rx={11} ry={3} fill="#1a3008" opacity="0.3" />
      <ellipse cx={x} cy={y - 4} rx={10} ry={6} fill="#7a4828" />
      <ellipse cx={x} cy={y - 6} rx={10} ry={6} fill="#9a6838" />
      <ellipse cx={x} cy={y - 6} rx={5.5} ry={3.2} fill="#5a3818" />
      <path d={`M ${x - 3} ${y - 7} Q ${x} ${y - 5.5} ${x + 3} ${y - 7}`} stroke="#3a2410" strokeWidth="0.6" fill="none" />
    </g>
  );
}

function Wildflowers({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <circle cx={0} cy={0} r="2.6" fill="#ff80a8" />
      <circle cx={6} cy={-2} r="2.2" fill="#ffe048" />
      <circle cx={-5} cy={-1} r="2.2" fill="#fff0c0" />
      <circle cx={3} cy={5} r="2.4" fill="#a878ff" />
      <circle cx={-4} cy={4} r="2" fill="#ff9040" />
    </g>
  );
}

function Butterfly({ cx, cy, anim, dur = 14, color1, color2 }: {
  cx: number; cy: number; anim: string; dur?: number; color1: string; color2: string;
}) {
  return (
    <g style={{ animation: `${anim} ${dur}s ease-in-out infinite` }}>
      <g transform={`translate(${cx}, ${cy})`}>
        <g className="pk-bfly-flap">
          <ellipse cx={-4} cy={-1.8} rx={5} ry={4} fill={color1} />
          <ellipse cx={-3.2} cy={2.5} rx={3.8} ry={3} fill={color2} />
          <ellipse cx={4} cy={-1.8} rx={5} ry={4} fill={color1} />
          <ellipse cx={3.2} cy={2.5} rx={3.8} ry={3} fill={color2} />
          <circle cx={-5} cy={-2.5} r={1.2} fill="white" opacity="0.6" />
          <circle cx={5} cy={-2.5} r={1.2} fill="white" opacity="0.6" />
        </g>
        <ellipse cx={0} cy={0} rx={0.8} ry={5} fill="#2a1810" />
        <path d="M-0.8 -4.5 Q-1.6 -7 -2.5 -7.8" stroke="#2a1810" strokeWidth="0.5" fill="none" />
        <path d="M0.8 -4.5 Q1.6 -7 2.5 -7.8" stroke="#2a1810" strokeWidth="0.5" fill="none" />
      </g>
    </g>
  );
}

function Sign({ x, y, text = '宝藏 →' }: { x: number; y: number; text?: string }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 2} rx={14} ry={2.5} fill="#1a3008" opacity="0.3" />
      <rect x={x - 1.5} y={y - 16} width="3" height="18" rx="0.5" fill="#7a4828" />
      <rect x={x - 18} y={y - 22} width="36" height="11" rx="1.5" fill="#e8c880" stroke="#a07840" strokeWidth="1.2" />
      <text x={x} y={y - 14} textAnchor="middle" fill="#5a3810" fontSize="7" fontWeight="700" fontFamily="sans-serif">{text}</text>
    </g>
  );
}

// ── Scene FX SVG (rendered inside SceneFxLayer) ────────────────────────────

function Bird({ x, y }: { x: number; y: number }) {
  return (
    <g className="pk-bird" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <g className="pk-bird-fly">
        <path d="M-7 0 Q-3 -5 0 0 Q3 -5 7 0" stroke="#2a3850" strokeWidth="2" fill="none" strokeLinecap="round" className="pk-bird-flap" />
      </g>
    </g>
  );
}

function Ripple({ x, y }: { x: number; y: number }) {
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)` }}>
      {[0, 0.25, 0.5].map((delay, i) => (
        <circle
          key={i}
          cx={0} cy={0}
          r="6"
          fill="none"
          stroke="white"
          strokeWidth="2"
          opacity="0"
          className="pk-ripple"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </g>
  );
}

function FishJump({ x, y }: { x: number; y: number }) {
  return (
    <g className="pk-fish" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <g className="pk-fish-arc">
        <ellipse cx={0} cy={0} rx="8" ry="4" fill="#5a9ad0" />
        <polygon points="-8,0 -14,-4 -14,4" fill="#3e7ab0" />
        <circle cx={4} cy={-1} r="1.2" fill="white" />
      </g>
      {/* splash */}
      <g className="pk-fish-splash">
        {[0, 1, 2].map(i => (
          <ellipse key={i} cx={(i - 1) * 6} cy={4} rx={2 - i * 0.4} ry={1.5} fill="white" opacity="0.7" />
        ))}
      </g>
    </g>
  );
}

function DigFx({ x, y }: { x: number; y: number }) {
  const items = ['✨', '💰', '⭐', '✨'];
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)` }}>
      <foreignObject x={-100} y={-50} width="200" height="80" style={{ overflow: 'visible' }}>
        <div style={{ position: 'relative', width: 200, height: 80 }}>
          {items.map((it, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: 100 + (i - 1.5) * 26,
                top: 40,
                fontSize: 22,
                transform: 'translate(-50%,-50%)',
                animationDelay: `${i * 0.09}s`,
                animation: 'pk-fx-rise 1.9s ease-out forwards',
                opacity: 0,
              }}
            >
              {it}
            </span>
          ))}
        </div>
      </foreignObject>
    </g>
  );
}

// ╔══════════════════════════════════════════════════════════════════════════╗
//   ParkSceneSVG (background)
// ╚══════════════════════════════════════════════════════════════════════════╝

type SceneProps = {
  timeOfDay: TimeOfDay;
  weather: Weather;
  cabinLit: { top: boolean; mid: boolean };
  boatX: number;
  fireBurstAt: number | null;
};

function ParkSceneSVG({ timeOfDay, weather, cabinLit, boatX, fireBurstAt }: SceneProps) {
  // sky gradients per time of day
  const skyStops = {
    dawn:  ['#ffd6c0', '#fbe8c0'],
    day:   ['#cae9f6', '#a8d850'],
    dusk:  ['#ff9a5a', '#e8c46a'],
    night: ['#0e1a3c', '#1f2c5a'],
  }[timeOfDay];
  const grassStops = {
    dawn:  ['#9ec85a', '#7eb538', '#609d28'],
    day:   ['#a8d850', '#88c440', '#6cab30'],
    dusk:  ['#7aa848', '#5a8c30', '#456e22'],
    night: ['#2a4630', '#1f3625', '#172a1d'],
  }[timeOfDay];

  const overlayColor = {
    dawn:  null,
    day:   null,
    dusk:  'rgba(255, 130, 80, 0.16)',
    night: 'rgba(15, 25, 70, 0.42)',
  }[timeOfDay];

  const isNight = timeOfDay === 'night';
  const isDawn = timeOfDay === 'dawn';
  const isDusk = timeOfDay === 'dusk';

  // Fire burst flag — adds a class when set
  const fireBurst = fireBurstAt !== null && Date.now() < fireBurstAt;

  return (
    <svg
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      width={SCENE_W}
      height={SCENE_H}
      style={{ display: 'block', position: 'absolute', inset: 0, overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <linearGradient id="pk-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={grassStops[0]} />
          <stop offset="40%" stopColor={grassStops[1]} />
          <stop offset="100%" stopColor={grassStops[2]} />
        </linearGradient>
        <linearGradient id="pk-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isNight ? '#3a5a90' : '#7adcf0'} />
          <stop offset="100%" stopColor={isNight ? '#1a2e58' : '#3eaad4'} />
        </linearGradient>
        <linearGradient id="pk-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skyStops[0]} />
          <stop offset="100%" stopColor={skyStops[1]} />
        </linearGradient>
      </defs>

      {/* Extended grass + sky (bleed past edges) */}
      <rect x={-400} y={-400} width={SCENE_W + 800} height={SCENE_H + 800} fill="url(#pk-grass)" />
      <rect x={-400} y={-400} width={SCENE_W + 800} height={570} fill="url(#pk-sky)" />

      {/* Stars (night) */}
      {isNight && (
        <g>
          {[
            [60, 50], [120, 80], [200, 40], [280, 70], [340, 40],
            [340, 90], [460, 50], [510, 85], [40, 100], [180, 120],
            [330, 120], [490, 120], [80, 40], [240, 95], [380, 30],
            [80, 130], [220, 60], [500, 30],
          ].map(([sx, sy], i) => (
            <circle key={`st-${i}`} cx={sx} cy={sy} r={i % 3 === 0 ? 1.6 : 1} fill="white" className="pk-twinkle" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
          {/* Moon — above mountains */}
          <g>
            <circle cx={420} cy={40} r={42} fill="#fff0d0" opacity="0.18" />
            <circle cx={420} cy={40} r={32} fill="#fff0d0" opacity="0.3" />
            <circle cx={420} cy={40} r={26} fill="#f8f0d0" />
            <circle cx={414} cy={34} r={21} fill="#fffcec" />
            <circle cx={409} cy={32} r={3.8} fill="#e8dcb8" opacity="0.7" />
            <circle cx={423} cy={44} r={3} fill="#e8dcb8" opacity="0.6" />
            <circle cx={417} cy={48} r={2} fill="#e8dcb8" opacity="0.55" />
          </g>
        </g>
      )}

      {/* Day sun — above mountains, with pulsing rays */}
      {timeOfDay === 'day' && (
        <g>
          {/* Outer glow */}
          <circle cx={120} cy={60} r={52} fill="#ffe080" opacity="0.18" />
          {/* Rays */}
          <g className="pk-sun-rays" style={{ transformOrigin: '120px 60px' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <rect
                key={i}
                x={118.5} y={20}
                width={3} height={14}
                rx={1.5}
                fill="#ffc830"
                transform={`rotate(${i * 30} 120 60)`}
                opacity="0.85"
              />
            ))}
          </g>
          {/* Sun body */}
          <circle cx={120} cy={60} r={30} fill="#ffc830" />
          <circle cx={120} cy={60} r={24} fill="#ffe060" />
          <circle cx={114} cy={54} r={8} fill="#fff8c8" opacity="0.85" />
        </g>
      )}

      {/* Dawn sun — low, rising */}
      {isDawn && (
        <g>
          <circle cx={110} cy={95} r={40} fill="#ffa478" opacity="0.45" />
          <circle cx={110} cy={95} r={30} fill="#ffc890" opacity="0.85" />
          <circle cx={110} cy={95} r={22} fill="#ffe4b0" />
          <circle cx={106} cy={91} r={6} fill="#fff4d0" opacity="0.8" />
        </g>
      )}

      {/* Dusk sun — large, setting */}
      {isDusk && (
        <g>
          <circle cx={430} cy={85} r={50} fill="#ff5028" opacity="0.32" />
          <circle cx={430} cy={85} r={38} fill="#ff7040" opacity="0.75" />
          <circle cx={430} cy={85} r={28} fill="#ff9858" />
          <circle cx={426} cy={81} r={8} fill="#ffc080" opacity="0.7" />
        </g>
      )}

      {/* Day clouds */}
      {timeOfDay === 'day' && !isNight && (
        <g opacity={weather === 'cloudy' || weather === 'rain' ? 0 : 0.85}>
          <ellipse cx="120" cy="80" rx="40" ry="12" fill="white" />
          <ellipse cx="150" cy="75" rx="30" ry="10" fill="white" />
          <ellipse cx="400" cy="110" rx="44" ry="14" fill="white" />
          <ellipse cx="430" cy="105" rx="34" ry="11" fill="white" />
        </g>
      )}

      {/* Extra clouds when cloudy/rain */}
      {(weather === 'cloudy' || weather === 'rain') && (
        <g opacity={weather === 'rain' ? 0.85 : 0.78}>
          <ellipse cx="100" cy="85" rx="56" ry="18" fill={weather === 'rain' ? '#7a8898' : '#dde2e8'} />
          <ellipse cx="140" cy="78" rx="42" ry="14" fill={weather === 'rain' ? '#7a8898' : '#dde2e8'} />
          <ellipse cx="290" cy="60" rx="50" ry="16" fill={weather === 'rain' ? '#6e7c8c' : '#cdd5de'} />
          <ellipse cx="320" cy="55" rx="36" ry="12" fill={weather === 'rain' ? '#6e7c8c' : '#cdd5de'} />
          <ellipse cx="430" cy="100" rx="50" ry="17" fill={weather === 'rain' ? '#7a8898' : '#dde2e8'} />
          <ellipse cx="470" cy="92" rx="40" ry="13" fill={weather === 'rain' ? '#7a8898' : '#dde2e8'} />
        </g>
      )}

      {/* Mountains */}
      <Mountain x={120} y={175} w={140} h={130} />
      <Mountain x={280} y={175} w={180} h={170} />
      <Mountain x={430} y={175} w={150} h={140} />
      <Mountain x={-20} y={175} w={120} h={110} />
      <Mountain x={560} y={175} w={130} h={120} />

      {/* Pine forest line */}
      {[-30, 20, 70, 120, 170, 220, 270, 320, 370, 420, 470, 510, 560, 600].map((x, i) => (
        <Pine key={`tp-${i}`} x={x} y={208} h={44 + (i % 3) * 10} />
      ))}

      {/* Grass tufts */}
      {[
        [80, 230], [165, 250], [240, 230], [330, 245], [410, 235], [470, 260],
        [100, 280], [195, 280], [280, 290], [365, 280], [445, 290],
      ].map(([x, y], i) => (
        <ellipse key={`gt-${i}`} cx={x} cy={y} rx="14" ry="4" fill={isNight ? '#2a3826' : '#6cab30'} opacity="0.55" />
      ))}

      {/* Upper flowers */}
      {[[140, 245], [350, 260], [220, 305], [400, 300]].map(([x, y], i) => (
        <g key={`fl-${i}`}>
          <circle cx={x} cy={y} r="3" fill="#ff80a8" />
          <circle cx={x + 5} cy={y + 2} r="2.5" fill="#ffe048" />
          <circle cx={x - 4} cy={y + 3} r="2.5" fill="#fff0c0" />
        </g>
      ))}

      {/* Small lake */}
      <g>
        <path d="M40 340 Q60 320 110 325 Q170 320 195 340 Q210 360 195 380 Q170 400 110 395 Q55 395 35 375 Q25 358 40 340 Z" fill="url(#pk-lake)" />
        <path d="M70 345 Q120 340 175 355" stroke="white" strokeWidth="1.5" fill="none" opacity="0.55" />
        <ellipse cx="100" cy="375" rx="22" ry="5" fill="white" opacity="0.3" />
      </g>

      {/* Reeds */}
      {[180, 190, 200, 210, 35, 45, 55].map((x, i) => (
        <g key={`rd-${i}`}>
          <line x1={x} y1={i < 4 ? 348 : 345} x2={x} y2={i < 4 ? 332 : 328} stroke="#5a8828" strokeWidth="1.5" />
          <ellipse cx={x} cy={i < 4 ? 328 : 325} rx="2.5" ry="5" fill="#4a7820" />
        </g>
      ))}

      {/* Upper cabin */}
      <Cabin x={365} y={400} w={70} lit={cabinLit.top || isNight} />
      <Pine x={340} y={395} h={45} />
      <Pine x={465} y={395} h={42} />

      {/* Upper scattered */}
      <Pine x={50} y={410} h={48} />
      <Pine x={250} y={345} h={36} />
      <Pine x={310} y={345} h={32} />
      <Rock x={80} y={415} w={28} />
      <Rock x={220} y={355} w={22} />
      <Rock x={490} y={395} w={26} />

      {/* ── SIDE DECORATIONS — fill the empty grass ── */}
      {/* Right side (between mountain forest and middle) */}
      <Pine x={515} y={295} h={42} />
      <Pine x={490} y={335} h={36} />
      <Mushroom x={500} y={365} />
      <Wildflowers x={518} y={385} />
      <Stump x={510} y={425} />
      <Mushroom x={528} y={445} color="#f0a020" />
      <Rock x={520} y={490} w={20} />
      <Wildflowers x={500} y={478} />

      {/* Right side (middle area outskirts) */}
      <Pine x={520} y={540} h={42} />
      <Wildflowers x={490} y={510} />
      <Mushroom x={510} y={585} />
      <Stump x={520} y={630} />
      <Wildflowers x={500} y={665} />
      <Pine x={520} y={700} h={38} />

      {/* Right side (lower) */}
      <Mushroom x={515} y={735} color="#f0a020" />
      <Wildflowers x={505} y={760} />
      <Pine x={520} y={790} h={40} />
      <Stump x={510} y={830} />
      <Wildflowers x={520} y={865} />
      <Rock x={500} y={875} w={18} />

      {/* Left side — left of the river (animals reach this via lower zone) */}
      <Pine x={28} y={500} h={38} />
      <Mushroom x={45} y={530} />
      <Wildflowers x={32} y={560} />
      <Stump x={40} y={595} />
      <Mushroom x={20} y={630} color="#a878ff" />
      <Pine x={32} y={665} h={44} />
      <Wildflowers x={48} y={695} />
      <Rock x={30} y={720} w={20} />
      <Wildflowers x={50} y={755} />
      <Mushroom x={28} y={790} />
      <Stump x={42} y={830} />
      <Wildflowers x={28} y={862} />

      {/* Sparse fill — between upper meadow and middle (transition) */}
      <Wildflowers x={140} y={430} />
      <Mushroom x={240} y={445} />
      <Wildflowers x={310} y={460} />
      <Stump x={205} y={460} />
      <Wildflowers x={400} y={445} />
      <Mushroom x={310} y={420} color="#a878ff" />
      <Rock x={285} y={478} w={16} />

      {/* Between middle and lower (transition) */}
      <Wildflowers x={210} y={715} />
      <Mushroom x={290} y={710} />
      <Stump x={365} y={720} />
      <Wildflowers x={425} y={715} />

      {/* Signpost near treasure */}
      <Sign x={360} y={745} text="宝藏 →" />

      {/* ── Butterflies — flying around the meadows ── */}
      <Butterfly cx={280} cy={300} anim="pk-bfly-1" dur={14} color1="#ff80a8" color2="#ffd4e0" />
      <Butterfly cx={140} cy={470} anim="pk-bfly-2" dur={12} color1="#ffe048" color2="#fff8c8" />
      <Butterfly cx={400} cy={620} anim="pk-bfly-3" dur={16} color1="#a878ff" color2="#d4c0ff" />
      <Butterfly cx={300} cy={830} anim="pk-bfly-4" dur={13} color1="#ff9040" color2="#ffe0a0" />
      <Butterfly cx={210} cy={1020} anim="pk-bfly-5" dur={15} color1="#7adcf0" color2="#cae9f6" />
      <Butterfly cx={500} cy={400} anim="pk-bfly-6" dur={11} color1="#ff80a8" color2="#fff0c0" />

      {/* River */}
      <path
        d="M155 395 Q145 430 130 460 Q115 500 95 545 Q80 600 95 660 Q115 720 100 780 Q85 845 130 905"
        stroke={isNight ? '#3878a8' : '#5fc8e0'} strokeWidth="40" fill="none" strokeLinecap="round"
      />
      <path
        d="M155 395 Q145 430 130 460 Q115 500 95 545 Q80 600 95 660 Q115 720 100 780 Q85 845 130 905"
        stroke={isNight ? '#6098c0' : '#a4e2f0'} strokeWidth="18" fill="none" strokeLinecap="round" opacity="0.65"
      />
      <ellipse cx="118" cy="490" rx="6" ry="2" fill="white" opacity="0.7" />
      <ellipse cx="98"  cy="600" rx="5" ry="2" fill="white" opacity="0.65" />
      <ellipse cx="110" cy="740" rx="6" ry="2" fill="white" opacity="0.7" />
      <ellipse cx="92"  cy="820" rx="5" ry="2" fill="white" opacity="0.6" />

      {/* Middle meadow + campfire area */}
      <ellipse cx="295" cy="600" rx="220" ry="135" fill={isNight ? '#1e3a26' : '#b0e060'} opacity="0.4" />
      <ellipse cx="270" cy="610" rx="60" ry="40" fill="#d4b070" opacity="0.55" />
      <Campfire x={270} y={620} burst={fireBurst} />

      <Tent x={340} y={605} h={52} />
      <Tent x={385} y={610} h={45} color="#e8d0a4" />

      <Cabin x={400} y={530} w={66} lit={cabinLit.mid || isNight} />

      {/* Just a few pines framing the clearing, not crowding it */}
      <Pine x={205} y={560} h={48} />
      <Pine x={485} y={565} h={44} />
      <Pine x={235} y={695} h={44} />

      <Bush x={170} y={530} r={12} />
      <Bush x={425} y={695} r={13} />

      {/* Logs near campfire (single, neater) */}
      <rect x="225" y="650" width="30" height="6" rx="3" fill="#7a4a28" />

      <Rock x={155} y={730} w={22} />

      {/* Lower forest */}
      <Pine x={50} y={870} h={56} />
      <Pine x={130} y={750} h={42} />
      <Pine x={155} y={710} h={36} />
      <Pine x={465} y={810} h={50} />
      <Pine x={495} y={850} h={46} />
      <Pine x={420} y={760} h={40} />
      <Pine x={295} y={770} h={38} />

      <Bush x={205} y={810} r={11} />
      <Bush x={340} y={830} r={12} />
      <Bush x={395} y={870} r={11} />
      <Bush x={235} y={870} r={10} />

      {[[175, 770], [310, 800], [430, 880]].map(([x, y], i) => (
        <g key={`fl2-${i}`}>
          <circle cx={x} cy={y} r="3.5" fill="#ff80a8" />
          <circle cx={x + 6} cy={y + 3} r="3" fill="#ffe048" />
          <circle cx={x - 5} cy={y + 4} r="3" fill="#fff0c0" />
          <circle cx={x + 2} cy={y - 5} r="2.5" fill="#ff9040" />
        </g>
      ))}

      {/* X marker */}
      <g transform="translate(380, 760)">
        <line x1="-7" y1="-7" x2="7" y2="7" stroke="#d83828" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="7" y1="-7" x2="-7" y2="7" stroke="#d83828" strokeWidth="3.5" strokeLinecap="round" />
      </g>

      {/* Big lake (now extends past the scene edges) */}
      <path
        d="M-60 930 Q-10 905 100 910 Q220 895 360 915 Q480 920 560 935 Q625 955 620 1005 Q610 1070 520 1095 Q380 1115 240 1110 Q100 1115 0 1095 Q-55 1065 -65 1010 Q-70 970 -60 930 Z"
        fill="url(#pk-lake)"
      />
      <path d="M50 935 Q200 925 480 945" stroke="white" strokeWidth="2" fill="none" opacity="0.5" />
      <ellipse cx="180" cy="1000" rx="60" ry="10" fill="white" opacity="0.3" />
      <ellipse cx="370" cy="1020" rx="44" ry="8" fill="white" opacity="0.26" />
      <ellipse cx="60" cy="1050" rx="32" ry="6" fill="white" opacity="0.24" />
      <ellipse cx="120" cy="975" rx="16" ry="3" fill="none" stroke="white" strokeWidth="1" opacity="0.5" />
      <ellipse cx="400" cy="985" rx="22" ry="4" fill="none" stroke="white" strokeWidth="1" opacity="0.5" />
      <ellipse cx="270" cy="1035" rx="20" ry="3.5" fill="none" stroke="white" strokeWidth="1" opacity="0.4" />
      <ellipse cx="500" cy="1010" rx="18" ry="3" fill="none" stroke="white" strokeWidth="1" opacity="0.4" />

      <Boat x={boatX} y={970} />

      {/* Dock */}
      <rect x="65" y="908" width="40" height="14" fill="#a06834" />
      <rect x="65" y="906" width="40" height="3" fill="#c08858" />
      <rect x="68" y="918" width="4" height="10" fill="#7a4824" />
      <rect x="100" y="918" width="4" height="10" fill="#7a4824" />

      {/* Lily pads (multiple clusters) */}
      <ellipse cx="410" cy="945" rx="9" ry="6" fill="#5a9a30" />
      <ellipse cx="425" cy="950" rx="6" ry="4" fill="#6ab040" />
      <ellipse cx="430" cy="940" rx="3" ry="2" fill="#f078a8" />
      <ellipse cx="180" cy="1075" rx="10" ry="6" fill="#5a9a30" />
      <ellipse cx="195" cy="1080" rx="7" ry="4" fill="#6ab040" />
      <ellipse cx="500" cy="1070" rx="9" ry="6" fill="#5a9a30" />
      <ellipse cx="515" cy="1075" rx="7" ry="4" fill="#6ab040" />
      <ellipse cx="520" cy="1066" rx="3" ry="2" fill="#fff0c0" />

      {/* Lake-edge trees + reeds */}
      <Pine x={30} y={905} h={42} />
      <Pine x={490} y={1010} h={36} />
      <Pine x={510} y={935} h={40} />
      {/* Reeds in shallow water */}
      {[450, 460, 470, 30, 40].map((rx, i) => (
        <g key={`lake-rd-${i}`}>
          <line x1={rx} y1={i < 3 ? 935 : 945} x2={rx} y2={i < 3 ? 922 : 932} stroke="#5a8828" strokeWidth="1.4" />
          <ellipse cx={rx} cy={i < 3 ? 921 : 931} rx="2" ry="4" fill="#4a7820" />
        </g>
      ))}

      {/* ══════════════════════════════════════════
          BLEED DECORATIONS  (outside viewBox 0..540 — visible when zoomed out)
      ══════════════════════════════════════════ */}

      {/* Left bleed — upper to lower */}
      <Pine x={-60} y={295} h={44} />
      <Pine x={-30} y={335} h={40} />
      <Mushroom x={-50} y={380} />
      <Wildflowers x={-20} y={420} />
      <Stump x={-40} y={465} />
      <Mushroom x={-65} y={500} color="#a878ff" />
      <Pine x={-50} y={545} h={42} />
      <Wildflowers x={-25} y={580} />
      <Pine x={-70} y={620} h={38} />
      <Mushroom x={-30} y={655} />
      <Stump x={-55} y={695} />
      <Wildflowers x={-20} y={730} />
      <Rock x={-40} y={760} w={22} />
      <Mushroom x={-65} y={795} color="#f0a020" />
      <Pine x={-50} y={835} h={46} />
      <Wildflowers x={-25} y={875} />
      <Mushroom x={-55} y={905} />

      {/* Right bleed — upper to lower */}
      <Pine x={595} y={285} h={44} />
      <Pine x={560} y={320} h={40} />
      <Mushroom x={575} y={365} />
      <Pine x={605} y={385} h={42} />
      <Wildflowers x={585} y={420} />
      <Stump x={570} y={460} />
      <Pine x={605} y={490} h={40} />
      <Mushroom x={580} y={520} color="#a878ff" />
      <Wildflowers x={610} y={555} />
      <Pine x={580} y={590} h={42} />
      <Stump x={605} y={625} />
      <Mushroom x={580} y={660} color="#f0a020" />
      <Wildflowers x={600} y={695} />
      <Pine x={580} y={735} h={44} />
      <Rock x={605} y={770} w={22} />
      <Wildflowers x={580} y={800} />
      <Mushroom x={605} y={830} />
      <Pine x={585} y={870} h={42} />
      <Stump x={605} y={905} />

      {/* Bottom bleed — beyond the lake (small grass strip with bushes) */}
      <Bush x={-30} y={1135} r={14} />
      <Wildflowers x={20} y={1145} />
      <Mushroom x={80} y={1140} />
      <Bush x={150} y={1145} r={12} />
      <Wildflowers x={220} y={1150} />
      <Pine x={310} y={1170} h={44} />
      <Wildflowers x={380} y={1145} />
      <Bush x={440} y={1150} r={13} />
      <Mushroom x={500} y={1145} color="#a878ff" />
      <Bush x={570} y={1140} r={14} />

      {/* Fireflies (night) */}
      {isNight && (
        <g>
          {[
            [180, 480], [220, 540], [280, 510], [340, 570], [400, 530],
            [240, 660], [320, 700], [180, 720], [380, 680],
          ].map(([fx, fy], i) => (
            <circle
              key={`fly-${i}`}
              cx={fx} cy={fy} r="2.2"
              fill="#fff080"
              className="pk-firefly"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          ))}
        </g>
      )}

      {/* Rain */}
      {weather === 'rain' && (
        <g>
          {Array.from({ length: 36 }, (_, i) => {
            const x = (i * 23) % SCENE_W;
            const delay = (i % 9) * 0.12;
            return (
              <line
                key={`r-${i}`}
                x1={x} y1="-30" x2={x - 6} y2="0"
                stroke="#c4dde8"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.65"
                className="pk-rain"
                style={{ animationDelay: `${delay}s` }}
              />
            );
          })}
        </g>
      )}

      {/* Tint overlay for dusk/night */}
      {overlayColor && (
        <rect x={-400} y={-400} width={SCENE_W + 800} height={SCENE_H + 800} fill={overlayColor} style={{ pointerEvents: 'none' }} />
      )}

      <style>{`
        .pk-fire-glow-1 { transform-origin: center; transform-box: fill-box; animation: pk-glow-1 2.6s ease-in-out infinite; }
        .pk-fire-glow-2 { transform-origin: center; transform-box: fill-box; animation: pk-glow-2 1.9s ease-in-out infinite; }
        .pk-fire-glow-3 { transform-origin: center; transform-box: fill-box; animation: pk-glow-3 1.5s ease-in-out infinite; }
        @keyframes pk-glow-1 { 0%,100%{opacity:0.08;transform:scale(1)} 50%{opacity:0.16;transform:scale(1.12)} }
        @keyframes pk-glow-2 { 0%,100%{opacity:0.16;transform:scale(1)} 50%{opacity:0.26;transform:scale(1.10)} }
        @keyframes pk-glow-3 { 0%,100%{opacity:0.24;transform:scale(1)} 50%{opacity:0.38;transform:scale(1.08)} }
        .pk-ember { transform-origin: center; transform-box: fill-box; opacity: 0; }
        .pk-ember-1 { animation: pk-ember-rise 3.6s linear infinite; }
        .pk-ember-2 { animation: pk-ember-rise 4.2s linear 0.9s infinite; }
        .pk-ember-3 { animation: pk-ember-rise 3.2s linear 1.8s infinite; }
        .pk-ember-4 { animation: pk-ember-rise 4.6s linear 2.6s infinite; }
        @keyframes pk-ember-rise {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.6); }
          15%  { opacity: 1; }
          70%  { opacity: 0.7; }
          100% { opacity: 0; transform: translate(var(--ex, 4px), -22px) scale(0.4); }
        }
        .pk-bfly-flap { transform-origin: center; transform-box: fill-box; animation: pk-bfly-flap 0.16s linear infinite alternate; }
        @keyframes pk-bfly-flap { from { transform: scaleX(1); } to { transform: scaleX(0.35); } }
        @keyframes pk-bfly-1 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(28px,-18px)} 50%{transform:translate(52px,4px)} 75%{transform:translate(22px,22px)} }
        @keyframes pk-bfly-2 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(-26px,-22px)} 66%{transform:translate(-44px,8px)} }
        @keyframes pk-bfly-3 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(18px,-28px)} 50%{transform:translate(40px,-8px)} 75%{transform:translate(28px,18px)} }
        @keyframes pk-bfly-4 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-28px,-24px)} }
        @keyframes pk-bfly-5 { 0%,100%{transform:translate(0,0)} 25%{transform:translate(14px,-14px)} 50%{transform:translate(32px,12px)} 75%{transform:translate(8px,26px)} }
        @keyframes pk-bfly-6 { 0%,100%{transform:translate(0,0)} 33%{transform:translate(22px,16px)} 66%{transform:translate(-12px,28px)} }
        .pk-twinkle { animation: pk-twinkle 2.2s ease-in-out infinite; }
        @keyframes pk-twinkle { 0%,100%{opacity:0.6} 50%{opacity:1} }
        .pk-firefly { animation: pk-firefly 2.2s ease-in-out infinite; }
        @keyframes pk-firefly { 0%,100%{opacity:0.15;transform:translate(0,0) scale(0.9)} 50%{opacity:1;transform:translate(6px,-4px) scale(1.2)} }
        .pk-rain { animation: pk-rain-drop 0.95s linear infinite; }
        @keyframes pk-rain-drop { 0%{transform:translate(0,0);opacity:0.6} 100%{transform:translate(60px,1100px);opacity:0} }
        .pk-spark { animation: pk-spark-rise 0.7s ease-out forwards; }
        @keyframes pk-spark-rise { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-24px) scale(0.3)} }
        .pk-sun-rays { animation: pk-sun-spin 36s linear infinite; }
        @keyframes pk-sun-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </svg>
  );
}

// ╔══════════════════════════════════════════════════════════════════════════╗
//   Animal sprite + speech
// ╚══════════════════════════════════════════════════════════════════════════╝

function AnimalSprite({ sprite }: { sprite: Sprite }) {
  const size = ANIMAL_SIZE;
  const isWalking = sprite.action === 'walking' && !sprite.isDragging;
  const isFight = sprite.action === 'fight';
  const flipX = sprite.facing === 'right' ? -1 : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: sprite.x - size / 2,
        top: sprite.y - size,
        width: size,
        height: size,
        zIndex: sprite.isDragging ? 99999 : Math.round(sprite.y),
        transition: sprite.isDragging ? 'none' : 'left 0.65s linear, top 0.65s linear',
        pointerEvents: 'none',
        filter: sprite.isDragging
          ? 'drop-shadow(0 14px 8px rgba(0,0,0,0.3))'
          : 'drop-shadow(0 3px 3px rgba(0,40,0,0.3))',
        transform: sprite.isDragging ? 'scale(1.08)' : 'none',
        transformOrigin: 'center',
      }}
    >
      {sprite.speech && (
        <div
          style={{
            position: 'absolute',
            top: -8,
            left: '50%',
            transform: 'translateX(-50%) translateY(-100%)',
            background: 'white',
            padding: '5px 11px',
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 600,
            color: '#2a3850',
            whiteSpace: 'nowrap',
            boxShadow: '0 3px 10px rgba(0,40,20,0.22)',
            pointerEvents: 'none',
            animation: 'pk-speech-in 0.35s cubic-bezier(0.2,1.4,0.4,1)',
          }}
        >
          {sprite.speech.text}
          <span
            style={{
              position: 'absolute',
              bottom: -4,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 9,
              height: 9,
              background: 'white',
              boxShadow: '2px 2px 4px rgba(0,40,20,0.12)',
            }}
          />
        </div>
      )}
      <div style={{ transform: `scaleX(${flipX})`, transformOrigin: 'center' }}>
        <div style={{ animation: isWalking ? 'pk-walk 0.5s ease-in-out infinite' : isFight ? 'pk-shake 0.28s ease-in-out infinite' : 'none' }}>
          <Character id={sprite.charId as any} mood={sprite.action === 'friendly' ? 'happy' : 'idle'} size={size} static />
        </div>
      </div>
    </div>
  );
}

// ╔══════════════════════════════════════════════════════════════════════════╗
//   Interaction & scene FX layers
// ╚══════════════════════════════════════════════════════════════════════════╝

const FX_ITEMS: Record<string, string[]> = {
  friendly: ['💛', '💚', '🧡', '💛'],
  fight:    ['✨', '💥', '⭐', '✨'],
  'tap-heart': ['❤️', '💕', '❤️'],
};

function InteractionFx({ fx }: { fx: Fx }) {
  return (
    <div style={{ position: 'absolute', left: fx.x, top: fx.y, pointerEvents: 'none', zIndex: 9999 }}>
      {FX_ITEMS[fx.kind].map((item, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            fontSize: fx.kind === 'tap-heart' ? 18 : 22,
            left: (i - (FX_ITEMS[fx.kind].length - 1) / 2) * 22,
            transform: 'translate(-50%, -50%)',
            animationDelay: `${i * 0.09}s`,
            animation: 'pk-fx-rise 1.7s ease-out forwards',
            opacity: 0,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function SceneFxLayer({ sceneFx }: { sceneFx: SceneFx[] }) {
  return (
    <svg
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      width={SCENE_W}
      height={SCENE_H}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
      aria-hidden
    >
      {sceneFx.map(fx => {
        if (fx.kind === 'bird') return <Bird key={fx.uid} x={fx.x} y={fx.y} />;
        if (fx.kind === 'ripple') return <Ripple key={fx.uid} x={fx.x} y={fx.y} />;
        if (fx.kind === 'fish') return <FishJump key={fx.uid} x={fx.x} y={fx.y} />;
        if (fx.kind === 'dig') return <DigFx key={fx.uid} x={fx.x} y={fx.y} />;
        return null;
      })}
      <style>{`
        .pk-bird { animation: pk-bird-fly 3.4s cubic-bezier(0.3, 0.5, 0.6, 1) forwards; }
        @keyframes pk-bird-fly {
          0%   { transform: translate(var(--bx, 0px), var(--by, 0px)) translate(0, 0) scale(0.7); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translate(var(--bx, 0px), var(--by, 0px)) translate(-200px, -260px) scale(0.4); opacity: 0; }
        }
        .pk-bird-flap { animation: pk-bird-flap 0.22s ease-in-out infinite alternate; transform-origin: center; }
        @keyframes pk-bird-flap { 0%{transform:scaleY(1)} 100%{transform:scaleY(0.4)} }

        .pk-ripple { animation: pk-ripple-grow 1.8s ease-out forwards; }
        @keyframes pk-ripple-grow { 0%{r:6;opacity:0.8} 100%{r:48;opacity:0} }

        .pk-fish-arc { animation: pk-fish-arc 1s ease-out forwards; }
        @keyframes pk-fish-arc {
          0%   { transform: translate(0, 14px) rotate(-20deg); opacity: 1; }
          35%  { transform: translate(8px, -20px) rotate(20deg); opacity: 1; }
          70%  { transform: translate(16px, -8px) rotate(60deg); opacity: 1; }
          100% { transform: translate(20px, 14px) rotate(90deg); opacity: 0; }
        }
        .pk-fish-splash { animation: pk-fish-splash 1s ease-out forwards; }
        @keyframes pk-fish-splash { 0%{opacity:0.8;transform:scale(0.4)} 60%{opacity:0.7;transform:scale(1.2)} 100%{opacity:0;transform:scale(0.4)} }
      `}</style>
    </svg>
  );
}

// ╔══════════════════════════════════════════════════════════════════════════╗
//   Zoom / pan
// ╚══════════════════════════════════════════════════════════════════════════╝

function clampTransform(tx: number, ty: number, zoom: number, cw: number, ch: number): Transform {
  const sw = SCENE_W * zoom, sh = SCENE_H * zoom;
  const m = 0.22;
  return {
    tx: Math.max(-(sw * (1 + m) - cw), Math.min(sw * m, tx)),
    ty: Math.max(-(sh * (1 + m) - ch), Math.min(sh * m, ty)),
    zoom,
  };
}

function computeFit(cw: number, ch: number): Transform {
  const fz = Math.max(cw / SCENE_W, ch / SCENE_H);
  const tx = (cw - SCENE_W * fz) / 2;
  const ty = (ch - SCENE_H * fz) / 2;
  return { tx, ty, zoom: fz };
}

// ╔══════════════════════════════════════════════════════════════════════════╗
//   Main page
// ╚══════════════════════════════════════════════════════════════════════════╝

export default function Park() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const initTransform = useMemo(
    () => computeFit(window.innerWidth, window.innerHeight),
    [],
  );
  const transformRef = useRef<Transform>(initTransform);
  const [transform, setTransformState] = useState<Transform>(initTransform);
  const [btnTransition, setBtnTransition] = useState(false);

  const updateTransform = useCallback((t: Transform) => {
    transformRef.current = t;
    setTransformState(t);
  }, []);

  const fitTransform = useCallback(() => computeFit(window.innerWidth, window.innerHeight), []);

  // Resize listener
  useEffect(() => {
    const onResize = () => updateTransform(computeFit(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateTransform]);

  // ── Animal state ──────────────────────────────────────────────────────────
  const { unlockedIds, companionId } = useMemo(() => ({
    unlockedIds: getUnlockedIds('a-kiwi'),
    companionId: getCompanionId(),
  }), []);

  const [sprites, setSprites] = useState<Sprite[]>(() => initSprites(unlockedIds, companionId));
  const spritesRef = useRef(sprites);
  useEffect(() => { spritesRef.current = sprites; }, [sprites]);

  const [fxList, setFxList] = useState<Fx[]>([]);
  const [sceneFxList, setSceneFxList] = useState<SceneFx[]>([]);

  // Day/night and weather
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(() => getTimeOfDay());
  const [weather, setWeather] = useState<Weather>('sunny');
  const weatherRef = useRef(weather);
  useEffect(() => { weatherRef.current = weather; }, [weather]);

  // Scene element states
  const [cabinLit, setCabinLit] = useState<{ top: boolean; mid: boolean }>({ top: false, mid: false });
  const [boatX, setBoatX] = useState(290);
  const [fireBurstAt, setFireBurstAt] = useState<number | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const addFx = useCallback((kind: Fx['kind'], x: number, y: number) => {
    const uid = `fx-${Date.now()}-${Math.random()}`;
    setFxList(prev => [...prev, { uid, kind, x, y }]);
    setTimeout(() => setFxList(prev => prev.filter(f => f.uid !== uid)), 2200);
  }, []);

  const addSceneFx = useCallback((kind: SceneFx['kind'], x: number, y: number, duration: number) => {
    const uid = `sfx-${Date.now()}-${Math.random()}`;
    setSceneFxList(prev => [...prev, { uid, kind, x, y, expiresAt: Date.now() + duration }]);
    setTimeout(() => setSceneFxList(prev => prev.filter(f => f.uid !== uid)), duration + 50);
  }, []);

  const setSpeech = useCallback((animalId: string, text: string, durationMs = 3200) => {
    setSprites(prev => prev.map(sp =>
      sp.id === animalId
        ? { ...sp, speech: { text, expiresAt: Date.now() + durationMs } }
        : sp,
    ));
  }, []);

  // ── Tap on animal ─────────────────────────────────────────────────────────
  const handleAnimalTap = useCallback((sprite: Sprite) => {
    setSpeech(sprite.id, pickRandom(TAP_LINES));
    addFx('tap-heart', sprite.x, sprite.y - ANIMAL_SIZE);
    // briefly pause
    setSprites(prev => prev.map(sp =>
      sp.id === sprite.id ? { ...sp, action: 'idle', timer: 3 } : sp,
    ));
  }, [setSpeech, addFx]);

  // ── Scene tap ─────────────────────────────────────────────────────────────
  const handleSceneTap = useCallback((target: TapTarget, x: number, y: number) => {
    switch (target.kind) {
      case 'tree': {
        if (Math.random() < 0.45) addSceneFx('bird', x, y - 10, 3400);
        break;
      }
      case 'campfire': {
        setFireBurstAt(Date.now() + 700);
        setTimeout(() => setFireBurstAt(null), 750);
        break;
      }
      case 'cabin_top':
      case 'cabin_mid': {
        const k = target.kind === 'cabin_top' ? 'top' : 'mid';
        setCabinLit(prev => ({ ...prev, [k]: true }));
        setTimeout(() => setCabinLit(prev => ({ ...prev, [k]: false })), 1800);
        break;
      }
      case 'boat': {
        const newX = boatX > 320 ? 290 : 370;
        setBoatX(newX);
        break;
      }
      case 'lake':
      case 'small_lake': {
        addSceneFx('ripple', x, y, 1900);
        break;
      }
      case 'river': {
        addSceneFx('fish', x, y, 1100);
        break;
      }
      case 'x_marker': {
        addSceneFx('dig', 380, 760, 2200);
        // Random animal nearby reacts
        const nearby = spritesRef.current.find(sp => Math.hypot(sp.x - 380, sp.y - 760) < 120);
        if (nearby) setSpeech(nearby.id, '叮~挖到一颗小石头！', 3200);
        break;
      }
    }
  }, [addSceneFx, boatX, setSpeech]);

  // ── Touch routing ─────────────────────────────────────────────────────────
  const touchRef = useRef({
    type: 'none' as 'none' | 'pan' | 'pinch' | 'animal-tap' | 'animal-drag',
    startT: { tx: 0, ty: 0, zoom: 1 },
    p1: { x: 0, y: 0 },
    startDist: 0,
    startMid: { x: 0, y: 0 },
    tapStart: { time: 0, x: 0, y: 0 },
    lastTapTime: 0,
    moved: false,
    dragAnimalId: '',
    dragStartCtx: null as string | null,
    dragStartAction: 'walking' as Action,
  });

  const toScene = (clientX: number, clientY: number) => {
    const { tx, ty, zoom } = transformRef.current;
    return { sceneX: (clientX - tx) / zoom, sceneY: (clientY - ty) / zoom };
  };

  const doReset = useCallback(() => {
    setBtnTransition(true);
    updateTransform(fitTransform());
    setTimeout(() => setBtnTransition(false), 320);
  }, [fitTransform, updateTransform]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const tr = touchRef.current;
    tr.startT = { ...transformRef.current };
    tr.moved = false;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      tr.p1 = { x: t.clientX, y: t.clientY };
      tr.tapStart = { time: Date.now(), x: t.clientX, y: t.clientY };
      // Hit-test animal
      const { sceneX, sceneY } = toScene(t.clientX, t.clientY);
      const hit = hitTestAnimal(spritesRef.current, sceneX, sceneY);
      if (hit) {
        tr.type = 'animal-tap';
        tr.dragAnimalId = hit.id;
        tr.dragStartCtx = nearbyTarget(hit.x, hit.y);
        tr.dragStartAction = hit.action;
      } else {
        tr.type = 'pan';
      }
    } else if (e.touches.length >= 2) {
      const t1 = e.touches[0], t2 = e.touches[1];
      tr.type = 'pinch';
      tr.p1 = { x: t1.clientX, y: t1.clientY };
      tr.startDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      tr.startMid = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const tr = touchRef.current;
    const cw = window.innerWidth, ch = window.innerHeight;
    const { startT, p1, startDist, startMid } = tr;

    if ((tr.type === 'animal-tap' || tr.type === 'animal-drag') && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - p1.x;
      const dy = t.clientY - p1.y;
      // Upgrade to drag once finger moves enough
      if (tr.type === 'animal-tap' && Math.hypot(dx, dy) > 8) {
        tr.type = 'animal-drag';
        // Mark sprite as dragging
        setSprites(prev => prev.map(sp =>
          sp.id === tr.dragAnimalId ? { ...sp, isDragging: true, action: 'dragged', speech: undefined } : sp,
        ));
      }
      if (tr.type === 'animal-drag') {
        const { sceneX, sceneY } = toScene(t.clientX, t.clientY);
        setSprites(prev => prev.map(sp =>
          sp.id === tr.dragAnimalId ? { ...sp, x: sceneX, y: sceneY } : sp,
        ));
        tr.moved = true;
      }
    } else if (tr.type === 'pan' && e.touches.length === 1) {
      const dx = e.touches[0].clientX - p1.x;
      const dy = e.touches[0].clientY - p1.y;
      if (Math.hypot(dx, dy) > 6) tr.moved = true;
      updateTransform(clampTransform(startT.tx + dx, startT.ty + dy, startT.zoom, cw, ch));
    } else if (tr.type === 'pinch' && e.touches.length >= 2) {
      tr.moved = true;
      const t1 = e.touches[0], t2 = e.touches[1];
      const curDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const curMid = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, startT.zoom * (curDist / startDist)));
      const ratio = newZoom / startT.zoom;
      const newTx = startMid.x - ratio * (startMid.x - startT.tx) + (curMid.x - startMid.x);
      const newTy = startMid.y - ratio * (startMid.y - startT.ty) + (curMid.y - startMid.y);
      updateTransform(clampTransform(newTx, newTy, newZoom, cw, ch));
    }
  }, [updateTransform]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const tr = touchRef.current;
    const wasType = tr.type;
    tr.type = 'none';

    if (wasType === 'animal-tap' && e.changedTouches.length === 1) {
      // Tap on animal
      const sprite = spritesRef.current.find(sp => sp.id === tr.dragAnimalId);
      if (sprite) handleAnimalTap(sprite);
      return;
    }
    if (wasType === 'animal-drag' && e.changedTouches.length === 1) {
      // Drop animal — pick mood line
      const sprite = spritesRef.current.find(sp => sp.id === tr.dragAnimalId);
      if (sprite) {
        const endCtx = nearbyTarget(sprite.x, sprite.y);
        const line = pickDragLine(tr.dragStartCtx, endCtx, tr.dragStartAction, weatherRef.current);
        setSpeech(sprite.id, line, 3800);
        // give it a fresh target, clear dragging
        const newZone: Zone =
          sprite.y < 380 ? 'upper' : sprite.y > 720 ? 'lower' : 'middle';
        const { tx, ty } = pickTarget(newZone, sprite.x, sprite.y);
        setSprites(prev => prev.map(sp =>
          sp.id === sprite.id
            ? { ...sp, isDragging: false, action: 'idle', timer: 4, zone: newZone, targetX: tx, targetY: ty }
            : sp,
        ));
      }
      return;
    }
    if (wasType === 'pan' && !tr.moved && e.changedTouches.length === 1) {
      // It was a tap on empty/scene area
      const ct = e.changedTouches[0];
      const elapsed = Date.now() - tr.tapStart.time;
      const dx = ct.clientX - tr.tapStart.x;
      const dy = ct.clientY - tr.tapStart.y;
      if (elapsed < 280 && Math.hypot(dx, dy) < 12) {
        // First check double-tap → reset
        const now = Date.now();
        if (now - tr.lastTapTime < 350) {
          doReset();
          tr.lastTapTime = 0;
          return;
        }
        tr.lastTapTime = now;
        // Hit-test scene
        const { sceneX, sceneY } = toScene(ct.clientX, ct.clientY);
        const target = hitTargetAt(SCENE_TARGETS, sceneX, sceneY);
        if (target) handleSceneTap(target, sceneX, sceneY);
      }
    }
  }, [doReset, handleAnimalTap, handleSceneTap, setSpeech]);

  const handleZoom = useCallback((delta: number) => {
    const cw = window.innerWidth, ch = window.innerHeight;
    const { tx, ty, zoom } = transformRef.current;
    const cx = cw / 2, cy = ch / 2;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * delta));
    const ratio = newZoom / zoom;
    setBtnTransition(true);
    updateTransform(clampTransform(cx - ratio * (cx - tx), cy - ratio * (cy - ty), newZoom, cw, ch));
    setTimeout(() => setBtnTransition(false), 320);
  }, [updateTransform]);

  // ── AI tick ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setSprites(prev => {
        const { sprites: next, newFx } = doTick(prev);
        if (newFx.length > 0) {
          setFxList(fx => [...fx, ...newFx]);
          newFx.forEach(f => setTimeout(() => setFxList(fx => fx.filter(x => x.uid !== f.uid)), 2200));
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  // ── Speech tick ───────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setSprites(prev => {
        const cleaned = prev.map(sp =>
          sp.speech && sp.speech.expiresAt < now ? { ...sp, speech: undefined } : sp,
        );
        if (Math.random() < 0.5) {
          const eligible = cleaned.filter(sp => !sp.speech && !sp.isDragging);
          if (eligible.length > 0) {
            const chosen = pickRandom(eligible);
            // Pick from weather/time-aware pool
            let pool: string[] = SPEECH_LINES;
            if (weatherRef.current === 'rain' && Math.random() < 0.35) pool = RAIN_LINES;
            else if (timeOfDay === 'night' && Math.random() < 0.3) pool = NIGHT_LINES;
            const line = pickRandom(pool);
            return cleaned.map(sp =>
              sp.id === chosen.id
                ? { ...sp, speech: { text: line, expiresAt: now + 3400 } }
                : sp,
            );
          }
        }
        return cleaned;
      });
    }, 2200);
    return () => clearInterval(interval);
  }, [timeOfDay]);

  // ── Time of day tick ──────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setTimeOfDay(getTimeOfDay()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // ── Weather tick ──────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setWeather(pickWeather());
    }, 90_000);
    return () => clearInterval(interval);
  }, []);

  const sortedSprites = useMemo(
    () => [...sprites].sort((a, b) => a.y - b.y),
    [sprites],
  );

  const { tx, ty, zoom } = transform;

  return (
    <div
      ref={containerRef}
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#88c440', touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <div
        style={{
          position: 'absolute',
          width: SCENE_W,
          height: SCENE_H,
          transformOrigin: '0 0',
          transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
          transition: btnTransition ? 'transform 0.3s ease-out' : 'none',
        }}
      >
        <ParkSceneSVG
          timeOfDay={timeOfDay}
          weather={weather}
          cabinLit={cabinLit}
          boatX={boatX}
          fireBurstAt={fireBurstAt}
        />
        <SceneFxLayer sceneFx={sceneFxList} />
        {sortedSprites.map(sp => <AnimalSprite key={sp.id} sprite={sp} />)}
        {fxList.map(fx => <InteractionFx key={fx.uid} fx={fx} />)}
      </div>

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', left: 16,
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
          border: 'none', borderRadius: 999, padding: '8px 16px',
          fontSize: 14, fontWeight: 600, color: '#1a2638',
          cursor: 'pointer', zIndex: 50, boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        }}
      >
        ← 返回
      </button>

      {/* Title chip with time/weather indicator */}
      <div
        style={{
          position: 'absolute', top: 'max(16px, env(safe-area-inset-top))',
          left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
          borderRadius: 999, padding: '8px 16px',
          fontSize: 13, fontWeight: 700, color: '#1a2638',
          zIndex: 50, boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <span>🏕️ 探险公园</span>
        <span style={{ opacity: 0.5, fontSize: 11 }}>·</span>
        <span style={{ fontSize: 14 }}>
          {timeOfDay === 'dawn' ? '🌄' : timeOfDay === 'day' ? '☀️' : timeOfDay === 'dusk' ? '🌇' : '🌙'}
        </span>
        {weather !== 'sunny' && (
          <span style={{ fontSize: 14 }}>{weather === 'cloudy' ? '☁️' : '🌧️'}</span>
        )}
      </div>

      {/* Zoom buttons */}
      <div style={{ position: 'absolute', bottom: 'max(32px, env(safe-area-inset-bottom, 16px))', right: 20, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 50 }}>
        {[{ label: '+', delta: 1.35 }, { label: '−', delta: 1 / 1.35 }].map(({ label, delta }) => (
          <button
            key={label}
            onClick={() => handleZoom(delta)}
            style={{
              width: 44, height: 44, borderRadius: 999,
              background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
              border: 'none', fontSize: 22, fontWeight: 300, color: '#1a2638',
              cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Info chip + reset */}
      <button
        onClick={doReset}
        style={{
          position: 'absolute',
          bottom: 'max(32px, env(safe-area-inset-bottom, 16px))',
          left: 20,
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(8px)',
          border: 'none', borderRadius: 999, padding: '7px 14px',
          fontSize: 13, fontWeight: 600, color: '#1a2638',
          zIndex: 50, boxShadow: '0 2px 12px rgba(0,0,0,0.16)',
          cursor: 'pointer',
        }}
      >
        {sprites.length} 只小伙伴 · 还原
      </button>

      <style>{`
        @keyframes pk-walk  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes pk-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px) rotate(-4deg)} 75%{transform:translateX(5px) rotate(4deg)} }
        @keyframes pk-fx-rise {
          0%  {opacity:0;transform:translate(-50%,-50%) scale(0.4)}
          15% {opacity:1;transform:translate(-50%,-50%) scale(1.1)}
          70% {opacity:1;transform:translate(-50%,-80%) scale(1)}
          100%{opacity:0;transform:translate(-50%,-120%) scale(0.8)}
        }
        @keyframes pk-speech-in {
          0%   {opacity:0;transform:translateX(-50%) translateY(-100%) scale(0.6)}
          70%  {opacity:1;transform:translateX(-50%) translateY(-104%) scale(1.06)}
          100% {opacity:1;transform:translateX(-50%) translateY(-100%) scale(1)}
        }
      `}</style>
    </div>
  );
}
