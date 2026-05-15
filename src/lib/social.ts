// 社交 API 的客户端封装。
import { getOrCreateClientId } from './storage';

export type PublicProfile = {
  username: string;
  displayName: string;
  companionId?: string;
  charId?: string;
  todayPctGoal: number;
  todayDrunkMl?: number;
  unlockedCount: number;
  unlockedIds?: string[];
  totalCompletedDays: number;
  currentStreak: number;
  peakStreak?: number;
  updatedAt: number;
};

export type Friend = PublicProfile & { clientId: string };

export type FriendRequest = {
  clientId: string;
  username: string;
  displayName: string;
  companionId?: string;
  charId?: string;
  sentAt: number;
};

export type SearchResult = {
  username: string;
  displayName: string;
  clientId: string;
  companionId?: string;
  charId?: string;
};

const safeJson = async (r: Response): Promise<Record<string, unknown>> => {
  try { return (await r.json()) as Record<string, unknown>; }
  catch { return { error: `服务端返回非 JSON (${r.status})` }; }
};

export const searchUsers = async (q: string): Promise<{ results: SearchResult[]; error?: string }> => {
  if (!q.trim()) return { results: [] };
  const clientId = getOrCreateClientId();
  const url = `/api/social/search?clientId=${encodeURIComponent(clientId)}&q=${encodeURIComponent(q)}`;
  try {
    const r = await fetch(url);
    if (!r.ok) {
      const j = await safeJson(r);
      return { results: [], error: (j.error as string) ?? `搜索失败 (${r.status})` };
    }
    const j = (await safeJson(r)) as { results?: SearchResult[] };
    return { results: j.results ?? [] };
  } catch (e) {
    return { results: [], error: e instanceof Error ? e.message : '网络错误' };
  }
};

export const sendFriendRequest = async (
  targetUsername: string,
): Promise<{ ok: boolean; error?: string; autoAccepted?: boolean }> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch('/api/social/friend/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, targetUsername }),
    });
    const j = await safeJson(r);
    if (!r.ok) return { ok: false, error: (j.error as string) ?? '发送失败' };
    return { ok: true, autoAccepted: Boolean(j.autoAccepted) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
};

export const respondToRequest = async (
  fromClientId: string,
  accept: boolean,
): Promise<{ ok: boolean; error?: string }> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch('/api/social/friend/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, fromClientId, accept }),
    });
    const j = await safeJson(r);
    if (!r.ok) return { ok: false, error: (j.error as string) ?? '处理失败' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
};

export const removeFriend = async (
  targetClientId: string,
): Promise<{ ok: boolean; error?: string }> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch('/api/social/friend/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, targetClientId }),
    });
    const j = await safeJson(r);
    if (!r.ok) return { ok: false, error: (j.error as string) ?? '删除失败' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
};

export type InboxEvent = {
  uid: string;
  type: 'water' | 'cheer' | 'note' | 'scold';
  fromClientId: string;
  fromUsername: string;
  fromDisplayName: string;
  fromCompanionId?: string;
  fromCharId?: string;
  text?: string;
  emoji?: string;
  createdAt: number;
};

export const sendWater = async (
  targetClientId: string,
  text?: string,
): Promise<{ ok: boolean; error?: string }> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch('/api/social/water', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, targetClientId, text }),
    });
    const j = await safeJson(r);
    if (!r.ok) return { ok: false, error: (j.error as string) ?? '递水失败' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
};

export const sendScold = async (
  targetClientId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch('/api/social/scold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, targetClientId, text }),
    });
    const j = await safeJson(r);
    if (!r.ok) return { ok: false, error: (j.error as string) ?? '失败' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
};

export const sendCheer = async (
  targetClientId: string,
  emoji: string,
): Promise<{ ok: boolean; error?: string }> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch('/api/social/cheer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, targetClientId, emoji }),
    });
    const j = await safeJson(r);
    if (!r.ok) return { ok: false, error: (j.error as string) ?? '失败' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
};

export const fetchInbox = async (): Promise<{
  events: InboxEvent[];
  unread: number;
  lastReadAt: number;
  error?: string;
}> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch(`/api/social/inbox?clientId=${encodeURIComponent(clientId)}`);
    if (!r.ok) {
      const j = await safeJson(r);
      return { events: [], unread: 0, lastReadAt: 0, error: (j.error as string) ?? '获取失败' };
    }
    const j = (await safeJson(r)) as { events?: InboxEvent[]; unread?: number; lastReadAt?: number };
    return {
      events: j.events ?? [],
      unread: j.unread ?? 0,
      lastReadAt: j.lastReadAt ?? 0,
    };
  } catch (e) {
    return { events: [], unread: 0, lastReadAt: 0, error: e instanceof Error ? e.message : '网络错误' };
  }
};

export const ackInbox = async (): Promise<{ ok: boolean }> => {
  const clientId = getOrCreateClientId();
  try {
    await fetch('/api/social/inbox/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
};

// ── Friend Park (visit + notes) ────────────────────────────────────────────
export type ParkNote = {
  uid: string;
  fromClientId: string;
  fromUsername: string;
  fromDisplayName: string;
  fromCompanionId?: string;
  fromCharId?: string;
  message: string;
  createdAt: number;
};

export const visitFriendPark = async (
  targetUsername: string,
): Promise<{
  profile?: PublicProfile & { clientId: string };
  notes: ParkNote[];
  isSelf: boolean;
  error?: string;
}> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch(
      `/api/social/park/visit?clientId=${encodeURIComponent(clientId)}&targetUsername=${encodeURIComponent(targetUsername)}`,
    );
    if (!r.ok) {
      const j = await safeJson(r);
      return { notes: [], isSelf: false, error: (j.error as string) ?? '加载失败' };
    }
    const j = (await safeJson(r)) as {
      profile?: PublicProfile & { clientId: string };
      notes?: ParkNote[];
      isSelf?: boolean;
    };
    return { profile: j.profile, notes: j.notes ?? [], isSelf: Boolean(j.isSelf) };
  } catch (e) {
    return { notes: [], isSelf: false, error: e instanceof Error ? e.message : '网络错误' };
  }
};

export const leaveParkNote = async (
  targetUsername: string,
  message: string,
): Promise<{ ok: boolean; note?: ParkNote; error?: string }> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch('/api/social/park/note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, targetUsername, message }),
    });
    const j = await safeJson(r);
    if (!r.ok) return { ok: false, error: (j.error as string) ?? '留言失败' };
    return { ok: true, note: j.note as ParkNote };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
};

// ── Leaderboard ─────────────────────────────────────────────────────────────
export type LeaderboardRow = PublicProfile & { clientId: string; isMe: boolean };

export const fetchLeaderboard = async (): Promise<{ rows: LeaderboardRow[]; error?: string }> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch(`/api/social/leaderboard?clientId=${encodeURIComponent(clientId)}`);
    if (!r.ok) {
      const j = await safeJson(r);
      return { rows: [], error: (j.error as string) ?? '获取失败' };
    }
    const j = (await safeJson(r)) as { rows?: LeaderboardRow[] };
    return { rows: j.rows ?? [] };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : '网络错误' };
  }
};

// ── Teams ──────────────────────────────────────────────────────────────────
export type Team = {
  id: string;
  name: string;
  createdBy: string;
  members: string[];
  joinCode: string;
  createdAt: number;
  memberProfiles: Array<PublicProfile & { clientId: string }>;
};

export const createTeam = async (name: string): Promise<{
  ok: boolean; teamId?: string; joinCode?: string; error?: string;
}> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch('/api/teams/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, name }),
    });
    const j = await safeJson(r);
    if (!r.ok) return { ok: false, error: (j.error as string) ?? '创建失败' };
    return { ok: true, teamId: j.teamId as string, joinCode: j.joinCode as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
};

export const joinTeam = async (joinCode: string): Promise<{
  ok: boolean; teamId?: string; name?: string; error?: string;
}> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch('/api/teams/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, joinCode }),
    });
    const j = await safeJson(r);
    if (!r.ok) return { ok: false, error: (j.error as string) ?? '加入失败' };
    return { ok: true, teamId: j.teamId as string, name: j.name as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
};

export const leaveTeam = async (teamId: string): Promise<{ ok: boolean; error?: string }> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch('/api/teams/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, teamId }),
    });
    const j = await safeJson(r);
    if (!r.ok) return { ok: false, error: (j.error as string) ?? '离开失败' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
};

export const fetchMyTeams = async (): Promise<{ teams: Team[]; error?: string }> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch(`/api/teams/my?clientId=${encodeURIComponent(clientId)}`);
    if (!r.ok) {
      const j = await safeJson(r);
      return { teams: [], error: (j.error as string) ?? '获取失败' };
    }
    const j = (await safeJson(r)) as { teams?: Team[] };
    return { teams: j.teams ?? [] };
  } catch (e) {
    return { teams: [], error: e instanceof Error ? e.message : '网络错误' };
  }
};

export const fetchFriends = async (): Promise<{
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  error?: string;
}> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch(`/api/social/friends?clientId=${encodeURIComponent(clientId)}`);
    if (!r.ok) {
      const j = await safeJson(r);
      return { friends: [], incoming: [], outgoing: [], error: (j.error as string) ?? '获取失败' };
    }
    const j = (await safeJson(r)) as {
      friends?: Friend[];
      incoming?: FriendRequest[];
      outgoing?: FriendRequest[];
    };
    return {
      friends: j.friends ?? [],
      incoming: j.incoming ?? [],
      outgoing: j.outgoing ?? [],
    };
  } catch (e) {
    return { friends: [], incoming: [], outgoing: [], error: e instanceof Error ? e.message : '网络错误' };
  }
};

// ── 附近的人 ──────────────────────────────────────────────

export type NearbyUser = {
  clientId: string;
  username: string;
  displayName: string;
  companionId?: string;
  charId?: string;
  todayPctGoal: number;
  currentStreak: number;
  unlockedCount: number;
};

export const checkinNearby = async (
  lat: number,
  lng: number,
): Promise<{ ok: boolean; expiresIn?: number; error?: string }> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch('/api/social/nearby/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, lat, lng }),
    });
    const j = await safeJson(r);
    if (!r.ok) return { ok: false, error: (j.error as string) ?? '签到失败' };
    return { ok: true, expiresIn: j.expiresIn as number };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
};

export const listNearby = async (
  lat: number,
  lng: number,
): Promise<{ users: NearbyUser[]; error?: string }> => {
  const clientId = getOrCreateClientId();
  try {
    const r = await fetch(
      `/api/social/nearby/list?clientId=${encodeURIComponent(clientId)}&lat=${lat}&lng=${lng}`,
    );
    if (!r.ok) {
      const j = await safeJson(r);
      return { users: [], error: (j.error as string) ?? '获取附近用户失败' };
    }
    const j = (await safeJson(r)) as { users?: NearbyUser[] };
    return { users: j.users ?? [] };
  } catch (e) {
    return { users: [], error: e instanceof Error ? e.message : '网络错误' };
  }
};
