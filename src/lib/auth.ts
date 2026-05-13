// 用户名 + 密码登录系统。建立在已有的 sync 系统上 —
// 账号本质就是「username 映射到 clientId」+ 密码校验。
//
// 登录后客户端拿到 clientId，立刻 restore 一次把所有数据拉下来。
// 注册后把当前 clientId 绑定到新账号（保留已有数据）。

import { getOrCreateClientId, setUserName } from './storage';
import { applySnapshot, forceSyncNow, type Snapshot } from './sync';

const K_AUTH_USERNAME = 'dw:authUsername';
const K_AUTH_DISPLAY = 'dw:authDisplayName';
const K_CLIENT_ID = 'dw:clientId';
const K_BACKUP_CODE = 'dw:backupCode';
const K_USER_NAME = 'dw:userName';

export const getCurrentUsername = (): string | null => localStorage.getItem(K_AUTH_USERNAME);
export const getCurrentDisplayName = (): string | null => localStorage.getItem(K_AUTH_DISPLAY);

const safeJson = async (resp: Response): Promise<{ ok?: boolean; error?: string; [k: string]: unknown }> => {
  try {
    return (await resp.json()) as Record<string, unknown>;
  } catch {
    return { error: `服务端返回非 JSON (${resp.status})` };
  }
};

const fetchSnapshot = async (clientId: string): Promise<Snapshot | null> => {
  const resp = await fetch(`/api/sync/restore?code=${encodeURIComponent(clientId)}`);
  if (!resp.ok) return null;
  const j = (await safeJson(resp)) as { state?: Snapshot };
  return j.state ?? null;
};

export const register = async (
  username: string,
  password: string,
  displayName: string,
): Promise<{ ok: boolean; error?: string }> => {
  const bindClientId = getOrCreateClientId(); // 保留当前数据
  const resp = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, displayName, bindClientId }),
  });
  if (!resp.ok) {
    const j = await safeJson(resp);
    return { ok: false, error: j.error ?? '注册失败' };
  }
  const j = (await safeJson(resp)) as { clientId?: string; username?: string; displayName?: string };
  if (!j.clientId || !j.username) return { ok: false, error: '服务端返回数据不完整' };

  // 持久化身份信息
  localStorage.setItem(K_CLIENT_ID, j.clientId);
  localStorage.setItem(K_AUTH_USERNAME, j.username);
  if (j.displayName) localStorage.setItem(K_AUTH_DISPLAY, j.displayName);
  // 把 displayName 也写到 userName（顶部欢迎用）
  if (j.displayName) setUserName(j.displayName);
  // 清旧的 backup code 缓存 — 新 clientId 对应新短码
  localStorage.removeItem(K_BACKUP_CODE);
  // 立刻把当前数据上传到云，让账号马上有备份
  await forceSyncNow();
  return { ok: true };
};

export const login = async (
  username: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> => {
  const resp = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!resp.ok) {
    const j = await safeJson(resp);
    return { ok: false, error: j.error ?? '登录失败' };
  }
  const j = (await safeJson(resp)) as { clientId?: string; username?: string; displayName?: string };
  if (!j.clientId || !j.username) return { ok: false, error: '服务端返回数据不完整' };

  // 替换本地身份
  localStorage.setItem(K_CLIENT_ID, j.clientId);
  localStorage.setItem(K_AUTH_USERNAME, j.username);
  if (j.displayName) localStorage.setItem(K_AUTH_DISPLAY, j.displayName);
  localStorage.removeItem(K_BACKUP_CODE);

  // 拉取该账号在云端的全部数据并覆盖本地
  const snapshot = await fetchSnapshot(j.clientId);
  if (snapshot) {
    try {
      applySnapshot(snapshot, { keepClientId: true });
    } catch {
      // 数据格式异常，继续 — 至少账号是登上的
    }
  }
  // 如果本地没 userName 就用 displayName 兜底
  if (!localStorage.getItem(K_USER_NAME) && j.displayName) {
    setUserName(j.displayName);
  }
  return { ok: true };
};

/** 登出：清掉账号信息 + 清空所有本地 dw:* 数据 + 生成新匿名 clientId。
 *  云端数据保留 — 用户重新登录可以拉回。 */
export const logout = (): void => {
  // 收集所有 dw:* 键再清
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('dw:')) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
  // 不主动生成新 clientId — getOrCreateClientId() 在下一次需要时会生成
};
