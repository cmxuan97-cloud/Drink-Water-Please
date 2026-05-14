// 公共公园 — 复用 Park.tsx 的整套动画场景，但精灵列表是「我 + 朋友们的 companion」
// 跟 /park（私人公园 = 我的解锁动物）不同。点击朋友的动物会弹底部互动抽屉。
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserSearch } from 'lucide-react';
import Park from './Park';
import { fetchFriends, type Friend } from '../lib/social';
import { getCurrentUsername } from '../lib/auth';

export default function CommunityPark() {
  const navigate = useNavigate();
  const username = useMemo(() => getCurrentUsername(), []);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!username) { setBusy(false); return; }
    void (async () => {
      const r = await fetchFriends();
      if (r.error) setErr(r.error);
      setFriends(r.friends ?? []);
      setBusy(false);
    })();
  }, [username]);

  // 未注册账号 — 引导去注册
  if (!username) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
          <h1 className="page-title">公共公园</h1>
          <span style={{ width: 48 }} />
        </header>
        <div className="card-tinted card-sky" style={{ marginTop: 16, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>登录后才能进公共公园</div>
          <button
            className="btn btn-full"
            style={{ marginTop: 12 }}
            onClick={() => navigate('/settings?register=1&from=friends')}
          >
            去注册
          </button>
        </div>
      </div>
    );
  }

  if (busy) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
          <h1 className="page-title">公共公园</h1>
          <span style={{ width: 48 }} />
        </header>
        <div className="muted" style={{ textAlign: 'center', padding: 24 }}>加载中…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
          <h1 className="page-title">公共公园</h1>
          <span style={{ width: 48 }} />
        </header>
        <div className="warn" style={{ fontSize: 13, marginTop: 12 }}>{err}</div>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
          <h1 className="page-title">公共公园</h1>
          <span style={{ width: 48 }} />
        </header>
        <div className="card-tinted card-sky" style={{ textAlign: 'center', padding: 22, marginTop: 16 }}>
          <UserSearch size={36} strokeWidth={1.5} style={{ marginBottom: 8, color: 'var(--accent-deep)' }} />
          <div style={{ fontWeight: 700, fontSize: 15 }}>公园里还没有朋友</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            加几个好友，他们的小伙伴会出现在这里
          </div>
          <button
            className="btn"
            style={{ marginTop: 14 }}
            onClick={() => navigate('/friends')}
          >
            去找朋友 →
          </button>
        </div>
      </div>
    );
  }

  // 直接复用 Park 的整个动画场景
  return <Park mode="community" friends={friends} />;
}
