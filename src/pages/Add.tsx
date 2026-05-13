import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ContainerPicker from '../components/ContainerPicker';
import { Container } from '../types';
import { addEntry, getContainers, newId } from '../lib/storage';
import { compressImage, estimateFill, type FillEstimate } from '../lib/vision';

type Mode = 'direct' | 'photo' | 'manual';

const CATEGORY_EMOJI: Record<string, string> = {
  water: '💧',
  coffee: '☕',
  tea: '🍵',
  juice: '🧃',
  soda: '🥤',
  milk: '🥛',
  other: '🥤',
};

export default function Add() {
  const navigate = useNavigate();
  const [containers, setContainers] = useState<Container[]>([]);
  const [selected, setSelected] = useState<Container | null>(null);
  const [mode, setMode] = useState<Mode>('direct');
  const [manualMl, setManualMl] = useState<string>('250');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [fillPct, setFillPct] = useState<number>(50);
  const [estimate, setEstimate] = useState<FillEstimate | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // 用户在识别面板里挑的尺寸（覆盖 mostLikelyIndex）
  const [pickedSizeIndex, setPickedSizeIndex] = useState<number>(0);
  // 当 sizes=[] 或 用户点「我自己输入」时，手动指定的容量
  const [manualCapacityMl, setManualCapacityMl] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cs = getContainers();
    setContainers(cs);
    if (cs.length > 0) setSelected(cs[0]);
  }, []);

  // 拍照模式下当前用的容量：优先 manualCapacityMl > 选中尺寸 > AI 估算 > selected
  const photoCapacityMl = useMemo(() => {
    if (manualCapacityMl !== null) return manualCapacityMl;
    const det = estimate?.detected;
    if (det && det.sizes.length > 0) {
      const size = det.sizes[Math.min(pickedSizeIndex, det.sizes.length - 1)];
      if (size) return size.capacityMl;
    }
    if (det?.estimatedCapacityMl) return det.estimatedCapacityMl;
    return selected?.capacityMl ?? 0;
  }, [manualCapacityMl, estimate, pickedSizeIndex, selected]);

  const photoMl = Math.round((photoCapacityMl * fillPct) / 100);
  const directMl = selected?.capacityMl ?? 0;
  const finalMl =
    mode === 'direct' ? directMl :
    mode === 'photo' ? photoMl :
    Math.max(0, parseInt(manualMl, 10) || 0);

  const onPickFile = async (file: File) => {
    setError(null);
    setEstimate(null);
    setManualCapacityMl(null);
    setPickedSizeIndex(0);
    setAnalyzing(true);
    try {
      const dataUrl = await compressImage(file, 800, 0.78);
      setPhotoUrl(dataUrl);
      const est = await estimateFill(dataUrl, selected?.name, selected?.capacityMl);
      setEstimate(est);
      setFillPct(est.fillPercent);
      if (est.detected && est.detected.sizes.length > 0) {
        setPickedSizeIndex(est.detected.mostLikelyIndex);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setFillPct(50);
    } finally {
      setAnalyzing(false);
    }
  };

  const onSave = () => {
    if (finalMl <= 0) {
      setError('请输入大于 0 的水量');
      return;
    }
    addEntry({
      id: newId(),
      ts: Date.now(),
      ml: finalMl,
      containerId: selected?.id,
      photoDataUrl: mode === 'photo' ? photoUrl ?? undefined : undefined,
      estimatedFill: mode === 'photo' && estimate ? estimate.fillPercent : undefined,
    });
    navigate('/');
  };

  const det = estimate?.detected;

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
        <h1 className="page-title">加水</h1>
        <span style={{ width: 48 }} />
      </header>

      {/* 选容器：拍照模式下只是 hint，不强制 */}
      <section className="card">
        <div className="label">
          {mode === 'photo' ? '已存容器（可选 — 给 AI 当 hint）' : '选容器'}
        </div>
        <ContainerPicker
          containers={containers}
          selectedId={selected?.id}
          onSelect={(c) => setSelected(c)}
        />
      </section>

      <section className="card">
        <div className="label">输入方式</div>
        <div className="row" style={{ gap: 8 }}>
          <button
            className={`btn-pill btn-full${mode === 'direct' ? ' btn-pill-active' : ''}`}
            onClick={() => setMode('direct')}
          >直接记</button>
          <button
            className={`btn-pill btn-full${mode === 'photo' ? ' btn-pill-active' : ''}`}
            onClick={() => setMode('photo')}
          >📷 拍照</button>
          <button
            className={`btn-pill btn-full${mode === 'manual' ? ' btn-pill-active' : ''}`}
            onClick={() => setMode('manual')}
          >手动</button>
        </div>

        <div className="divider" />

        {mode === 'direct' && (
          <div>
            <div className="muted" style={{ fontSize: 13 }}>记一整杯</div>
            <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>{directMl} ml</div>
          </div>
        )}

        {mode === 'photo' && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPickFile(f);
                e.target.value = '';
              }}
            />
            {!photoUrl && (
              <button className="btn btn-ghost btn-full" onClick={() => fileRef.current?.click()}>
                📷 拍一张你手上的杯子/瓶子
              </button>
            )}
            {photoUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <img
                  src={photoUrl}
                  alt=""
                  style={{ width: '100%', borderRadius: 12, maxHeight: 280, objectFit: 'cover' }}
                />
                {analyzing && (
                  <div className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="spinner" /> AI 在认饮料和量容量…
                  </div>
                )}

                {/* 识别结果面板 */}
                {det && (
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                      borderRadius: 16,
                      padding: '14px 16px',
                      border: '1px solid rgba(14, 125, 204, 0.15)',
                    }}
                  >
                    <div className="row-between" style={{ marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 22 }}>{CATEGORY_EMOJI[det.category] ?? '🥤'}</span>
                        <div>
                          <div style={{ fontSize: 11, opacity: 0.6, fontWeight: 600, letterSpacing: 0.5 }}>
                            {det.isCommon ? '识别到' : '不太认识，目测'}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{det.label}</div>
                        </div>
                      </div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        置信度 {estimate?.confidence}
                      </div>
                    </div>

                    {/* 尺寸 picker */}
                    {det.sizes.length > 0 && manualCapacityMl === null && (
                      <div style={{ marginTop: 12 }}>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                          选尺寸（默认是 AI 觉得最像的那个）
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {det.sizes.map((s, i) => {
                            const active = i === pickedSizeIndex;
                            return (
                              <button
                                key={i}
                                onClick={() => setPickedSizeIndex(i)}
                                className={active ? 'btn-pill btn-pill-active' : 'btn-pill'}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  padding: '8px 12px',
                                  background: active ? undefined : 'rgba(255,255,255,0.7)',
                                  minWidth: 72,
                                }}
                              >
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</span>
                                <span style={{ fontSize: 11, opacity: 0.85 }}>{s.capacityMl} ml</span>
                              </button>
                            );
                          })}
                          <button
                            onClick={() => setManualCapacityMl(det.estimatedCapacityMl || 250)}
                            className="btn-pill"
                            style={{
                              padding: '8px 12px',
                              background: 'rgba(255,255,255,0.7)',
                              fontSize: 12,
                            }}
                          >
                            自定义 ml
                          </button>
                        </div>
                      </div>
                    )}

                    {/* sizes=[] 或 用户选了「自定义」 → 直接输入 ml */}
                    {(det.sizes.length === 0 || manualCapacityMl !== null) && (
                      <div style={{ marginTop: 12 }}>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                          {det.sizes.length === 0 ? '不是连锁品牌 — 你手动填容量' : '自定义容量'}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            className="input"
                            type="number"
                            inputMode="numeric"
                            value={manualCapacityMl ?? det.estimatedCapacityMl}
                            onChange={(e) => setManualCapacityMl(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            style={{ flex: 1 }}
                          />
                          <span className="muted" style={{ fontSize: 13 }}>ml 总容量</span>
                          {det.sizes.length > 0 && (
                            <button
                              onClick={() => setManualCapacityMl(null)}
                              className="btn-pill"
                              style={{ padding: '6px 10px', fontSize: 11 }}
                            >
                              用尺寸
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 水位 slider — AI 估的，可拖 */}
                <div>
                  <div className="row-between">
                    <span className="muted" style={{ fontSize: 13 }}>液面高度</span>
                    <span style={{ fontWeight: 600 }}>{fillPct}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={fillPct}
                    onChange={(e) => setFillPct(parseInt(e.target.value, 10))}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* 算出来的 ml — 大字突出 */}
                <div
                  style={{
                    background: 'var(--bg-card)',
                    borderRadius: 14,
                    padding: '14px 16px',
                    textAlign: 'center',
                  }}
                >
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                    {photoCapacityMl} ml × {fillPct}%
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--accent-deep)' }}>
                    {photoMl} ml
                  </div>
                </div>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setPhotoUrl(null);
                    setEstimate(null);
                    setManualCapacityMl(null);
                    setPickedSizeIndex(0);
                    fileRef.current?.click();
                  }}
                >
                  重拍
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'manual' && (
          <div>
            <label className="label">水量 (ml)</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={manualMl}
              onChange={(e) => setManualMl(e.target.value)}
            />
            <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
              {[100, 200, 300, 500].map((v) => (
                <button
                  key={v}
                  className="btn btn-secondary"
                  style={{ padding: '8px 14px', fontSize: 14 }}
                  onClick={() => setManualMl(String(v))}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <div className="warn" style={{ marginTop: 12 }}>{error}</div>}
      </section>

      <div className="fab">
        <button className="btn btn-full" onClick={onSave} disabled={finalMl <= 0}>
          保存 · {finalMl} ml
        </button>
      </div>

      <style>{`
        .spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(14, 125, 204, 0.3);
          border-top-color: #0e7dcc;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
