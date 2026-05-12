import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_SETTINGS, NotifyMode, Settings as TSettings } from '../types';
import { getCompletedDays, getSettings, saveSettings } from '../lib/storage';
import { dailyGoalMl } from '../lib/goal';
import {
  disablePush,
  enablePush,
  getCurrentSubscription,
  isPushSupported,
  setNotifyMode,
  syncSettingsToServer,
} from '../lib/push';
import { ANIMALS, unlockCount } from '../data/animals';

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

  const [completedDays, setCompletedDays] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  useEffect(() => {
    setS(getSettings());
    if ('Notification' in window) setPerm(Notification.permission);
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    setCompletedDays(getCompletedDays().length);
    if (isPushSupported()) {
      getCurrentSubscription().then((sub) => setPushEnabled(!!sub));
    }
  }, []);

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

      <div className="list">
        <button
          className="menu-row"
          onClick={() => setExpandedKey(expandedKey === 'weight' ? null : 'weight')}
        >
          <span className="menu-icon">⚖️</span>
          <span className="menu-title">体重</span>
          <span className="menu-value">{s.weightKg} kg</span>
          <span className="menu-arrow">›</span>
        </button>
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

        <button
          className="menu-row"
          onClick={() => setExpandedKey(expandedKey === 'sleep' ? null : 'sleep')}
        >
          <span className="menu-icon">🌙</span>
          <span className="menu-title">作息时间</span>
          <span className="menu-value">{hourToTime(s.wakeHour)} – {hourToTime(s.sleepHour)}</span>
          <span className="menu-arrow">›</span>
        </button>
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
          <span className="menu-value">{unlockCount(completedDays)} / {ANIMALS.length}</span>
          <span className="menu-arrow">›</span>
        </button>
      </div>

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

    </div>
  );
}
