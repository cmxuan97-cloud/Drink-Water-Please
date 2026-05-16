// Vercel Edge Function — Gemini vision proxy.
// 同时做：(a) 估液位 (b) 识别品牌/容器 (c) 给标准尺寸选项
// Mirrors the Vite dev middleware in vite.config.ts.

export const config = { runtime: 'edge' };

import { clientIp, getRedis, rateLimit } from './_ratelimit';

const SYSTEM = `你是一个饮料容器识别 + 容量估算助手。看用户上传的图片，做三件事：

1. 估液位：液体占容器总容量的百分比 (0-100 整数)
2. 识别这是什么饮料/容器（最好能认出品牌，例如麦当劳/星巴克/可口可乐/依云/农夫山泉/瓶装水/自带保温杯）
3. 如果是常见连锁/品牌商品 → 列出该品牌官方常见尺寸 (用你的训练知识，覆盖马来西亚 / 大中华 / 美区，能多列就多列)
   如果是自带容器（保温杯/家里水杯/不可识别瓶子）→ sizes 给空数组 []，让用户手动输入

**只输出一个 JSON 对象，严格按以下格式，不要 markdown 不要解释**:

{
  "fillPercent": 0-100,
  "confidence": "low" | "medium" | "high",
  "detected": {
    "label": "短描述，如「麦当劳大杯可口可乐」「星巴克 Grande 拿铁」「依云 500ml」「自带保温杯」",
    "brand": "品牌名 或 null",
    "category": "water" | "coffee" | "tea" | "juice" | "soda" | "milk" | "other",
    "isCommon": true | false,
    "sizes": [
      { "label": "尺寸名（如 Small / Medium / Large 或 中杯）", "capacityMl": 整数 }
    ],
    "mostLikelyIndex": 整数,
    "estimatedCapacityMl": 整数
  },
  "note": "可选简短说明"
}

注意：
- mostLikelyIndex 是 sizes 数组里最像图中那杯的 index (0-based)。如果只有一个 size 就是 0。如果 sizes 是 [] 给 0
- estimatedCapacityMl 必填：你目测这个容器**总容量**多少 ml。即使 sizes 为空也要给一个估算
- 不要拒答。看不清就给低 confidence + 合理猜测
- 麦当劳常见杯型：Small ~350ml, Medium ~500ml, Large ~650ml, XL ~750ml
- 星巴克：Short 240ml, Tall 354ml, Grande 473ml, Venti 591ml, Trenta 887ml
- KFC: Regular 400ml, Large 600ml
- 可口可乐瓶/罐：罐 330ml, 小瓶 500ml, 大瓶 1500ml/2000ml
- 矿泉水：常见 330/500/600/1000/1500ml`;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type Payload = {
  data?: string;
  mimeType?: string;
  // hint：可选。用户已经选了某个容器就传过来给模型当上下文
  hintContainerName?: string;
  hintCapacityMl?: number;
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // 限流：每个 IP 每分钟最多 10 次（保护 Gemini API 配额不被滥刷）
  const redis = getRedis();
  if (redis) {
    const { ok } = await rateLimit(redis, 'fill', clientIp(req), 10, 60);
    if (!ok) return json({ error: '请求太频繁，每分钟最多 10 次，请稍后再试' }, 429);
  }

  const apiKey = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: '服务端未配置 GEMINI_API_KEY' }, 500);
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return json({ error: 'JSON 无效' }, 400);
  }

  const { data, mimeType, hintContainerName, hintCapacityMl } = payload;
  if (!data || !mimeType) return json({ error: '参数缺失（缺图片）' }, 400);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(apiKey)}`;

  const userText = hintContainerName && hintCapacityMl
    ? `用户提示：他们当前选的容器是「${hintContainerName}」≈${hintCapacityMl}ml。但请你独立判断品牌/尺寸，不要被这个 hint 限制；若你识别出的品牌信息不一样，按你看到的来。`
    : `请独立识别图中容器并给出尺寸选项。`;

  const reqBody = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data } },
          { text: userText },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 600,
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
  if (!match) return json({ error: `Gemini 未返回 JSON：${text.slice(0, 100)}` }, 502);

  return new Response(match[0], {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
