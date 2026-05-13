import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { forceSyncNow, lastSyncAt, restoreFromCode } from '../lib/sync';
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
  const [s, setS] = useState<TSettings>(DEFAULT_SETTINGS);
  const [perm, setPerm] = useState<NotificationPermission>('default');
  const [isStandalone, setIsStandalone] = useState(false);
  const [expandedKey, setExpandedKey] = useState<'weight' | 'sleep' | null>(null);

  const [unlockedCount, setUnlockedCount] = useState(1);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  // 备份/恢复
  const [backupId, setBackupId] = useState('');
  const [lastSyncMin, setLastSyncMin] = useState<number | null>(null);
  const [showRestore, setShowRestore] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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
    const last = lastSyncAt();
    setLastSyncMin(last ? Math.round((Date.now() - last) / 60000) : null);
  }, []);

  const onCopyBackupId = async () => {
    try {
      await navigator.clipboard.writeText(backupId);
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
    setBackupMsg('✅ 已备份到云端');
    setBackupBusy(false);
  };

  const onRestore = async () => {
    setBackupBusy(true);
    setBackupMsg(null);
    const result = await restoreFromCode(restoreCode);
    if (result.ok) {
      setBackupMsg('✅ 恢复成功，刷新页面应用…');
      setTimeout(() => window.location.reload(), 800);
    } else {
      setBackupMsg(`❌ ${result.error ?? '恢复失败'}`);
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
        setPushMsg('✅ 已订阅，等下个整点会收到');
      } else {
        await disablePush();
        setPushEnabled(false);
        update({ notificationsEnabled: false });
        setPushMsg('已关闭推送');
      }
    } catch (e) {
      setPushMsg(e instanceof Error ? `❌ ${e.message}` : '❌ 操作失败');
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
        setPushMsg(e instanceof Error ? `❌ ${e.message}` : '❌ 切换失败');
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
        <div style={{ position: 'absolute', right: -10, bottom: -10, fontSize: 80, opacity: 0.18 }}>💧</div>
      </div>

      <div className="menu-group">
        <button
          className="menu-row"
          onClick={() => setExpandedKey(expandedKey === 'weight' ? null : 'weight')}
        >
          <span className="menu-icon">⚖️</span>
          <span className="menu-title">体重</span>
          <span className="menu-value">{s.weightKg} kg</span>
          <span className="menu-arrow">›</span>
        </button>

        <button
          className="menu-row"
          onClick={() => setExpandedKey(expandedKey === 'sleep' ? null : 'sleep')}
        >
          <span className="menu-icon">🌙</span>
          <span className="menu-title">作息时间</span>
          <span className="menu-value">{hourToTime(s.wakeHour)} – {hourToTime(s.sleepHour)}</span>
          <span className="menu-arrow">›</span>
        </button>

        <button
          className="menu-row"
          onClick={() => navigate('/containers')}
        >
          <span className="menu-icon">🥤</span>
          <span className="menu-title">添加/编辑容器</span>
          <span className="menu-arrow">›</span>
        </button>

        <button
          className="menu-row"
          onClick={() => navigate('/collection')}
        >
          <span className="menu-icon">🦙</span>
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

      {/* reminder card with mint accent */}
      <div className="card-tinted card-mint">
        <div className="row-between">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>⏰ 推送提醒</div>
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>
              app 关闭也能收 · 服务端推
            </div>
            <div style={{ fontSize: 12, marginTop: 2, opacity: 0.7 }}>
              整点触发 · 你设的作息时间内才发
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
        <div style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
          权限：{perm === 'granted' ? '✅ 已开启' : perm === 'denied' ? '❌ 已拒绝（请到系统设置）' : '⚪ 未设置'}
        </div>

        {/* 频率 picker — 始终显示，让用户可以预先选择 */}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            提醒频率{!pushEnabled && '（开启推送后生效）'}
          </div>
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
              💡 落后会更频繁，超前会拉间隔，达标后不再打扰
            </div>
          )}
        </div>

        {pushMsg && (
          <div style={{ fontSize: 12, marginTop: 8, padding: 8, background: 'rgba(255,255,255,0.6)', borderRadius: 8 }}>
            {pushMsg}
          </div>
        )}
        {!isStandalone && (
          <div className="banner" style={{ marginTop: 10, background: 'rgba(255, 255, 255, 0.6)' }}>
            📱 iPhone 必须用 Safari「分享 → 添加到主屏幕」从主屏图标打开，推送才会工作（iOS 16.4+）
          </div>
        )}
        {!isPushSupported() && (
          <div className="warn" style={{ marginTop: 10 }}>
            当前浏览器不支持 Web Push
          </div>
        )}
      </div>

      {/* === 云备份 === */}
      <div className="card-tinted" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>☁️ 云备份</div>
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85, lineHeight: 1.5 }}>
          每次记水会自动备份到云端。<br/>
          <strong>把下面的备份码记下来</strong> — 删了 app / 换手机时输入它就能拉回所有数据
        </div>

        <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.85)', borderRadius: 12 }}>
          <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 4, fontWeight: 600 }}>你的备份码</div>
          <div
            style={{
              fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
              fontSize: 12,
              wordBreak: 'break-all',
              userSelect: 'all',
              lineHeight: 1.5,
              padding: '6px 8px',
              background: 'rgba(0,0,0,0.04)',
              borderRadius: 8,
            }}
            onClick={(e) => {
              const range = document.createRange();
              range.selectNodeContents(e.currentTarget);
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
            }}
          >
            {backupId}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button
              className={copied ? 'btn-pill btn-pill-active' : 'btn-pill'}
              onClick={onCopyBackupId}
              style={{ flex: 1 }}
            >
              {copied ? '✓ 已复制' : '📋 复制备份码'}
            </button>
            <button
              className="btn-pill"
              onClick={onForceBackup}
              disabled={backupBusy}
              style={{ flex: 1, opacity: backupBusy ? 0.5 : 1 }}
            >
              {backupBusy ? '...' : '☁️ 立即备份'}
            </button>
          </div>
          <div style={{ fontSize: 11, marginTop: 8, opacity: 0.65 }}>
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
          style={{ marginTop: 10, background: 'rgba(255,255,255,0.7)' }}
          onClick={() => { setShowRestore((v) => !v); setBackupMsg(null); }}
        >
          {showRestore ? '关闭' : '🔁 从其它设备恢复…'}
        </button>

        {showRestore && (
          <div style={{ marginTop: 10, padding: 12, background: 'rgba(255,255,255,0.85)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8, lineHeight: 1.5 }}>
              ⚠️ 输入旧设备的备份码，恢复后会<strong>覆盖</strong>当前所有数据
            </div>
            <input
              className="input"
              type="text"
              placeholder="粘贴备份码"
              value={restoreCode}
              onChange={(e) => setRestoreCode(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}
            />
            <button
              className="btn btn-full"
              style={{ marginTop: 10 }}
              onClick={onRestore}
              disabled={backupBusy || !restoreCode.trim()}
            >
              {backupBusy ? '正在恢复…' : '✨ 恢复数据'}
            </button>
          </div>
        )}

        {backupMsg && (
          <div style={{ fontSize: 12, marginTop: 10, padding: 8, background: 'rgba(255,255,255,0.7)', borderRadius: 8 }}>
            {backupMsg}
          </div>
        )}
      </div>

    </div>
  );
}
