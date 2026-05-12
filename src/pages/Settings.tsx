import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_SETTINGS, Settings as TSettings } from '../types';
import { getCompletedDays, getSettings, saveSettings } from '../lib/storage';
import { dailyGoalMl } from '../lib/goal';
import { requestPermission } from '../lib/reminders';
import { ANIMALS, unlockCount } from '../data/animals';

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

  useEffect(() => {
    setS(getSettings());
    if ('Notification' in window) setPerm(Notification.permission);
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    setCompletedDays(getCompletedDays().length);
  }, []);

  const update = (patch: Partial<TSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveSettings(next);
  };

  const onToggleNotif = async () => {
    if (!s.notificationsEnabled) {
      const p = await requestPermission();
      setPerm(p);
      if (p === 'granted') update({ notificationsEnabled: true });
    } else {
      update({ notificationsEnabled: false });
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
            <div style={{ fontWeight: 700, fontSize: 17 }}>⏰ 提醒</div>
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>
              智能提醒 · 按进度调整
            </div>
            <div style={{ fontSize: 12, marginTop: 2, opacity: 0.7 }}>
              落后 60min · 持平 75min · 超前 90min
            </div>
          </div>
          <button className={s.notificationsEnabled ? 'btn-pill btn-pill-active' : 'btn-pill'} onClick={onToggleNotif}>
            {s.notificationsEnabled ? '已开' : '开启'}
          </button>
        </div>
        <div style={{ fontSize: 12, marginTop: 8, opacity: 0.7 }}>
          权限：{perm === 'granted' ? '✅ 已开启' : perm === 'denied' ? '❌ 已拒绝（请到系统设置）' : '⚪ 未设置'}
        </div>
        {!isStandalone && (
          <div className="banner" style={{ marginTop: 10, background: 'rgba(255, 255, 255, 0.6)' }}>
            📱 iPhone 请用 Safari「分享 → 添加到主屏幕」打开，通知才会工作
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 6 }}>🤖 AI 测量</div>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          视觉识别 (Gemini 3 Flash · preview) · 免费档<br/>
          API key 保存在服务端 <code>.env.local</code>，前端不持有 key
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 6 }}>关于</div>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          MVP 版本 · 数据存本机 · 换设备会丢<br/>
          拍照测量 = 预设容器 × AI 估水位<br/>
          智能提醒按当前进度动态调整频率<br/>
          <span style={{ fontSize: 12 }}>
            参考研究：专注工作或空调环境下，约 60–120 min 会出现轻度脱水倾向，60–90 min 是建立喝水习惯的甜区。
          </span>
        </div>
      </div>
    </div>
  );
}
