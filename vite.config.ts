import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const SYSTEM = `你是一个测量助手。用户会上传一张图片，里面有一个容器(杯/瓶)装着水或饮料。
你的任务：仅估计容器里液体占容器**总容量**的百分比（0-100整数）。
忽略容器材质、品牌、背景。如果容器是不透明的或看不清液面，给低 confidence。
**只输出一个 JSON 对象**，格式严格如下，不要任何解释文字、不要 markdown：
{"fillPercent": 0-100, "confidence": "low"|"medium"|"high", "note": "可选简短说明"}`;

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
      let payload: { data?: string; mimeType?: string; containerName?: string; capacityMl?: number };
      try {
        payload = JSON.parse(await readBody(req));
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'JSON 无效' }));
        return;
      }
      const { data, mimeType, containerName, capacityMl } = payload;
      if (!data || !mimeType || !containerName || typeof capacityMl !== 'number') {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: '参数缺失' }));
        return;
      }
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
          model: 'gemini-3-flash-preview',
          systemInstruction: SYSTEM,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 400,
            // Gemini 3 thinking 会吃掉 output 预算；测水位是简单任务，关掉
            thinkingConfig: { thinkingBudget: 0 },
          } as Record<string, unknown>,
        });
        const result = await model.generateContent([
          { inlineData: { data, mimeType } },
          { text: `容器是「${containerName}」，总容量约 ${capacityMl} ml。请估水位百分比。` },
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
        includeAssets: ['favicon.svg', 'icon.svg'],
        manifest: {
          name: 'Drink Water',
          short_name: 'Water',
          description: '按体重算每日饮水目标，拍照测量水量，智能提醒',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#e6f4fb',
          theme_color: '#3aa6dd',
          icons: [
            { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
            { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
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
