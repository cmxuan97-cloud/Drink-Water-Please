import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell, Cloud, Copy, Droplet, LogIn, Moon, RotateCcw,
  Scale, Smartphone, Sparkles, User, UserPlus,
  CupSoda, AlertCircle, Check, PawPrint,
} from 'lucide-react';
import { DEFAULT_SETTINGS, NotifyMode, Settings as TSettings } from '../types';
import { getCompletedDays, getOrCreateClientId, getSettings, saveSettings } from '../lib/storage';
import { dailyGoalMl } from '../lib/goal';
import {
  disablePush,
  enablePush,
  getCurrentSubscription,
  isPushSupported,
  setNotifyMode,
  syncSettingsToServer,
} from '../lib/push';
import { cachedBackupCode, forceSyncNow, getOrFetchBackupCode, lastSyncAt, restoreFromCode } from '../lib/sync';
import {
  getCurrentDisplayName,
  getCurrentUsername,
  login as authLogin,
  logout as authLogout,
  register as authRegister,
} from '../lib/auth';
import { ANIMALS } from '../data/animals';
import { ensureUnlockedMigration } from '../lib/storage';

const NOTIFY_MODES: Array<{ value: NotifyMode; label: string; sub: string }> = [
  { value: 'easy', label: '轻松', sub: '90 min' },
  { value: 'standard', label: '标准', sub: '60 min' },
  { value: 'frequent', label: '频繁', sub: '30 min' },
  { value: 'smart', label: '智能', sub: '按进度' },
];

const hourToTime = (h: number): string => `${String(h).padStart(2, '0')}:00`;
const timeToHour = (t: string): number => {
  const [h] = t.split(':');
  const n = parseInt(h, 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(23, n)) : 0;
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const fromFriends = search.get('from') === 'friends';
  const wantRegister = search.get('register') === '1';
  const accountCardRef = useRef<HTMLDivElement | null>(null);
  const [s, setS] = useState<TSettings>(DEFAULT_SETTINGS);
  const [perm, setPerm] = useState<NotificationPermission>('default');
  const [isStandalone, setIsStandalone] = useState(false);
  const [expandedKey, setExpandedKey] = useState<'weight' | 'sleep' | null>(null);

  const [unlockedCount, setUnlockedCount] = useState(1);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  // 账号
  const [authUsername, setAuthUsername] = useState<string | null>(null);
  const [authDisplayName, setAuthDisplayName] = useState<string | null>(null);
  const [showAuthPanel, setShowAuthPanel] = useState<'none' | 'register' | 'login'>('none');
  // 「账号」整张卡片默认收起，点了才展开里面所有控件
  const [accountExpanded, setAccountExpanded] = useState(false);
  // 「云备份」整张卡片默认收起
  const [backupExpanded, setBackupExpanded] = useState(false);
  // 「频率 picker」默认收起，点了才展开 4 个 pill
  const [freqExpanded, setFreqExpanded] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 备份/恢复
  const [backupId, setBackupId] = useState('');
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [shortCodeBusy, setShortCodeBusy] = useState(false);
  const [shortCodeError, setShortCodeError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [lastSyncMin, setLastSyncMin] = useState<number | null>(null);
  const [showRestore, setShowRestore] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // 深链：?register=1 → 自动展开账号卡 + 打开注册面板 + 滚到那里
  useEffect(() => {
    if (!wantRegister) return;
    if (getCurrentUsername()) return; // 已登录就跳过
    setAccountExpanded(true);
    setShowAuthPanel('register');
    // 等下一个 frame 让 DOM 渲染完再滚
    requestAnimationFrame(() => {
      accountCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [wantRegister]);

  useEffect(() => {
    setS(getSettings());
    if ('Notification' in window) setPerm(Notification.permission);
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    const days = getCompletedDays().length;
    setUnlockedCount(ensureUnlockedMigration(days, ANIMALS.map((a) => a.id)).length);
    if (isPushSupported()) {
      getCurrentSubscription().then((sub) => setPushEnabled(!!sub));
    }
    setBackupId(getOrCreateClientId());
    setAuthUsername(getCurrentUsername());
    setAuthDisplayName(getCurrentDisplayName());
    const last = lastSyncAt();
    setLastSyncMin(last ? Math.round((Date.now() - last) / 60000) : null);
    // 短码：先看本地缓存，没有就异步去拉
    const cached = cachedBackupCode();
    if (cached) setShortCode(cached);
    else {
      setShortCodeBusy(true);
      void getOrFetchBackupCode().then((r) => {
        if (r.code) setShortCode(r.code);
        else setShortCodeError(r.error ?? null);
        setShortCodeBusy(false);
      });
    }
  }, []);

  const onRegisterFromSettings = async () => {
    setAuthMsg(null);
    setAuthBusy(true);
    const result = await authRegister(regUsername.trim(), regPassword, regUsername.trim());
    if (result.ok) {
      setAuthMsg('账号创建成功，刷新中…');
      setTimeout(() => window.location.reload(), 800);
    } else {
      setAuthMsg(`${result.error ?? '注册失败'}`);
      setAuthBusy(false);
    }
  };

  const onLoginFromSettings = async () => {
    setAuthMsg(null);
    setAuthBusy(true);
    const result = await authLogin(loginUsername.trim(), loginPassword);
    if (result.ok) {
      setAuthMsg('登录成功，刷新中…');
      setTimeout(() => window.location.reload(), 800);
    } else {
      setAuthMsg(`${result.error ?? '登录失败'}`);
      setAuthBusy(false);
    }
  };

  const onLogout = () => {
    if (!confirm('确定要登出？\n本地数据会清空（云端数据保留），下次登录可以拉回来。')) return;
    authLogout();
    window.location.reload();
  };

  const onCopyShortCode = async () => {
    if (!shortCode) return;
    try {
      await navigator.clipboard.writeText(shortCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setBackupMsg('复制失败 — 长按上面文字手动选');
    }
  };

  const onForceBackup = async () => {
    setBackupBusy(true);
    setBackupMsg(null);
    await forceSyncNow();
    const last = lastSyncAt();
    setLastSyncMin(last ? 0 : null);
    setBackupMsg('已备份到云端');
    setBackupBusy(false);
  };

  const onRestore = async () => {
    setBackupBusy(true);
    setBackupMsg(null);
    const result = await restoreFromCode(restoreCode);
    if (result.ok) {
      setBackupMsg('恢复成功，刷新页面应用…');
      setTimeout(() => window.location.reload(), 800);
    } else {
      setBackupMsg(`${result.error ?? '恢复失败'}`);
      setBackupBusy(false);
    }
  };

  const update = (patch: Partial<TSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(next);
    // 设置变了 → 同步到服务端（如果已订阅）
    if (pushEnabled && (patch.wakeHour !== undefined || patch.sleepHour !== undefined)) {
      syncSettingsToServer().catch(() => {});
    }
  };

  const onToggleNotif = async () => {
    setPushMsg(null);
    setPushBusy(true);
    try {
      if (!pushEnabled) {
        await enablePush();
        setPushEnabled(true);
        setPerm('granted');
        update({ notificationsEnabled: true });
        setPushMsg('已订阅，等下个整点会收到');
      } else {
        await disablePush();
        setPushEnabled(false);
        update({ notificationsEnabled: false });
        setPushMsg('已关闭推送');
      }
    } catch (e) {
      setPushMsg(e instanceof Error ? `${e.message}` : '操作失败');
    } finally {
      setPushBusy(false);
    }
  };

  const onPickMode = async (mode: NotifyMode) => {
    update({ notifyMode: mode });
    if (pushEnabled) {
      try {
        await setNotifyMode(mode);
        setPushMsg(`✅ 已切到「${NOTIFY_MODES.find((m) => m.value === mode)?.label}」`);
      } catch (e) {
        setPushMsg(e instanceof Error ? `${e.message}` : '切换失败');
      }
    }
  };


  const goal = dailyGoalMl(s.weightKg);

  return (
    <div className="page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← 返回</button>
        <h1 className="page-title">设置</h1>
        <span style={{ width: 48 }} />
      </header>

      {/* hero goal card */}
      <div className="card-tinted card-sky" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85 }}>每日饮水目标</div>
        <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, marginTop: 4 }}>
          {goal} ml
        </div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
          按 {s.weightKg} kg 体重自动算
        </div>
        <Droplet size={96} strokeWidth={1.5} style={{ position: 'absolute', right: -8, bottom: -8, opacity: 0.18 }} />
      </div>

      <div className="menu-group">
        <button
          className="menu-row"
          onClick={() => setExpandedKey(expandedKey === 'weight' ? null : 'weight')}
        >
          <span className="menu-icon"><Scale size={18} strokeWidth={2} /></span>
          <span className="menu-title">体重</span>
          <span className="menu-value">{s.weightKg} kg</span>
          <span className="menu-arrow">›</span>
        </button>

        <button
          className="menu-row"
          onClick={() => setExpandedKey(expandedKey === 'sleep' ? null : 'sleep')}
        >
          <span className="menu-icon"><Moon size={18} strokeWidth={2} /></span>
          <span className="menu-title">作息时间</span>
          <span className="menu-value">{hourToTime(s.wakeHour)} – {hourToTime(s.sleepHour)}</span>
          <span className="menu-arrow">›</span>
        </button>

        <button
          className="menu-row"
          onClick={() => navigate('/containers')}
        >
          <span className="menu-icon"><CupSoda size={18} strokeWidth={2} /></span>
          <span className="menu-title">添加/编辑容器</span>
          <span className="menu-arrow">›</span>
        </button>

        <button
          className="menu-row"
          onClick={() => navigate('/collection')}
        >
          <span className="menu-icon"><PawPrint size={18} strokeWidth={2} /></span>
          <span className="menu-title">我的小伙伴</span>
          <span className="menu-value">{unlockedCount} / {ANIMALS.length}</span>
          <span className="menu-arrow">›</span>
        </button>
      </div>

      {/* 展开面板：跟着菜单组下面，不打断 group 的视觉统一 */}
      {expandedKey === 'weight' && (
        <div className="card">
          <label className="label">体重 (kg)</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            step={0.5}
            value={s.weightKg}
            onChange={(e) => update({ weightKg: Math.max(0, parseFloat(e.target.value) || 0), mlPerKg: 35 })}
            autoFocus
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>
            每日饮水目标 = 体重 × 35 ml/kg<br/>
            例：65 kg → 2275 ml · 70 kg → 2450 ml
          </div>
        </div>
      )}
      {expandedKey === 'sleep' && (
        <div className="card">
          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>起床</div>
              <input
                className="input"
                type="time"
                value={hourToTime(s.wakeHour)}
                onChange={(e) => update({ wakeHour: timeToHour(e.target.value) })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>睡觉</div>
              <input
                className="input"
                type="time"
                value={hourToTime(s.sleepHour)}
                onChange={(e) => update({ sleepHour: timeToHour(e.target.value) })}
              />
            </div>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            提醒会在这段时间内分布
          </div>
        </div>
      )}

      {/* reminder card with mint accent — 默认收紧，频率 picker 折叠 */}
      <div className="card-tinted card-mint">
        <div className="row-between">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={18} strokeWidth={2} /> 推送提醒
            </div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.78 }}>
              app 关闭也能收 · 整点触发 · 作息时段内才发
            </div>
          </div>
          <button
            className={pushEnabled ? 'btn-pill btn-pill-active' : 'btn-pill'}
            onClick={onToggleNotif}
            disabled={pushBusy}
            style={{ opacity: pushBusy ? 0.5 : 1 }}
          >
            {pushBusy ? '...' : pushEnabled ? '已开' : '开启'}
          </button>
        </div>

        {/* 权限提示只在出问题时显示 */}
        {perm === 'denied' && (
          <div style={{ fontSize: 12, marginTop: 8, opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} color="#dc2626" /> 系统层面已拒绝 — 去 iPhone 设置 → Safari/PWA → 通知开启
          </div>
        )}

        {/* 频率：折叠成一行；点击展开 4 个 pill */}
        {pushEnabled && (
          <>
            <button
              onClick={() => setFreqExpanded((v) => !v)}
              className="btn-pill"
              style={{
                marginTop: 10,
                width: '100%',
                background: 'rgba(255,255,255,0.6)',
                fontSize: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
              }}
            >
              <span>
                提醒频率：
                <strong style={{ marginLeft: 6 }}>
                  {NOTIFY_MODES.find((m) => m.value === (s.notifyMode ?? 'standard'))?.label}
                </strong>
                <span style={{ opacity: 0.7, marginLeft: 6 }}>
                  · {NOTIFY_MODES.find((m) => m.value === (s.notifyMode ?? 'standard'))?.sub}
                </span>
              </span>
              <span style={{ opacity: 0.5, fontSize: 11 }}>
                {freqExpanded ? '收起 ▴' : '改 ▾'}
              </span>
            </button>
            {freqExpanded && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {NOTIFY_MODES.map((m) => {
                    const active = (s.notifyMode ?? 'standard') === m.value;
                    return (
                      <button
                        key={m.value}
                        onClick={() => onPickMode(m.value)}
                        disabled={pushBusy}
                        className={active ? 'btn-pill btn-pill-active' : 'btn-pill'}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 2,
                          padding: '10px 4px',
                          background: active ? undefined : 'rgba(255,255,255,0.7)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{m.label}</span>
                        <span style={{ fontSize: 11, opacity: 0.85 }}>{m.sub}</span>
                      </button>
                    );
                  })}
                </div>
                {(s.notifyMode ?? 'standard') === 'smart' && (
                  <div style={{ fontSize: 11, marginTop: 6, opacity: 0.75, lineHeight: 1.5 }}>
                    落后会更频繁，超前会拉间隔，达标后不再打扰
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {pushMsg && (
          <div style={{ fontSize: 12, marginTop: 8, padding: 8, background: 'rgba(255,255,255,0.6)', borderRadius: 8 }}>
            {pushMsg}
          </div>
        )}
        {/* iPhone 安装提示：只在没装到主屏 & 也还没开推送时给（开了再说就晚了） */}
        {!isStandalone && !pushEnabled && (
          <div className="banner" style={{ marginTop: 10, background: 'rgba(255, 255, 255, 0.6)', fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Smartphone size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>iPhone 要从主屏 PWA 打开，推送才工作（Safari → 分享 → 添加到主屏幕）</span>
          </div>
        )}
        {!isPushSupported() && (
          <div className="warn" style={{ marginTop: 10 }}>
            当前浏览器不支持 Web Push
          </div>
        )}
      </div>

      {/* === 来自好友页的引导横幅 === */}
      {fromFriends && !authUsername && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fcd34d, #f59e0b)',
            color: '#3a2410',
            borderRadius: 16,
            padding: '14px 16px',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 4px 14px rgba(245,158,11,0.28)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 22 }}>👋</span>
          <div style={{ flex: 1, lineHeight: 1.4 }}>
            <div style={{ fontWeight: 800 }}>跟朋友一起喝水吧！</div>
            <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 500, marginTop: 2 }}>
              注册个账号 → 加好友 → 互相递水监督
            </div>
          </div>
        </div>
      )}

      {/* === 账号 === 默认收起，点 header 展开 */}
      <div
        ref={accountCardRef}
        className="card-tinted"
        style={{ background: 'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)' }}
      >
        <button
          onClick={() => setAccountExpanded((v) => !v)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            padding: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={18} strokeWidth={2} />
              <span>{authUsername ? `已登录 · @${authUsername}` : '账号'}</span>
            </div>
            <div style={{ fontSize: 12, marginTop: 2, opacity: 0.75 }}>
              {authUsername ? '跨设备同步已开' : '注册账号 → 跨设备同步、删 app 也不丢'}
            </div>
          </div>
          <span style={{ opacity: 0.55, fontSize: 13 }}>{accountExpanded ? '▴' : '▾'}</span>
        </button>

        {accountExpanded && (
          <div style={{ marginTop: 14 }}>
        {authUsername ? (
          // 已登录
          <>
            <div className="row-between">
              <div>
                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  <strong>@{authUsername}</strong>
                  {authDisplayName && authDisplayName !== authUsername && ` · ${authDisplayName}`}
                </div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                  在任何手机上用同样账号登录都能拉到这些数据
                </div>
              </div>
              <button
                className="btn-pill"
                onClick={onLogout}
                style={{ background: 'rgba(255,255,255,0.7)' }}
              >
                登出
              </button>
            </div>
          </>
        ) : (
          // 未登录 → 引导注册或登录
          <>
            <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
              <strong>建议你创建一个</strong> — 用户名 + 密码就行
            </div>
            {showAuthPanel === 'none' && (
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <button
                  className="btn-pill btn-full"
                  style={{ background: 'rgba(255,255,255,0.85)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={() => { setShowAuthPanel('register'); setAuthMsg(null); }}
                >
                  <UserPlus size={15} /> 注册账号
                </button>
                <button
                  className="btn-pill btn-full"
                  style={{ background: 'rgba(255,255,255,0.6)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={() => { setShowAuthPanel('login'); setAuthMsg(null); }}
                >
                  <LogIn size={15} /> 登录
                </button>
              </div>
            )}
            {showAuthPanel === 'register' && (
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.85)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                  当前数据会跟新账号绑定，不会丢
                </div>
                <input
                  className="input"
                  type="text"
                  placeholder="用户名（3-30 字母数字）"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value.slice(0, 30))}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  style={{ fontSize: 15 }}
                />
                <input
                  className="input"
                  type="password"
                  placeholder="密码（≥6 位）"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  style={{ fontSize: 15, marginTop: 8 }}
                />
                <div className="row" style={{ gap: 8, marginTop: 10 }}>
                  <button
                    className="btn-pill"
                    onClick={() => setShowAuthPanel('none')}
                    style={{ flex: 1 }}
                  >取消</button>
                  <button
                    className="btn btn-full"
                    onClick={onRegisterFromSettings}
                    disabled={authBusy || !regUsername.trim() || regPassword.length < 6}
                    style={{ flex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {authBusy ? '...' : (<><Sparkles size={15} /> 创建</>)}
                  </button>
                </div>
              </div>
            )}
            {showAuthPanel === 'login' && (
              <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.85)', borderRadius: 12 }}>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                  <AlertCircle size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} color="#f59e0b" />
                  登录后<strong>当前本地数据会被覆盖</strong>，先想清楚
                </div>
                <input
                  className="input"
                  type="text"
                  placeholder="用户名"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value.slice(0, 30))}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  style={{ fontSize: 15 }}
                />
                <input
                  className="input"
                  type="password"
                  placeholder="密码"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{ fontSize: 15, marginTop: 8 }}
                />
                <div className="row" style={{ gap: 8, marginTop: 10 }}>
                  <button
                    className="btn-pill"
                    onClick={() => setShowAuthPanel('none')}
                    style={{ flex: 1 }}
                  >取消</button>
                  <button
                    className="btn btn-full"
                    onClick={onLoginFromSettings}
                    disabled={authBusy || !loginUsername.trim() || !loginPassword}
                    style={{ flex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {authBusy ? '...' : (<><LogIn size={15} /> 登录</>)}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {authMsg && (
          <div style={{ fontSize: 12, marginTop: 10, padding: 8, background: 'rgba(255,255,255,0.7)', borderRadius: 8 }}>
            {authMsg}
          </div>
        )}
          </div>
        )}
      </div>

      {/* === 云备份 === 默认收起 */}
      <div className="card-tinted" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}>
        <button
          onClick={() => setBackupExpanded((v) => !v)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            padding: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cloud size={18} strokeWidth={2} /> 云备份
            </div>
            <div style={{ fontSize: 12, marginTop: 2, opacity: 0.78 }}>
              {lastSyncMin === null
                ? '还未备份'
                : lastSyncMin === 0
                ? '刚刚备份'
                : lastSyncMin < 60
                ? `${lastSyncMin} 分钟前自动备份`
                : `${Math.round(lastSyncMin / 60)} 小时前自动备份`}
              {shortCode && ` · 备份码 ${shortCode}`}
            </div>
          </div>
          <span style={{ opacity: 0.55, fontSize: 13 }}>{backupExpanded ? '▴' : '▾'}</span>
        </button>

        {backupExpanded && (
          <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.5 }}>
          每次记水自动备份。<strong>把备份码记下来</strong> — 删 app / 换手机输入它能拉回全部数据
        </div>

        <div style={{ marginTop: 12, padding: 14, background: 'rgba(255,255,255,0.92)', borderRadius: 14 }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5 }}>
            你的备份码
          </div>
          {shortCodeBusy && (
            <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.4)' }}>
              生成中…
            </div>
          )}
          {shortCodeError && !shortCode && (
            <div style={{ fontSize: 12, color: '#b91c1c' }}>
              <AlertCircle size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} color="#dc2626" />
              {shortCodeError}
              <button
                onClick={() => {
                  setShortCodeError(null);
                  setShortCodeBusy(true);
                  void getOrFetchBackupCode().then((r) => {
                    if (r.code) setShortCode(r.code);
                    else setShortCodeError(r.error ?? null);
                    setShortCodeBusy(false);
                  });
                }}
                className="btn-pill"
                style={{ marginLeft: 8, fontSize: 11, padding: '4px 10px' }}
              >
                重试
              </button>
            </div>
          )}
          {shortCode && (
            <>
              <div
                style={{
                  fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
                  fontSize: 28,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textAlign: 'center',
                  padding: '14px 8px',
                  background: 'rgba(0,0,0,0.05)',
                  borderRadius: 12,
                  color: '#0e7dcc',
                  userSelect: 'all',
                }}
                onClick={(e) => {
                  const range = document.createRange();
                  range.selectNodeContents(e.currentTarget);
                  const sel = window.getSelection();
                  sel?.removeAllRanges();
                  sel?.addRange(range);
                }}
              >
                {shortCode}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <button
                  className={copied ? 'btn-pill btn-pill-active' : 'btn-pill'}
                  onClick={onCopyShortCode}
                  style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {copied
                    ? (<><Check size={14} /> 已复制</>)
                    : (<><Copy size={14} /> 复制</>)}
                </button>
                <button
                  className="btn-pill"
                  onClick={onForceBackup}
                  disabled={backupBusy}
                  style={{ flex: 1, opacity: backupBusy ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {backupBusy ? '...' : (<><Cloud size={14} /> 立即备份</>)}
                </button>
              </div>
            </>
          )}
          <div style={{ fontSize: 11, marginTop: 8, opacity: 0.65, textAlign: 'center' }}>
            {lastSyncMin === null
              ? '还未备份'
              : lastSyncMin === 0
              ? '刚刚备份'
              : lastSyncMin < 60
              ? `${lastSyncMin} 分钟前自动备份`
              : `${Math.round(lastSyncMin / 60)} 小时前自动备份`}
          </div>
        </div>

        <button
          className="btn-pill btn-full"
          style={{ marginTop: 10, background: 'rgba(255,255,255,0.7)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          onClick={() => { setShowRestore((v) => !v); setBackupMsg(null); }}
        >
          {showRestore ? '关闭' : (<><RotateCcw size={14} /> 从其它设备恢复…</>)}
        </button>

        {showRestore && (
          <div style={{ marginTop: 10, padding: 12, background: 'rgba(255,255,255,0.85)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8, lineHeight: 1.5 }}>
              <AlertCircle size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} color="#f59e0b" />
              输入旧设备的备份码（短码或完整 ID 都行），恢复后会<strong>覆盖</strong>当前所有数据
            </div>
            <input
              className="input"
              type="text"
              placeholder="K3M7-P2AS"
              value={restoreCode}
              onChange={(e) => setRestoreCode(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: 17, letterSpacing: '0.06em', textAlign: 'center' }}
            />
            <button
              className="btn btn-full"
              style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onClick={onRestore}
              disabled={backupBusy || !restoreCode.trim()}
            >
              {backupBusy ? '正在恢复…' : (<><Sparkles size={15} /> 恢复数据</>)}
            </button>
          </div>
        )}

        {backupMsg && (
          <div style={{ fontSize: 12, marginTop: 10, padding: 8, background: 'rgba(255,255,255,0.7)', borderRadius: 8 }}>
            {backupMsg}
          </div>
        )}

        {/* 高级：完整 UUID（兼容老备份方式） */}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="btn-pill"
          style={{ marginTop: 10, background: 'transparent', boxShadow: 'none', fontSize: 11, opacity: 0.65 }}
        >
          {showAdvanced ? '收起' : '高级'}
        </button>
        {showAdvanced && (
          <div style={{ marginTop: 8, padding: 10, background: 'rgba(255,255,255,0.6)', borderRadius: 10 }}>
            <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4 }}>完整 device ID（也可以当备份码用）</div>
            <div
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 10,
                wordBreak: 'break-all',
                userSelect: 'all',
                opacity: 0.7,
              }}
            >
              {backupId}
            </div>
          </div>
        )}
          </div>
        )}
      </div>

    </div>
  );
}
