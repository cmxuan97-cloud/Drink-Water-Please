import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Companion from '../components/Companion';
import EntryList from '../components/EntryList';
import TimeBackground from '../components/TimeBackground';
import { Container, Entry, Settings } from '../types';
import {
  deleteEntry,
  ensureUnlockedMigration,
  getCompanionId,
  getCompletedDays,
  getContainers,
  getEntries,
  getSettings,
  getUserName,
  markDayCompleted,
  pruneOldPhotos,
  setUserName,
} from '../lib/storage';
import { calcProgress, dailyGoalMl, pace } from '../lib/goal';
import { syncCompanionToServer, syncProgress } from '../lib/push';
import { syncUserNameToServer } from '../lib/user';
import { ANIMALS, earnedTokens } from '../data/animals';

const greetingFor = (h: number): string => {
  if (h < 5) return '夜深啦';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
};

export default function Home() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [companionId, setCompanionIdLocal] = useState<string | null>(null);
  const [userName, setUserNameLocal] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);

  useEffect(() => {
    pruneOldPhotos();
    setSettings(getSettings());
    setContainers(getContainers());
    setEntries(getEntries());
    setCompanionIdLocal(getCompanionId());
    const name = getUserName();
    setUserNameLocal(name);
    if (!name) setShowNamePrompt(true);
  }, []);

  const onSaveName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setUserName(trimmed);
    setUserNameLocal(trimmed);
    setShowNamePrompt(false);
    void syncUserNameToServer(trimmed);
  };

  const goalMl = useMemo(
    () => (settings ? dailyGoalMl(settings.weightKg) : 0),
    [settings],
  );
  const progress = useMemo(() => calcProgress(entries, goalMl), [entries, goalMl]);

  const paceInfo = useMemo(() => {
    if (!settings) return null;
    return pace(progress.drunkMl, goalMl, settings.wakeHour, settings.sleepHour);
  }, [settings, progress.drunkMl, goalMl]);

  // 进度变化 → 同步给服务端（智能推送会用）
  useEffect(() => {
    if (!settings || goalMl === 0) return;
    syncProgress(progress.drunkMl, goalMl);
  }, [progress.drunkMl, goalMl, settings]);

  const [tokenEarned, setTokenEarned] = useState(false);
  useEffect(() => {
    if (!settings || goalMl === 0) return;
    if (progress.pct < 1) return;
    const { added, days } = markDayCompleted();
    if (added) {
      const newTokens = earnedTokens(days.length);
      const prevTokens = earnedTokens(days.length - 1);
      if (newTokens > prevTokens) {
        setTokenEarned(true);
      }
    }
  }, [progress.pct, settings, goalMl]);

  // 选 companion：当前的 companionId（限于已解锁），否则最后一个解锁的
  const companion = useMemo(() => {
    const completedDays = getCompletedDays().length;
    const unlockedIds = ensureUnlockedMigration(completedDays, ANIMALS.map((a) => a.id));
    const unlockedSet = new Set(unlockedIds);
    const unlocked = ANIMALS.filter((a) => unlockedSet.has(a.id));
    const fromSetting = companionId ? unlocked.find((a) => a.id === companionId) : undefined;
    return fromSetting ?? unlocked[unlocked.length - 1] ?? ANIMALS[0];
  }, [companionId]);

  // 一次性 backfill：把「实际显示的 companion」同步到服务端，让老用户/没有手动选过的用户
  // 也能立刻收到对的口吻 push。每次 mount 同步一次，幂等。
  const didSyncCompanionRef = useRef(false);
  useEffect(() => {
    if (!didSyncCompanionRef.current && companion) {
      didSyncCompanionRef.current = true;
      void syncCompanionToServer(companion.id);
    }
  }, [companion]);

  const lastEntryTs = entries[0]?.ts ?? null;
  const minutesSinceLastDrink = lastEntryTs
    ? Math.floor((Date.now() - lastEntryTs) / 60000)
    : null;

  const onDelete = (id: string) => {
    setEntries(deleteEntry(id));
  };

  if (!settings) return null;

  const greeting = greetingFor(new Date().getHours());

  return (
    <div className="page">
      <TimeBackground />
      <header className="page-header">
        <div>
          <div className="muted" style={{ fontSize: 13 }}>
            {greeting}{userName ? `，${userName}` : '，今天'}
          </div>
          <h1 className="page-title">和{companion.name.slice(0, 3)}一起喝水</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link to="/stats" className="icon-btn" aria-label="记录">📊</Link>
          <Link to="/collection" className="icon-btn" aria-label="收藏">🦙</Link>
          <Link to="/settings" className="icon-btn" aria-label="设置">⚙️</Link>
        </div>
      </header>

      {/* Stats + horizontal progress */}
      <div className="hero-block">
        <div className="row-between">
          <div>
            <div className="muted" style={{ fontSize: 12 }}>已喝 / 目标</div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {progress.drunkMl}
              <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-soft)' }}> / {goalMl} ml</span>
            </div>
          </div>
          <div className="tag">
            {progress.pct >= 1 ? '🎉 达标' : `还差 ${progress.remainingMl} ml`}
          </div>
        </div>

        <div
          style={{
            height: 10,
            background: 'var(--accent-soft)',
            borderRadius: 999,
            overflow: 'hidden',
            marginTop: 14,
          }}
        >
          <div
            style={{
              width: `${Math.min(100, progress.pct * 100)}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #7dd3fc, #3aa6dd)',
              borderRadius: 999,
              transition: 'width 0.6s cubic-bezier(.2,.7,.2,1)',
            }}
          />
        </div>

        {/* Companion */}
        <div style={{ marginTop: 16 }}>
          <Companion
            animal={companion}
            lastEntryTs={lastEntryTs}
            drunkMl={progress.drunkMl}
            remainingMl={progress.remainingMl}
            goalMl={goalMl}
            pct={progress.pct}
            minutesSinceLastDrink={minutesSinceLastDrink}
            pace={paceInfo?.pace ?? null}
          />
        </div>
      </div>

      <div>
        <div className="row-between" style={{ marginBottom: 10, paddingLeft: 4 }}>
          <h2 style={{ fontSize: 17, margin: 0, fontWeight: 700 }}>今日记录</h2>
          <span className="muted">{entries.length} 条</span>
        </div>
        <EntryList
          entries={showAllEntries ? entries : entries.slice(0, 3)}
          containers={containers}
          onDelete={onDelete}
        />
        {entries.length > 3 && (
          <button
            className="btn-pill btn-full"
            onClick={() => setShowAllEntries((v) => !v)}
            style={{ marginTop: 8, background: 'var(--bg-card)' }}
          >
            {showAllEntries ? '收起' : `查看全部 ${entries.length} 条`}
          </button>
        )}
      </div>

      <div className="fab">
        <Link to="/add" className="btn btn-full" style={{ fontSize: 17 }}>
          + 加一杯水
        </Link>
      </div>

      {tokenEarned && (
        <div
          onClick={() => setTokenEarned(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 40, 60, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: 28,
              padding: 28,
              maxWidth: 340,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-soft)', fontWeight: 600, letterSpacing: 1 }}>
              🎉 完成今日目标
            </div>
            <div style={{ fontSize: 64, marginTop: 14, marginBottom: 4 }}>🔑</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>多了 1 把解锁钥匙</div>
            <div className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
              去「我的小伙伴」<br/>挑一只你喜欢的动物加入喝水小队
            </div>
            <Link
              to="/collection"
              className="btn btn-full"
              style={{ marginTop: 18 }}
              onClick={() => setTokenEarned(false)}
            >
              去挑选 →
            </Link>
            <button
              className="btn-pill"
              style={{ marginTop: 10, background: 'transparent', boxShadow: 'none' }}
              onClick={() => setTokenEarned(false)}
            >
              稍后再说
            </button>
          </div>
        </div>
      )}

      {showNamePrompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 40, 60, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: 24,
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 28,
              padding: 28,
              maxWidth: 340,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
            }}
          >
            <div style={{ fontSize: 56, marginBottom: 8 }}>👋</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>嗨，认识一下吗？</div>
            <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
              告诉我你的名字，我们一起开始喝水之旅
            </div>
            <input
              className="input"
              type="text"
              placeholder="你的名字"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value.slice(0, 30))}
              onKeyDown={(e) => { if (e.key === 'Enter') onSaveName(); }}
              maxLength={30}
              autoFocus
              style={{ marginTop: 18, textAlign: 'center', fontSize: 17 }}
            />
            <button
              className="btn btn-full"
              style={{ marginTop: 14 }}
              onClick={onSaveName}
              disabled={!nameInput.trim()}
            >
              开始
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
