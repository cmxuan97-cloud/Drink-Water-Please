import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '../types';
import { addEntry, getContainers, newId } from '../lib/storage';
import { compressImage, estimateFill, type FillEstimate } from '../lib/vision';

const CATEGORY_EMOJI: Record<string, string> = {
  water: '💧',
  coffee: '☕',
  tea: '🍵',
  juice: '🧃',
  soda: '🥤',
  milk: '🥛',
  other: '🥤',
};

const STEP_MS = 50;

export default function Add() {
  const navigate = useNavigate();
  const [containers, setContainers] = useState<Container[]>([]);
  const [selected, setSelected] = useState<Container | null>(null);

  // 主输入：用户手动输入的 ml
  const [inputMl, setInputMl] = useState<number>(250);

  // 拍照流相关
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<FillEstimate | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [fillPct, setFillPct] = useState<number>(50);
  const [pickedSizeIndex, setPickedSizeIndex] = useState<number>(0);
  const [manualCapacityMl, setManualCapacityMl] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cs = getContainers();
    setContainers(cs);
    if (cs.length > 0) {
      setSelected(cs[0]);
      setInputMl(cs[0].capacityMl);
    }
  }, []);

  // 切换饮料类型 → 默认 ml 跟着换（用户已经手动改过的话不覆盖）
  const onPickContainer = (c: Container) => {
    setSelected(c);
    setInputMl(c.capacityMl);
  };

  // 拍照模式下当前用的总容量：优先用户手动 > 选中尺寸 > AI 估算
  const photoCapacityMl = useMemo(() => {
    if (manualCapacityMl !== null) return manualCapacityMl;
    const det = estimate?.detected;
    if (det && det.sizes.length > 0) {
      return det.sizes[Math.min(pickedSizeIndex, det.sizes.length - 1)]?.capacityMl ?? 0;
    }
    return det?.estimatedCapacityMl ?? selected?.capacityMl ?? 0;
  }, [manualCapacityMl, estimate, pickedSizeIndex, selected]);

  const photoMl = Math.round((photoCapacityMl * fillPct) / 100);

  // 当前最终 ml
  const finalMl = photoUrl ? photoMl : Math.max(0, inputMl);

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

  const exitPhoto = () => {
    setPhotoUrl(null);
    setEstimate(null);
    setManualCapacityMl(null);
    setPickedSizeIndex(0);
    if (fileRef.current) fileRef.current.value = '';
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
      photoDataUrl: photoUrl ?? undefined,
      estimatedFill: photoUrl && estimate ? estimate.fillPercent : undefined,
    });
    navigate('/');
  };

  const det = estimate?.detected;
  const QUICK = [100, 200, 350, 500];

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <h1 className="page-title">加一杯水</h1>
        <span style={{ width: 40 }} />
      </header>

      {/* 1. 喝的什么 — 横向滑动 chip 排，紧凑 */}
      <div className="drink-row" role="tablist" aria-label="选择饮料类型">
        {containers.map((c) => {
          const active = c.id === selected?.id;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={active}
              className={active ? 'drink-chip drink-chip-active' : 'drink-chip'}
              onClick={() => onPickContainer(c)}
            >
              <span style={{ fontSize: 20 }}>{c.emoji ?? '🥤'}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
            </button>
          );
        })}
      </div>

      {/* 2. 主输入区 */}
      {!photoUrl ? (
        <section className="card hero-card">
          <div className="muted" style={{ fontSize: 12, textAlign: 'center', marginBottom: 8 }}>
            喝了多少
          </div>

          <div className="hero-amount">
            <button
              className="amt-btn"
              onClick={() => setInputMl(Math.max(0, inputMl - STEP_MS))}
              aria-label="减少"
            >−</button>
            <div className="amt-display">
              <input
                className="amt-input"
                type="number"
                inputMode="numeric"
                value={inputMl}
                onChange={(e) => setInputMl(Math.max(0, parseInt(e.target.value, 10) || 0))}
              />
              <span className="amt-unit">ml</span>
            </div>
            <button
              className="amt-btn"
              onClick={() => setInputMl(inputMl + STEP_MS)}
              aria-label="增加"
            >+</button>
          </div>

          <div className="quick-chips">
            {QUICK.map((v) => (
              <button
                key={v}
                className={inputMl === v ? 'qc qc-active' : 'qc'}
                onClick={() => setInputMl(v)}
              >
                {v}
              </button>
            ))}
            {selected && (
              <button
                className={inputMl === selected.capacityMl ? 'qc qc-active' : 'qc'}
                onClick={() => setInputMl(selected.capacityMl)}
              >
                整杯 {selected.capacityMl}
              </button>
            )}
          </div>

          {/* 拍照入口 — 不是单独 mode，是个 enhancement */}
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
          <button
            className="photo-cta"
            onClick={() => fileRef.current?.click()}
          >
            <span style={{ fontSize: 18 }}>📷</span>
            <span>拍一张让 AI 帮我算</span>
          </button>
        </section>
      ) : (
        // === 拍照流：照片 + 识别面板 + 尺寸 picker + 液面 slider ===
        <section className="card">
          <img
            src={photoUrl}
            alt=""
            style={{ width: '100%', borderRadius: 12, maxHeight: 240, objectFit: 'cover' }}
          />

          {analyzing && (
            <div className="muted" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="spinner" /> AI 在认饮料和量容量…
            </div>
          )}

          {det && (
            <div className="detect-panel" style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>{CATEGORY_EMOJI[det.category] ?? '🥤'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, opacity: 0.65, fontWeight: 600, letterSpacing: 0.5 }}>
                    {det.isCommon ? '识别到' : '不太认识，目测是'}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{det.label}</div>
                </div>
              </div>

              {det.sizes.length > 0 && manualCapacityMl === null && (
                <div style={{ marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>选尺寸</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {det.sizes.map((s, i) => {
                      const active = i === pickedSizeIndex;
                      return (
                        <button
                          key={i}
                          onClick={() => setPickedSizeIndex(i)}
                          className={active ? 'size-pill size-pill-active' : 'size-pill'}
                        >
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</span>
                          <span style={{ fontSize: 10, opacity: 0.85 }}>{s.capacityMl} ml</span>
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setManualCapacityMl(det.estimatedCapacityMl || 250)}
                      className="size-pill"
                      style={{ fontSize: 11 }}
                    >
                      自定义
                    </button>
                  </div>
                </div>
              )}

              {(det.sizes.length === 0 || manualCapacityMl !== null) && (
                <div style={{ marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
                    {det.sizes.length === 0 ? '不是连锁品牌 — 你填总容量' : '自定义总容量'}
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
                    <span className="muted" style={{ fontSize: 12 }}>ml</span>
                    {det.sizes.length > 0 && (
                      <button
                        onClick={() => setManualCapacityMl(null)}
                        className="size-pill"
                        style={{ fontSize: 11 }}
                      >
                        用尺寸
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 液面 slider */}
          {!analyzing && (
            <div style={{ marginTop: 14 }}>
              <div className="row-between">
                <span className="muted" style={{ fontSize: 12 }}>液面高度</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{fillPct}%</span>
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
          )}

          {/* 算出来的 ml */}
          {!analyzing && (
            <div className="result-card">
              <div className="muted" style={{ fontSize: 11 }}>
                {photoCapacityMl} ml × {fillPct}%
              </div>
              <div className="result-num">{photoMl} ml</div>
            </div>
          )}

          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <button className="btn-pill btn-full" onClick={() => fileRef.current?.click()}>
              📷 重拍
            </button>
            <button className="btn-pill btn-full" onClick={exitPhoto}>
              ← 回到手动
            </button>
          </div>
        </section>
      )}

      {error && <div className="warn" style={{ margin: '0 4px' }}>{error}</div>}

      <div className="fab">
        <button className="btn btn-full" onClick={onSave} disabled={finalMl <= 0}>
          保存 · {finalMl} ml
        </button>
      </div>

      <style>{`
        /* 横向滑动饮料 chip */
        .drink-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 4px 4px 8px;
          margin: 0 -4px;
          scrollbar-width: none;
        }
        .drink-row::-webkit-scrollbar { display: none; }
        .drink-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: var(--bg-card);
          border-radius: 999px;
          border: 1.5px solid transparent;
          flex-shrink: 0;
          transition: border-color 0.15s, background 0.15s;
        }
        .drink-chip-active {
          background: var(--accent-soft);
          border-color: var(--accent);
        }

        /* hero ml 输入 */
        .hero-card { padding: 22px 18px 18px; }
        .hero-amount {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 14px;
        }
        .amt-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--bg-card);
          border: 1.5px solid var(--line);
          font-size: 26px;
          font-weight: 600;
          color: var(--accent-deep);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .amt-btn:active { background: var(--accent-soft); }
        .amt-display {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .amt-input {
          font-size: 44px;
          font-weight: 800;
          letter-spacing: -0.02em;
          width: 130px;
          text-align: center;
          background: transparent;
          border: none;
          color: var(--text);
          padding: 0;
          line-height: 1;
        }
        .amt-input:focus { outline: none; }
        .amt-input::-webkit-inner-spin-button,
        .amt-input::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .amt-unit {
          font-size: 16px;
          color: var(--text-soft);
          font-weight: 500;
        }

        .quick-chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .qc {
          padding: 8px 14px;
          background: var(--bg-card);
          border-radius: 999px;
          border: 1.5px solid transparent;
          font-size: 13px;
          font-weight: 500;
          color: var(--text);
          transition: border-color 0.15s, background 0.15s;
        }
        .qc-active {
          background: var(--accent-soft);
          border-color: var(--accent);
          color: var(--accent-deep);
          font-weight: 600;
        }

        .photo-cta {
          margin-top: 18px;
          width: 100%;
          padding: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 1.5px dashed rgba(14, 125, 204, 0.4);
          border-radius: 14px;
          font-size: 14px;
          font-weight: 600;
          color: var(--accent-deep);
          transition: background 0.15s, border-color 0.15s;
        }
        .photo-cta:active {
          background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
          border-color: var(--accent);
        }

        /* 识别面板 */
        .detect-panel {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-radius: 14px;
          padding: 12px 14px;
          border: 1px solid rgba(14, 125, 204, 0.15);
        }
        .size-pill {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 6px 10px;
          background: rgba(255,255,255,0.7);
          border: 1.5px solid transparent;
          border-radius: 10px;
          min-width: 56px;
          gap: 1px;
        }
        .size-pill-active {
          background: var(--accent);
          color: white;
          border-color: var(--accent);
        }

        .result-card {
          margin-top: 14px;
          background: var(--bg-card);
          border-radius: 12px;
          padding: 12px 14px;
          text-align: center;
        }
        .result-num {
          font-size: 28px;
          font-weight: 800;
          color: var(--accent-deep);
          letter-spacing: -0.01em;
          margin-top: 2px;
        }

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
