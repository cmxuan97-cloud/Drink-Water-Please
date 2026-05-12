import { getOrCreateClientId } from './storage';

/** 把用户名同步到服务端 KV，失败不阻塞（本地已经存好了） */
export const syncUserNameToServer = async (name: string): Promise<void> => {
  try {
    await fetch('/api/user/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: getOrCreateClientId(),
        name: name.trim(),
      }),
    });
  } catch {
    // 静默失败 — 本地是 source of truth
  }
};
