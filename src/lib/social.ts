// 社交 API 的客户端封装。
import { getOrCreateClientId } from './storage';

export type PublicProfile = {
  username: string;
  displayName: string;
  companionId?: string;
  charId?: string;
  todayPctGoal: number;
  unlockedCount: number;
  totalCompletedDays: number;
  currentStreak: number;
  updatedAt: number;
};

export type Friend = PublicProfile & { clientId: string };

export type FriendRequest = {
  clientId: string;
  username: string;
  displayName: string;
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
