import { kv } from '@vercel/kv';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body: { clientId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON 无效' }, { status: 400 });
  }

  const { clientId } = body;
  if (!clientId) {
    return Response.json({ error: '缺 clientId' }, { status: 400 });
  }

  try {
    await kv.del(`sub:${clientId}`);
    await kv.srem('subs:all', clientId);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      { error: `KV 删除失败：${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }
}
