import { Container } from '../types';

type Props = {
  containers: Container[];
  selectedId?: string;
  onSelect: (c: Container) => void;
};

export default function ContainerPicker({ containers, selectedId, onSelect }: Props) {
  return (
    <div className="cp-grid">
      {containers.map((c) => {
        const selected = c.id === selectedId;
        return (
          <button
            key={c.id}
            type="button"
            className={`cp-item${selected ? ' cp-item-selected' : ''}`}
            onClick={() => onSelect(c)}
          >
            <div className="cp-emoji">{c.emoji ?? '🥤'}</div>
            <div className="cp-name">{c.name}</div>
            <div className="cp-cap">{c.capacityMl} ml</div>
          </button>
        );
      })}
      <style>{`
        .cp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
          gap: 10px;
        }
        .cp-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 14px 8px;
          background: var(--bg-card);
          border: 2px solid var(--line);
          border-radius: 14px;
          transition: border-color 0.15s, background 0.15s;
        }
        .cp-item-selected {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .cp-emoji {
          font-size: 28px;
          line-height: 1;
        }
        .cp-name {
          font-size: 14px;
          font-weight: 500;
        }
        .cp-cap {
          font-size: 12px;
          color: var(--text-soft);
        }
      `}</style>
    </div>
  );
}
