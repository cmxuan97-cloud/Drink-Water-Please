// Vercel Edge Function — Gemini vision proxy for production deploy.
// Mirrors the Vite dev middleware in vite.config.ts.
// Reads GEMINI_API_KEY from Vercel env vars (set in Project Settings).

export const config = { runtime: 'edge' };

const SYSTEM = `你是一个测量助手。用户会上传一张图片，里面有一个容器(杯/瓶)装着水或饮料。
你的任务：仅估计容器里液体占容器**总容量**的百分比（0-100整数）。
忽略容器材质、品牌、背景。如果容器是不透明的或看不清液面，给低 confidence。
**只输出一个 JSON 对象**，格式严格如下，不要任何解释文字、不要 markdown：
{"fillPercent": 0-100, "confidence": "low"|"medium"|"high", "note": "可选简短说明"}`;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type Payload = {
  data?: string;
  mimeType?: string;
  containerName?: string;
  capacityMl?: number;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: '服务端未配置 GEMINI_API_KEY（请在 Vercel Project Settings → Environment Variables 添加）' }, 500);
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json({ error: 'JSON 无效' }, 400);
  }

  const { data, mimeType, containerName, capacityMl } = payload;
  if (!data || !mimeType || !containerName || typeof capacityMl !== 'number') {
    return json({ error: '参数缺失' }, 400);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(apiKey)}`;

  const reqBody = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data } },
          { text: `容器是「${containerName}」，总容量约 ${capacityMl} ml。请估水位百分比。` },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 400,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  let geminiResp: Response;
  try {
    geminiResp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    });
  } catch (e) {
    return json({ error: `调用 Gemini 失败：${e instanceof Error ? e.message : String(e)}` }, 502);
  }

  if (!geminiResp.ok) {
    const errText = await geminiResp.text();
    return json({ error: `Gemini ${geminiResp.status}: ${errText.slice(0, 200)}` }, 502);
  }

  const result = (await geminiResp.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return json({ error: `Gemini 未返回 JSON：${text.slice(0, 100)}` }, 502);
  }

  return new Response(match[0], {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
