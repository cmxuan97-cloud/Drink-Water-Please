import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ContainerPicker from '../components/ContainerPicker';
import { Container } from '../types';
import { addEntry, getContainers, newId } from '../lib/storage';
import { compressImage, estimateFill, type FillEstimate } from '../lib/vision';

type Mode = 'direct' | 'photo' | 'manual';

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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cs = getContainers();
    setContainers(cs);
    if (cs.length > 0) setSelected(cs[0]);
  }, []);

  const photoMl = selected ? Math.round((selected.capacityMl * fillPct) / 100) : 0;
  const directMl = selected?.capacityMl ?? 0;
  const finalMl =
    mode === 'direct' ? directMl :
    mode === 'photo' ? photoMl :
    Math.max(0, parseInt(manualMl, 10) || 0);

  const onPickFile = async (file: File) => {
    if (!selected) return;
    setError(null);
    setEstimate(null);
    setAnalyzing(true);
    try {
      const dataUrl = await compressImage(file, 800, 0.78);
      setPhotoUrl(dataUrl);
      const est = await estimateFill(dataUrl, selected.name, selected.capacityMl);
      setEstimate(est);
      setFillPct(est.fillPercent);
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

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
        <h1 className="page-title">加水</h1>
        <span style={{ width: 48 }} />
      </header>

      <section className="card">
        <div className="label">选容器</div>
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
                📷 打开相机拍一张
              </button>
            )}
            {photoUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <img src={photoUrl} alt="" style={{ width: '100%', borderRadius: 12, maxHeight: 280, objectFit: 'cover' }} />
                {analyzing && <div className="muted">AI 分析中…</div>}
                {estimate && (
                  <div className="muted" style={{ fontSize: 13 }}>
                    AI 估计水位 {estimate.fillPercent}% · 置信度 {estimate.confidence}
                    {estimate.note ? ` · ${estimate.note}` : ''}
                  </div>
                )}
                <div>
                  <div className="row-between">
                    <span className="muted" style={{ fontSize: 13 }}>水位</span>
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
                <div style={{ fontSize: 28, fontWeight: 700 }}>{photoMl} ml</div>
                <button className="btn btn-secondary" onClick={() => { setPhotoUrl(null); setEstimate(null); fileRef.current?.click(); }}>
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
                <button key={v} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 14 }} onClick={() => setManualMl(String(v))}>
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
    </div>
  );
}
