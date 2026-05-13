import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// 同 api/estimate-fill.ts 的 prompt — 改这里时记得两边同步
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
    "sizes": [{ "label": "尺寸名", "capacityMl": 整数 }],
    "mostLikelyIndex": 整数,
    "estimatedCapacityMl": 整数
  },
  "note": "可选简短说明"
}

注意：
- mostLikelyIndex 是 sizes 数组里最像图中那杯的 index (0-based)。如果只有一个 size 就是 0，sizes=[] 给 0
- estimatedCapacityMl 必填：你目测这个容器**总容量**多少 ml
- 不要拒答。看不清就给低 confidence + 合理猜测
- 麦当劳常见杯型：Small ~350ml, Medium ~500ml, Large ~650ml, XL ~750ml
- 星巴克：Short 240ml, Tall 354ml, Grande 473ml, Venti 591ml, Trenta 887ml
- KFC: Regular 400ml, Large 600ml
- 可口可乐瓶/罐：罐 330ml, 小瓶 500ml, 大瓶 1500ml/2000ml
- 矿泉水：常见 330/500/600/1000/1500ml`;

const readBody = async (req: Connect.IncomingMessage): Promise<string> => {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
};

const geminiProxy = (apiKey: string | undefined): Plugin => ({
  name: 'gemini-proxy',
  configureServer(server) {
    server.middlewares.use('/api/estimate-fill', async (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method not allowed');
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      if (!apiKey) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: '服务端未配置 GEMINI_API_KEY（在 .env.local 里设置）' }));
        return;
      }
      let payload: { data?: string; mimeType?: string; hintContainerName?: string; hintCapacityMl?: number };
      try {
        payload = JSON.parse(await readBody(req));
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'JSON 无效' }));
        return;
      }
      const { data, mimeType, hintContainerName, hintCapacityMl } = payload;
      if (!data || !mimeType) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: '参数缺失（缺图片）' }));
        return;
      }
      const userText = hintContainerName && hintCapacityMl
        ? `用户提示：他们当前选的容器是「${hintContainerName}」≈${hintCapacityMl}ml。但请你独立判断品牌/尺寸，不要被这个 hint 限制。`
        : `请独立识别图中容器并给出尺寸选项。`;
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
          model: 'gemini-3-flash-preview',
          systemInstruction: SYSTEM,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 600,
            thinkingConfig: { thinkingBudget: 0 },
          } as Record<string, unknown>,
        });
        const result = await model.generateContent([
          { inlineData: { data, mimeType } },
          { text: userText },
        ]);
        const raw = result.response.text().trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: `Gemini 未返回 JSON：${raw.slice(0, 100)}` }));
          return;
        }
        res.end(jsonMatch[0]);
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      geminiProxy(env.GEMINI_API_KEY),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'Drink Water',
          short_name: 'Water',
          description: '按体重算每日饮水目标，拍照测量水量，智能提醒',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#ffffff',
          theme_color: '#1c8de8',
          icons: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
    ],
    server: {
      host: true,
    },
  };
});
