import { Container, Entry } from '../types';

type Props = {
  entries: Entry[];
  containers: Container[];
  onDelete?: (id: string) => void;
};

const fmtTime = (ts: number): string => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function EntryList({ entries, containers, onDelete }: Props) {
  if (entries.length === 0) {
    return <div className="muted" style={{ textAlign: 'center', padding: 16 }}>今天还没喝水，快加一杯</div>;
  }
  const byId = new Map(containers.map((c) => [c.id, c]));
  return (
    <div className="list">
      {entries.map((e) => {
        const c = e.containerId ? byId.get(e.containerId) : undefined;
        return (
          <div key={e.id} className="list-item">
            <div style={{ fontSize: 22 }} aria-hidden>{c?.emoji ?? '💧'}</div>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{e.ml} ml</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {fmtTime(e.ts)}
                {c ? ` · ${c.name}` : ''}
                {typeof e.estimatedFill === 'number' ? ` · AI 估 ${e.estimatedFill}%` : ''}
              </div>
            </div>
            {e.photoDataUrl && (
              <img src={e.photoDataUrl} alt="" width={36} height={36} style={{ borderRadius: 8, objectFit: 'cover' }} />
            )}
            {onDelete && (
              <button className="btn-danger" style={{ padding: 6, fontSize: 14 }} onClick={() => onDelete(e.id)}>
                删
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
