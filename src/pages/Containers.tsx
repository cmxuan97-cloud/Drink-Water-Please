import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container } from '../types';
import { getContainers, newId, saveContainers } from '../lib/storage';

const EMOJIS = ['🥛', '☕', '💧', '🍵', '🥤', '🍶', '🧋', '🫗'];

export default function Containers() {
  const navigate = useNavigate();
  const [list, setList] = useState<Container[]>([]);
  const [name, setName] = useState('');
  const [cap, setCap] = useState('');
  const [emoji, setEmoji] = useState('🥤');

  useEffect(() => {
    setList(getContainers());
  }, []);

  const commit = (next: Container[]) => {
    saveContainers(next);
    setList(next);
  };

  const onAdd = () => {
    const c = parseInt(cap, 10);
    if (!name.trim() || !Number.isFinite(c) || c <= 0) return;
    commit([...list, { id: newId(), name: name.trim(), capacityMl: c, emoji }]);
    setName('');
    setCap('');
    setEmoji('🥤');
  };

  const onDelete = (id: string) => {
    if (list.length <= 1) return;
    commit(list.filter((c) => c.id !== id));
  };

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
        <h1 className="page-title">容器</h1>
        <span style={{ width: 48 }} />
      </header>

      <section className="card">
        <div className="label">添加容器</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            className="input"
            placeholder="名称 (如 茶杯)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="容量 ml"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
          <div>
            <div className="label">表情</div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  className="btn-secondary"
                  style={{
                    padding: 8,
                    width: 42,
                    height: 42,
                    fontSize: 22,
                    borderRadius: 10,
                    border: `2px solid ${emoji === e ? 'var(--accent)' : 'var(--line)'}`,
                    background: emoji === e ? 'var(--accent-soft)' : 'var(--bg-card)',
                  }}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <button className="btn" onClick={onAdd}>+ 添加</button>
        </div>
      </section>

      <section>
        <div className="label" style={{ paddingLeft: 4 }}>已有容器</div>
        <div className="list">
          {list.map((c) => (
            <div key={c.id} className="list-item">
              <div style={{ fontSize: 24 }}>{c.emoji ?? '🥤'}</div>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>{c.capacityMl} ml</div>
              </div>
              <button
                className="btn-danger"
                onClick={() => onDelete(c.id)}
                disabled={list.length <= 1}
                style={{ opacity: list.length <= 1 ? 0.3 : 1 }}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
