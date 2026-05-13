// 自动云备份：把所有 dw:* localStorage 数据同步到 Redis，用 clientId 当 key。
// 任何本地写入 → triggerSync()（debounced 5 秒）→ 上传完整快照。
// 用户从其它设备装 app 时，只要输入备份码（= 老 clientId）就能拉回所有数据。
//
// 注意：照片不上传（占空间，本地保留 30 天），其它都备份。

import { getOrCreateClientId } from './storage';

const K_PREFIX = 'dw:';
const K_ENTRIES = 'dw:entries:';
const K_CLIENT_ID = 'dw:clientId';
const K_LAST_SYNC = 'dw:lastSyncAt';
const K_BACKUP_CODE = 'dw:backupCode';

// 不上传：clientId/lastSyncAt/backupCode（meta，恢复时不该被覆盖）
const SKIP_KEYS = new Set([K_CLIENT_ID, K_LAST_SYNC, K_BACKUP_CODE]);

export type Snapshot = {
  v: 1;
  savedAt: number;
  // 只保留 dw:* 开头的所有 localStorage key（排除 clientId / lastSyncAt）
  data: Record<string, string>;
};

const stripPhotosFromEntriesValue = (raw: string): string => {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return raw;
    const stripped = list.map((e: Record<string, unknown>) => {
      const { photoDataUrl: _ignored, ...rest } = e;
      return rest;
    });
    return JSON.stringify(stripped);
  } catch {
    return raw;
  }
};

export const gatherSnapshot = (): Snapshot => {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(K_PREFIX) || SKIP_KEYS.has(k)) continue;
    const v = localStorage.getItem(k);
    if (v === null) continue;
    // entry 数组要去掉 photoDataUrl
    if (k.startsWith(K_ENTRIES)) {
      data[k] = stripPhotosFromEntriesValue(v);
    } else {
      data[k] = v;
    }
  }
  return { v: 1, savedAt: Date.now(), data };
};

export const applySnapshot = (snap: Snapshot, opts?: { keepClientId?: boolean }): void => {
  if (!snap || snap.v !== 1 || !snap.data) throw new Error('备份格式不对');
  // 先清空旧的 dw:* 键（除了被保留的 clientId/lastSyncAt）— 避免新老数据混杂
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(K_PREFIX)) continue;
    if (opts?.keepClientId && k === K_CLIENT_ID) continue;
    if (k === K_LAST_SYNC) continue;
    toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);
  // 再写入快照里的所有键
  for (const [k, v] of Object.entries(snap.data)) {
    if (typeof v !== 'string') continue;
    localStorage.setItem(k, v);
  }
};

// === 自动上传 (debounced) ===
let timer: number | null = null;
let inFlight = false;
let dirtyAgain = false;

const doUpload = async (): Promise<void> => {
  if (inFlight) {
    dirtyAgain = true;
    return;
  }
  inFlight = true;
  try {
    const clientId = getOrCreateClientId();
    const snap = gatherSnapshot();
    const resp = await fetch('/api/sync/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, state: snap }),
    });
    if (resp.ok) {
      localStorage.setItem(K_LAST_SYNC, String(Date.now()));
    }
  } catch {
    // 静默失败 — 下次 trigger 会重试
  } finally {
    inFlight = false;
    if (dirtyAgain) {
      dirtyAgain = false;
      triggerSync();
    }
  }
};

/** 任何本地状态变化后调一下；多次连续调用会合并成一次上传（5 秒后） */
export const triggerSync = (): void => {
  if (typeof window === 'undefined') return;
  if (timer) clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void doUpload();
  }, 5000);
};

/** 强制立刻上传，不等 debounce — 用于「手动备份」按钮 */
export const forceSyncNow = async (): Promise<void> => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  await doUpload();
};

export const lastSyncAt = (): number | null => {
  const raw = localStorage.getItem(K_LAST_SYNC);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

// === 短备份码（人类友好，K3M7-P2AS 格式） ===
export const cachedBackupCode = (): string | null => localStorage.getItem(K_BACKUP_CODE);

/** 拿用户的短备份码（缓存优先，没有就向服务端申请生成） */
export const getOrFetchBackupCode = async (): Promise<{ code: string | null; error?: string }> => {
  const cached = localStorage.getItem(K_BACKUP_CODE);
  if (cached) return { code: cached };
  const clientId = getOrCreateClientId();
  try {
    const resp = await fetch('/api/sync/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    });
    if (!resp.ok) {
      let err = `获取失败 (${resp.status})`;
      try {
        const j = (await resp.json()) as { error?: string };
        if (j.error) err = j.error;
      } catch { /* ignore */ }
      return { code: null, error: err };
    }
    const j = (await resp.json()) as { code?: string };
    if (!j.code) return { code: null, error: '服务端未返回备份码' };
    localStorage.setItem(K_BACKUP_CODE, j.code);
    return { code: j.code };
  } catch (e) {
    return { code: null, error: e instanceof Error ? e.message : '网络错误' };
  }
};

// === 从备份码恢复 ===
export const restoreFromCode = async (
  code: string,
): Promise<{ ok: boolean; error?: string }> => {
  const trimmed = code.trim();
  if (!trimmed || trimmed.length < 8) {
    return { ok: false, error: '请输入完整的备份码' };
  }
  let resp: Response;
  try {
    resp = await fetch(`/api/sync/restore?code=${encodeURIComponent(trimmed)}`);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '网络错误' };
  }
  if (!resp.ok) {
    if (resp.status === 404) return { ok: false, error: '找不到这个备份码 — 看看有没打错或漏字' };
    let msg = `恢复失败 (${resp.status})`;
    try {
      const j = (await resp.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      // ignore
    }
    return { ok: false, error: msg };
  }
  let json: { state?: Snapshot; clientId?: string };
  try {
    json = (await resp.json()) as { state?: Snapshot; clientId?: string };
  } catch {
    return { ok: false, error: '备份内容损坏' };
  }
  if (!json.state) return { ok: false, error: '备份内容为空' };
  try {
    // 服务端把真正的 clientId 一起返回 — 用它而不是用户输入的（短码反查后才是真 clientId）
    const newClientId = json.clientId || trimmed;
    localStorage.setItem(K_CLIENT_ID, newClientId);
    // 清掉本地缓存的短码 — 让新设备下次主动重新拉一次（其实跟旧设备同一个，但 cache 才是新鲜的）
    localStorage.removeItem(K_BACKUP_CODE);
    applySnapshot(json.state, { keepClientId: true });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '应用备份失败' };
  }
  return { ok: true };
};
