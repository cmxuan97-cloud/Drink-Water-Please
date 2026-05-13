export type DetectedSize = {
  label: string;
  capacityMl: number;
};

export type Detected = {
  label: string;             // 短描述，如「麦当劳大杯可口可乐」
  brand: string | null;      // 「麦当劳」或 null
  category: 'water' | 'coffee' | 'tea' | 'juice' | 'soda' | 'milk' | 'other';
  isCommon: boolean;         // 是否能识别为已知品牌商品（决定要不要显示尺寸 picker）
  sizes: DetectedSize[];     // 该品牌官方常见尺寸；自带容器为 []
  mostLikelyIndex: number;   // sizes 数组里最像图中那杯的 index
  estimatedCapacityMl: number; // 模型目测的容量，sizes 为空时回退用
};

export type FillEstimate = {
  fillPercent: number;
  confidence: 'low' | 'medium' | 'high';
  detected?: Detected;
  note?: string;
};

const sanitizeDetected = (raw: unknown): Detected | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const sizesRaw = Array.isArray(r.sizes) ? r.sizes : [];
  const sizes: DetectedSize[] = sizesRaw
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const o = s as Record<string, unknown>;
      const cap = Number(o.capacityMl);
      const label = typeof o.label === 'string' ? o.label : '';
      if (!label || !Number.isFinite(cap) || cap <= 0) return null;
      return { label, capacityMl: Math.round(cap) };
    })
    .filter((x): x is DetectedSize => x !== null);

  const validCats = ['water', 'coffee', 'tea', 'juice', 'soda', 'milk', 'other'] as const;
  const cat = validCats.includes(r.category as never) ? (r.category as Detected['category']) : 'other';

  const estCap = Math.max(0, Math.round(Number(r.estimatedCapacityMl ?? 0)));
  const idxRaw = Math.round(Number(r.mostLikelyIndex ?? 0));
  const mostLikelyIndex = sizes.length > 0
    ? Math.max(0, Math.min(sizes.length - 1, idxRaw))
    : 0;

  return {
    label: typeof r.label === 'string' ? r.label : '未识别',
    brand: typeof r.brand === 'string' && r.brand.length > 0 ? r.brand : null,
    category: cat,
    isCommon: !!r.isCommon,
    sizes,
    mostLikelyIndex,
    estimatedCapacityMl: estCap || 250,
  };
};

export const estimateFill = async (
  imageDataUrl: string,
  hintContainerName?: string,
  hintCapacityMl?: number,
): Promise<FillEstimate> => {
  const match = imageDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) throw new Error('图片格式无效');
  const [, mimeType, data] = match;

  const resp = await fetch('/api/estimate-fill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, mimeType, hintContainerName, hintCapacityMl }),
  });

  if (!resp.ok) {
    let msg = `估算失败 (${resp.status})`;
    try {
      const err = (await resp.json()) as { error?: string };
      if (err.error) msg = err.error;
    } catch {
      // ignore parse error
    }
    throw new Error(msg);
  }

  const parsed = (await resp.json()) as Partial<FillEstimate> & { detected?: unknown };
  const fillPercent = Math.max(0, Math.min(100, Math.round(Number(parsed.fillPercent ?? 0))));
  const confidence: FillEstimate['confidence'] =
    parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low';
  return {
    fillPercent,
    confidence,
    detected: sanitizeDetected(parsed.detected),
    note: parsed.note,
  };
};

export const compressImage = (file: File, maxSide = 800, quality = 0.8): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('解码图片失败'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas 不可用'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
