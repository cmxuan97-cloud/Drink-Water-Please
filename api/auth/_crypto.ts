// 共用密码哈希 + base64 工具。文件名以 _ 开头，Vercel 不会把它部署成 API 路由。
const ITERATIONS = 100_000;

export const b64encode = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};

export const b64decode = (s: string): Uint8Array => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const hashPassword = async (password: string, salt: Uint8Array): Promise<string> => {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password) as BufferSource,
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    256,
  );
  return b64encode(bits);
};

// 常量时间比较 — 防 timing 攻击
export const timingSafeEq = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const normalizeUsername = (s: string): string => s.trim().toLowerCase();

export const validateUsername = (s: string): string | null => {
  if (s.length < 3) return '用户名至少 3 个字符';
  if (s.length > 30) return '用户名最多 30 个字符';
  if (!/^[a-z0-9_.\-]+$/.test(s)) return '用户名只能用 a-z、0-9、_ . -';
  return null;
};

export const validatePassword = (s: string): string | null => {
  if (s.length < 6) return '密码至少 6 位';
  if (s.length > 100) return '密码太长（>100 位）';
  return null;
};
