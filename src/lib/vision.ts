export type FillEstimate = {
  fillPercent: number;
  confidence: 'low' | 'medium' | 'high';
  note?: string;
};

export const estimateFill = async (
  imageDataUrl: string,
  containerName: string,
  capacityMl: number,
): Promise<FillEstimate> => {
  const match = imageDataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) throw new Error('图片格式无效');
  const [, mimeType, data] = match;

  const resp = await fetch('/api/estimate-fill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, mimeType, containerName, capacityMl }),
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

  const parsed = (await resp.json()) as Partial<FillEstimate>;
  const fillPercent = Math.max(0, Math.min(100, Math.round(Number(parsed.fillPercent ?? 0))));
  const confidence: FillEstimate['confidence'] =
    parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low';
  return { fillPercent, confidence, note: parsed.note };
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
