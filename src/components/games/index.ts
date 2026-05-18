export type GameId = 'snake' | 'cross' | 'jump';

export const GAME_LS_KEYS: Record<GameId, string> = {
  snake: 'game_snake_best',
  cross: 'game_cross_best',
  jump: 'game_jump_best',
};

export const GAME_META: Record<GameId, { emoji: string; name: string; desc: string }> = {
  snake: { emoji: '🐍', name: '贪吃蛇', desc: '经典玩法，吃苹果越长越快' },
  cross: { emoji: '🐸', name: '过马路', desc: '操控小青蛙，躲开来车' },
  jump: { emoji: '🐰', name: '越跳越高', desc: '一直往上跳，挑战最高纪录' },
};

export interface GameProps {
  onGameOver: (score: number) => void;
  onBack: () => void;
  onRestart: () => void;
}

export { default as GameHub } from './GameHub';
export { default as SnakeGame } from './SnakeGame';
export { default as CrossRoadGame } from './CrossRoadGame';
export { default as JumpGame } from './JumpGame';
