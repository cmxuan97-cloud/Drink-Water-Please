export type Container = {
  id: string;
  name: string;
  capacityMl: number;
  emoji?: string;
};

export type Entry = {
  id: string;
  ts: number;
  ml: number;
  containerId?: string;
  photoDataUrl?: string;
  estimatedFill?: number;
  note?: string;
};

export type NotifyMode = 'easy' | 'standard' | 'frequent' | 'smart';

export type Settings = {
  weightKg: number;
  mlPerKg: number;
  wakeHour: number;
  sleepHour: number;
  notificationsEnabled: boolean;
  notifyMode?: NotifyMode;
};

export const DEFAULT_SETTINGS: Settings = {
  weightKg: 65,
  mlPerKg: 35,
  wakeHour: 7,
  sleepHour: 23,
  notificationsEnabled: false,
  notifyMode: 'standard',
};

export const DEFAULT_CONTAINERS: Container[] = [
  { id: 'c-glass', name: '玻璃杯', capacityMl: 250, emoji: '🥛' },
  { id: 'c-mug', name: '马克杯', capacityMl: 350, emoji: '☕' },
  { id: 'c-bottle', name: '矿泉水瓶', capacityMl: 500, emoji: '💧' },
  { id: 'c-coffee', name: '咖啡', capacityMl: 200, emoji: '☕' },
  { id: 'c-juice', name: '果汁', capacityMl: 250, emoji: '🧃' },
  { id: 'c-soda', name: '汽水', capacityMl: 330, emoji: '🥤' },
  { id: 'c-bottled-water', name: '包装水', capacityMl: 500, emoji: '🚰' },
];
