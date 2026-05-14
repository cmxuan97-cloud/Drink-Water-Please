import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ANIMALS } from '../data/animals';
import { getCompanionId, getUnlockedIds } from '../lib/storage';
import Character from '../components/Character';

// ── Scene (mobile portrait ratio) ──────────────────────────────────────────
const SCENE_W = 540;
const SCENE_H = 1080;

const TICK_MS = 650;
const ANIMAL_SIZE = 58;
const INTERACT_DIST = 64;
const MAX_ANIMALS = 6;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;

// ── Zones (top-down regions of grass) ──────────────────────────────────────
type Zone = 'upper' | 'middle' | 'lower';
type Action = 'walking' | 'idle' | 'friendly' | 'fight';

const ZONE_CONFIG: Record<Zone, { minX: number; maxX: number; minY: number; maxY: number }> = {
  upper:  { minX: 110, maxX: 430, minY: 215, maxY: 320 },
  middle: { minX: 80,  maxX: 460, minY: 500, maxY: 680 },
  lower:  { minX: 100, maxX: 440, minY: 760, maxY: 870 },
};

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
};

const SPEECH_LINES = [
  '好渴啊…想喝水',
  '今天天气真好',
  '宝藏到底在哪里？',
  '蝴蝶蝴蝶~',
  '走累了，歇会儿',
  '我闻到饼干味了',
  '你看到我的尾巴了吗？',
  '嗨~',
  '好困哦 zzz',
  '刚才那只好凶！',
  '山好高啊',
  '我今天好开心',
  '肚子咕咕叫',
  '想去看湖',
  '咦，是月亮？',
  '鱼鱼鱼！',
  '想吃西瓜',
  '主人在干嘛',
  '公园真大',
  '想跟你聊天',
];

type Fx = {
  uid: string;
  x: number;
  y: number;
  kind: 'friendly' | 'fight';
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));

function pickTarget(zone: Zone, cx: number, cy: number): { tx: number; ty: number } {
  const { minX, maxX, minY, maxY } = ZONE_CONFIG[zone];
  for (let i = 0; i < 8; i++) {
    const tx = rand(minX, maxX);
    const ty = rand(minY, maxY);
    if (Math.hypot(tx - cx, ty - cy) >= 30) return { tx, ty };
  }
  return { tx: rand(minX, maxX), ty: rand(minY, maxY) };
}

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
    if (sp.action !== 'walking') return sp;
    const dx = sp.targetX - sp.x;
    const dy = sp.targetY - sp.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) {
      // Pick new target. Sometimes switch zones — but DON'T teleport.
      // Just pick a target in the new zone and walk there naturally.
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

  // 3. Check new interactions
  const free = s.filter(sp => sp.action === 'walking' || sp.action === 'idle');
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

// ── Reusable SVG pieces ────────────────────────────────────────────────────
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

function Cabin({ x, y, w = 64 }: { x: number; y: number; w?: number }) {
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
      <rect x={x + w * 0.1} y={y - h * 0.75} width={w * 0.22} height={h * 0.22} fill="#a8d8e0" stroke="#5a3a20" strokeWidth="1.5" rx="1" />
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

function Campfire({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 4} rx={22} ry={5} fill="#1a3008" opacity="0.3" />
      <rect x={x - 20} y={y - 2} width="40" height="7" rx="2.5" fill="#5a3818" transform={`rotate(-12 ${x} ${y})`} />
      <rect x={x - 18} y={y - 2} width="36" height="6" rx="2.5" fill="#7a4828" transform={`rotate(14 ${x} ${y})`} />
      <path d={`M${x - 9} ${y - 4} Q${x - 14} ${y - 22} ${x - 5} ${y - 26} Q${x - 2} ${y - 16} ${x} ${y - 30} Q${x + 4} ${y - 18} ${x + 8} ${y - 24} Q${x + 13} ${y - 14} ${x + 9} ${y - 4} Z`} fill="#f47020" className="pk-flame" />
      <path d={`M${x - 5} ${y - 4} Q${x - 7} ${y - 17} ${x - 2} ${y - 20} Q${x} ${y - 12} ${x + 2} ${y - 22} Q${x + 5} ${y - 16} ${x + 7} ${y - 18} Q${x + 7} ${y - 9} ${x + 5} ${y - 4} Z`} fill="#f8d040" className="pk-flame" />
    </g>
  );
}

function Boat({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x + 18} cy={y + 14} rx={26} ry={3.5} fill="#1a3030" opacity="0.35" />
      <path d={`M${x} ${y + 8} L${x + 36} ${y + 8} L${x + 31} ${y + 16} L${x + 5} ${y + 16} Z`} fill="#a06030" />
      <rect x={x + 5} y={y + 6} width="26" height="3" rx="1" fill="#b87040" />
      <line x1={x + 18} y1={y + 6} x2={x + 18} y2={y - 14} stroke="#5a3a20" strokeWidth="1.8" />
      <polygon points={`${x + 18},${y - 14} ${x + 18},${y - 2} ${x + 32},${y - 8}`} fill="#d83828" />
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

// ── Park scene (full map) ──────────────────────────────────────────────────
function ParkSceneSVG() {
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
          <stop offset="0%" stopColor="#a8d850" />
          <stop offset="40%" stopColor="#88c440" />
          <stop offset="100%" stopColor="#6cab30" />
        </linearGradient>
        <linearGradient id="pk-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7adcf0" />
          <stop offset="100%" stopColor="#3eaad4" />
        </linearGradient>
        <linearGradient id="pk-river" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6ad0e8" />
          <stop offset="50%" stopColor="#8eddf0" />
          <stop offset="100%" stopColor="#6ad0e8" />
        </linearGradient>
        <linearGradient id="pk-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cae9f6" />
          <stop offset="100%" stopColor="#a8d850" />
        </linearGradient>
      </defs>

      {/* Extended grass (bleeds beyond scene edges so screen never shows frame) */}
      <rect x={-400} y={-400} width={SCENE_W + 800} height={SCENE_H + 800} fill="url(#pk-grass)" />

      {/* Extended sky at top */}
      <rect x={-400} y={-400} width={SCENE_W + 800} height={570} fill="url(#pk-sky)" />

      {/* ══════════════════════════════════════════
          TOP — MOUNTAINS (drawn BEFORE pines so trees overlap them)
      ══════════════════════════════════════════ */}
      <Mountain x={120} y={175} w={140} h={130} />
      <Mountain x={280} y={175} w={180} h={170} />
      <Mountain x={430} y={175} w={150} h={140} />
      {/* Extra side mountains so edges look natural */}
      <Mountain x={-20} y={175} w={120} h={110} />
      <Mountain x={560} y={175} w={130} h={120} />

      {/* Pine forest line — in front of mountains, extends past the edges */}
      {[-30, 20, 70, 120, 170, 220, 270, 320, 370, 420, 470, 510, 560, 600].map((x, i) => (
        <Pine key={`tp-${i}`} x={x} y={208} h={44 + (i % 3) * 10} />
      ))}

      {/* Grass tufts/details upper meadow */}
      {[
        [80, 230], [165, 250], [240, 230], [330, 245], [410, 235], [470, 260],
        [100, 280], [195, 280], [280, 290], [365, 280], [445, 290],
      ].map(([x, y], i) => (
        <ellipse key={`gt-${i}`} cx={x} cy={y} rx="14" ry="4" fill="#6cab30" opacity="0.55" />
      ))}

      {/* Small flowers in upper meadow */}
      {[[140, 245], [350, 260], [220, 305], [400, 300]].map(([x, y], i) => (
        <g key={`fl-${i}`}>
          <circle cx={x} cy={y} r="3" fill="#ff80a8" />
          <circle cx={x + 5} cy={y + 2} r="2.5" fill="#ffe048" />
          <circle cx={x - 4} cy={y + 3} r="2.5" fill="#fff0c0" />
        </g>
      ))}

      {/* ══════════════════════════════════════════
          UPPER — SMALL LAKE + CABIN
      ══════════════════════════════════════════ */}

      {/* Small lake (top-left) */}
      <g>
        <path d="M40 340 Q60 320 110 325 Q170 320 195 340 Q210 360 195 380 Q170 400 110 395 Q55 395 35 375 Q25 358 40 340 Z" fill="url(#pk-lake)" />
        <path d="M70 345 Q120 340 175 355" stroke="white" strokeWidth="1.5" fill="none" opacity="0.55" />
        <ellipse cx="100" cy="375" rx="22" ry="5" fill="white" opacity="0.3" />
      </g>

      {/* Reeds around small lake */}
      {[180, 190, 200, 210, 35, 45, 55].map((x, i) => (
        <g key={`rd-${i}`}>
          <line x1={x} y1={i < 4 ? 348 : 345} x2={x} y2={i < 4 ? 332 : 328} stroke="#5a8828" strokeWidth="1.5" />
          <ellipse cx={x} cy={i < 4 ? 328 : 325} rx="2.5" ry="5" fill="#4a7820" />
        </g>
      ))}

      {/* Cabin upper right */}
      <Cabin x={365} y={400} w={70} />
      <Pine x={340} y={395} h={45} />
      <Pine x={465} y={395} h={42} />

      {/* Pine forest scattered upper */}
      <Pine x={50} y={410} h={48} />
      <Pine x={250} y={345} h={36} />
      <Pine x={310} y={345} h={32} />

      {/* Rocks upper */}
      <Rock x={80} y={415} w={28} />
      <Rock x={220} y={355} w={22} />
      <Rock x={490} y={395} w={26} />

      {/* ══════════════════════════════════════════
          RIVER — winding from upper lake to bottom lake
      ══════════════════════════════════════════ */}
      <path
        d="M155 395 Q145 430 130 460 Q115 500 95 545 Q80 600 95 660 Q115 720 100 780 Q85 845 130 905"
        stroke="#5fc8e0"
        strokeWidth="40"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M155 395 Q145 430 130 460 Q115 500 95 545 Q80 600 95 660 Q115 720 100 780 Q85 845 130 905"
        stroke="#a4e2f0"
        strokeWidth="18"
        fill="none"
        strokeLinecap="round"
        opacity="0.65"
      />
      {/* River sparkles */}
      <ellipse cx="118" cy="490" rx="6" ry="2" fill="white" opacity="0.7" />
      <ellipse cx="98" cy="600" rx="5" ry="2" fill="white" opacity="0.65" />
      <ellipse cx="110" cy="740" rx="6" ry="2" fill="white" opacity="0.7" />
      <ellipse cx="92" cy="820" rx="5" ry="2" fill="white" opacity="0.6" />

      {/* ══════════════════════════════════════════
          MIDDLE — CAMPFIRE + TENTS + CABIN
      ══════════════════════════════════════════ */}

      {/* Open meadow background (slightly lighter) */}
      <ellipse cx="295" cy="600" rx="220" ry="135" fill="#b0e060" opacity="0.4" />

      {/* Path / dirt circle around campfire */}
      <ellipse cx="270" cy="610" rx="60" ry="40" fill="#d4b070" opacity="0.55" />

      {/* Campfire at center of middle area */}
      <Campfire x={270} y={620} />

      {/* Tents */}
      <Tent x={340} y={605} h={52} />
      <Tent x={385} y={610} h={45} color="#e8d0a4" />

      {/* Big cabin right */}
      <Cabin x={400} y={530} w={66} />

      {/* Pine cluster around middle area */}
      <Pine x={210} y={555} h={48} />
      <Pine x={185} y={595} h={42} />
      <Pine x={195} y={655} h={50} />
      <Pine x={355} y={555} h={36} />
      <Pine x={470} y={560} h={42} />
      <Pine x={490} y={610} h={38} />
      <Pine x={235} y={690} h={44} />
      <Pine x={460} y={680} h={42} />

      {/* Decorative bushes */}
      <Bush x={310} y={560} r={11} />
      <Bush x={420} y={690} r={13} />
      <Bush x={170} y={520} r={12} />

      {/* Logs near campfire */}
      <rect x="220" y="650" width="30" height="6" rx="3" fill="#7a4a28" />
      <rect x="300" y="655" width="28" height="6" rx="3" fill="#7a4a28" transform="rotate(8 314 658)" />

      {/* Small rocks */}
      <Rock x={150} y={730} w={24} />
      <Rock x={395} y={720} w={20} />

      {/* ══════════════════════════════════════════
          LOWER — FOREST + MEADOW
      ══════════════════════════════════════════ */}

      <Pine x={50} y={870} h={56} />
      <Pine x={130} y={750} h={42} />
      <Pine x={155} y={710} h={36} />
      <Pine x={465} y={810} h={50} />
      <Pine x={495} y={850} h={46} />
      <Pine x={420} y={760} h={40} />
      <Pine x={295} y={770} h={38} />

      {/* Bushes */}
      <Bush x={205} y={810} r={11} />
      <Bush x={340} y={830} r={12} />
      <Bush x={395} y={870} r={11} />
      <Bush x={235} y={870} r={10} />

      {/* Flower patches */}
      {[[175, 770], [310, 800], [430, 880]].map(([x, y], i) => (
        <g key={`fl2-${i}`}>
          <circle cx={x} cy={y} r="3.5" fill="#ff80a8" />
          <circle cx={x + 6} cy={y + 3} r="3" fill="#ffe048" />
          <circle cx={x - 5} cy={y + 4} r="3" fill="#fff0c0" />
          <circle cx={x + 2} cy={y - 5} r="2.5" fill="#ff9040" />
        </g>
      ))}

      {/* Treasure X marker */}
      <g transform="translate(380, 760)">
        <line x1="-7" y1="-7" x2="7" y2="7" stroke="#d83828" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="7" y1="-7" x2="-7" y2="7" stroke="#d83828" strokeWidth="3.5" strokeLinecap="round" />
      </g>

      {/* ══════════════════════════════════════════
          BOTTOM — BIG LAKE
      ══════════════════════════════════════════ */}

      {/* Big lake */}
      <path
        d="M50 920 Q70 895 150 905 Q280 895 380 915 Q470 925 490 960 Q500 1000 470 1030 Q390 1050 280 1045 Q150 1050 80 1035 Q40 1015 35 980 Q30 945 50 920 Z"
        fill="url(#pk-lake)"
      />
      {/* Lake highlights */}
      <path d="M90 935 Q200 925 350 940" stroke="white" strokeWidth="2" fill="none" opacity="0.5" />
      <ellipse cx="180" cy="990" rx="50" ry="8" fill="white" opacity="0.32" />
      <ellipse cx="350" cy="1010" rx="38" ry="6" fill="white" opacity="0.28" />
      {/* Ripples */}
      <ellipse cx="120" cy="970" rx="15" ry="3" fill="none" stroke="white" strokeWidth="1" opacity="0.5" />
      <ellipse cx="400" cy="980" rx="20" ry="4" fill="none" stroke="white" strokeWidth="1" opacity="0.5" />
      <ellipse cx="260" cy="1020" rx="18" ry="3" fill="none" stroke="white" strokeWidth="1" opacity="0.4" />

      {/* Boat */}
      <Boat x={290} y={970} />

      {/* Dock (small wooden pier) */}
      <rect x="65" y="908" width="40" height="14" fill="#a06834" />
      <rect x="65" y="906" width="40" height="3" fill="#c08858" />
      <rect x="68" y="918" width="4" height="10" fill="#7a4824" />
      <rect x="100" y="918" width="4" height="10" fill="#7a4824" />

      {/* Lily pads */}
      <ellipse cx="410" cy="945" rx="9" ry="6" fill="#5a9a30" />
      <ellipse cx="425" cy="950" rx="6" ry="4" fill="#6ab040" />
      <ellipse cx="430" cy="940" rx="3" ry="2" fill="#f078a8" />

      {/* Pine trees around lake edges */}
      <Pine x={30} y={905} h={42} />
      <Pine x={490} y={1010} h={36} />
      <Pine x={510} y={935} h={40} />

      <style>{`
        .pk-flame { transform-origin: center bottom; animation: pk-flicker 0.9s ease-in-out infinite alternate; }
        @keyframes pk-flicker { 0%{transform:scale(1) translateY(0)} 100%{transform:scale(1.08,1.12) translateY(-1px)} }
      `}</style>
    </svg>
  );
}

// ── Animal sprite ──────────────────────────────────────────────────────────
function AnimalSprite({ sprite }: { sprite: Sprite }) {
  const size = ANIMAL_SIZE;
  const isWalking = sprite.action === 'walking';
  const isFight = sprite.action === 'fight';
  // Characters in this codebase face LEFT by default; flip when moving right
  const flipX = sprite.facing === 'right' ? -1 : 1;

  return (
    <div
      style={{
        position: 'absolute',
        left: sprite.x - size / 2,
        top: sprite.y - size,
        width: size,
        height: size,
        zIndex: Math.round(sprite.y),
        transition: 'left 0.65s linear, top 0.65s linear',
        pointerEvents: 'none',
        filter: 'drop-shadow(0 3px 3px rgba(0,40,0,0.3))',
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

const FX_ITEMS: Record<string, string[]> = {
  friendly: ['💛', '💚', '🧡', '💛'],
  fight:    ['✨', '💥', '⭐', '✨'],
};

function InteractionFx({ fx }: { fx: Fx }) {
  return (
    <div style={{ position: 'absolute', left: fx.x, top: fx.y, pointerEvents: 'none', zIndex: 9999 }}>
      {FX_ITEMS[fx.kind].map((item, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            fontSize: 22,
            left: (i - 1.5) * 26,
            transform: 'translate(-50%, -50%)',
            animationDelay: `${i * 0.09}s`,
            animation: 'pk-fx-rise 1.9s ease-out forwards',
            opacity: 0,
          }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ── Zoom / pan ─────────────────────────────────────────────────────────────
type Transform = { tx: number; ty: number; zoom: number };

function clampTransform(tx: number, ty: number, zoom: number, cw: number, ch: number): Transform {
  const sw = SCENE_W * zoom, sh = SCENE_H * zoom;
  const m = 0.22;
  return {
    tx: Math.max(-(sw * (1 + m) - cw), Math.min(sw * m, tx)),
    ty: Math.max(-(sh * (1 + m) - ch), Math.min(sh * m, ty)),
    zoom,
  };
}

// Default fit: fill the screen edge-to-edge (some content may be clipped at edges)
function computeFit(cw: number, ch: number): Transform {
  const fz = Math.max(cw / SCENE_W, ch / SCENE_H);
  const tx = (cw - SCENE_W * fz) / 2;
  const ty = (ch - SCENE_H * fz) / 2;
  return { tx, ty, zoom: fz };
}

// ── Main page ──────────────────────────────────────────────────────────────
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

  const fitTransform = useCallback(() => {
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    return computeFit(cw, ch);
  }, []);

  // Resize listener
  useEffect(() => {
    const onResize = () => updateTransform(computeFit(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateTransform]);

  // ── Touch handling: pan + pinch + custom double-tap ──────────────────────
  const touchRef = useRef({
    type: 'none' as 'none' | 'drag' | 'pinch',
    startT: { tx: 0, ty: 0, zoom: 1 },
    p1: { x: 0, y: 0 },
    startDist: 0,
    startMid: { x: 0, y: 0 },
    tapStart: { time: 0, x: 0, y: 0 },
    lastTapTime: 0,
    moved: false,
  });

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
      tr.type = 'drag';
      tr.p1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      tr.tapStart = { time: Date.now(), x: e.touches[0].clientX, y: e.touches[0].clientY };
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

    if (tr.type === 'drag' && e.touches.length === 1) {
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
    const wasDrag = tr.type === 'drag';
    tr.type = 'none';

    // Double-tap detection (single quick tap without movement)
    if (wasDrag && !tr.moved && e.changedTouches.length === 1) {
      const ct = e.changedTouches[0];
      const elapsed = Date.now() - tr.tapStart.time;
      const dx = ct.clientX - tr.tapStart.x;
      const dy = ct.clientY - tr.tapStart.y;
      if (elapsed < 280 && Math.hypot(dx, dy) < 12) {
        const now = Date.now();
        if (now - tr.lastTapTime < 350) {
          doReset();
          tr.lastTapTime = 0;
        } else {
          tr.lastTapTime = now;
        }
      }
    }
  }, [doReset]);

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

  // ── Animal state ──────────────────────────────────────────────────────────
  const { unlockedIds, companionId } = useMemo(() => ({
    unlockedIds: getUnlockedIds('a-kiwi'),
    companionId: getCompanionId(),
  }), []);

  const [sprites, setSprites] = useState<Sprite[]>(() => initSprites(unlockedIds, companionId));
  const [fxList, setFxList] = useState<Fx[]>([]);

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

  // Speech bubble tick — periodically gives a random animal something to say
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setSprites(prev => {
        // Clear expired speeches
        const cleaned = prev.map(sp =>
          sp.speech && sp.speech.expiresAt < now ? { ...sp, speech: undefined } : sp,
        );
        // 50% chance to assign a new speech to an animal that isn't already speaking
        if (Math.random() < 0.5) {
          const eligible = cleaned.filter(sp => !sp.speech);
          if (eligible.length > 0) {
            const chosen = eligible[Math.floor(Math.random() * eligible.length)];
            const line = SPEECH_LINES[Math.floor(Math.random() * SPEECH_LINES.length)];
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
      {/* Scene */}
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
        <ParkSceneSVG />
        {sortedSprites.map(sp => <AnimalSprite key={sp.id} sprite={sp} />)}
        {fxList.map(fx => <InteractionFx key={fx.uid} fx={fx} />)}
      </div>

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'absolute',
          top: 'max(16px, env(safe-area-inset-top))',
          left: 16,
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
          border: 'none',
          borderRadius: 999,
          padding: '8px 16px',
          fontSize: 14,
          fontWeight: 600,
          color: '#1a2638',
          cursor: 'pointer',
          zIndex: 50,
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        }}
      >
        ← 返回
      </button>

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 'max(16px, env(safe-area-inset-top))',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
          borderRadius: 999,
          padding: '8px 18px',
          fontSize: 14,
          fontWeight: 700,
          color: '#1a2638',
          zIndex: 50,
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          whiteSpace: 'nowrap',
        }}
      >
        🏕️ 探险公园
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
          border: 'none',
          borderRadius: 999,
          padding: '7px 14px',
          fontSize: 13,
          fontWeight: 600,
          color: '#1a2638',
          zIndex: 50,
          boxShadow: '0 2px 12px rgba(0,0,0,0.16)',
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
