import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Companion from '../components/Companion';
import EntryList from '../components/EntryList';
import TimeBackground from '../components/TimeBackground';
import { Container, DEFAULT_SETTINGS, Entry, Settings } from '../types';
import {
  deleteEntry,
  ensureUnlockedMigration,
  getCompanionId,
  getCompletedDays,
  getContainers,
  getEntries,
  getSeenEarnedTokens,
  getSettings,
  getUnlockedIds,
  getUserName,
  markDayCompleted,
  pruneOldPhotos,
  saveSettings,
  setSeenEarnedTokens,
  setUserName,
} from '../lib/storage';
import { calcProgress, dailyGoalMl, pace } from '../lib/goal';
import { syncCompanionToServer, syncProgress } from '../lib/push';
import { restoreFromCode } from '../lib/sync';
import { login as authLogin, register as authRegister } from '../lib/auth';
import { syncUserNameToServer } from '../lib/user';
import {
  BarChart3, Cloud, Hand, Key, LogIn, PartyPopper, PawPrint,
  Settings as SettingsIcon, Sparkles, Trophy, UserPlus, Users,
} from 'lucide-react';
import { ANIMALS, availableTokens, earnedTokens } from '../data/animals';

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
  const [incomingCount, setIncomingCount] = useState(0);
  const [nameInput, setNameInput] = useState('');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [showWeightPrompt, setShowWeightPrompt] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [showAllEntries, setShowAllEntries] = useState(false);

  // === 首次开屏的认证流 ===
  type AuthMode = 'quick' | 'register' | 'login' | 'restore';
  const [authMode, setAuthMode] = useState<AuthMode>('quick');
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [restoreCodeInput, setRestoreCodeInput] = useState('');

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
    // 新用户填完名字后顺手收集体重 — 避免他们之后还得跑去设置页
    setShowWeightPrompt(true);
  };

  const onSaveWeight = () => {
    const w = parseFloat(weightInput);
    if (!Number.isFinite(w) || w <= 0) return;
    const next = { ...(settings ?? DEFAULT_SETTINGS), weightKg: w, mlPerKg: 35 };
    saveSettings(next);
    setSettings(next);
    setShowWeightPrompt(false);
  };

  const onSkipWeight = () => {
    // 跳过就用默认值（DEFAULT_SETTINGS 已经有 65kg），不强迫
    setShowWeightPrompt(false);
  };

  const onRegister = async () => {
    setAuthErr(null);
    setAuthBusy(true);
    const dn = regDisplayName.trim() || regUsername.trim();
    const result = await authRegister(regUsername.trim(), regPassword, dn);
    if (result.ok) {
      window.location.reload();  // 让 state 从新身份重新加载
    } else {
      setAuthErr(result.error ?? '注册失败');
      setAuthBusy(false);
    }
  };

  const onLogin = async () => {
    setAuthErr(null);
    setAuthBusy(true);
    const result = await authLogin(loginUsername.trim(), loginPassword);
    if (result.ok) {
      window.location.reload();
    } else {
      setAuthErr(result.error ?? '登录失败');
      setAuthBusy(false);
    }
  };

  const onRestoreInPrompt = async () => {
    setAuthErr(null);
    setAuthBusy(true);
    const result = await restoreFromCode(restoreCodeInput);
    if (result.ok) {
      window.location.reload();
    } else {
      setAuthErr(result.error ?? '恢复失败');
      setAuthBusy(false);
    }
  };

  const switchAuthMode = (m: AuthMode) => {
    setAuthMode(m);
    setAuthErr(null);
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

  // 拉未处理好友请求 + 未读 inbox 数量
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { getCurrentUsername } = await import('../lib/auth');
      if (!getCurrentUsername()) return;
      const { fetchFriends, fetchInbox } = await import('../lib/social');
      const [fr, ib] = await Promise.all([fetchFriends(), fetchInbox()]);
      if (!cancelled) setIncomingCount(fr.incoming.length + ib.unread);
    })();
    return () => { cancelled = true; };
  }, []);

  // 进入页面时检查：累计赚到的钥匙数 > 上次看过的，且还有没用的 → 弹提示
  const checkedTokensRef = useRef(false);
  useEffect(() => {
    if (checkedTokensRef.current) return;
    if (!settings) return;
    checkedTokensRef.current = true;
    const completedDays = getCompletedDays().length;
    const unlockedCount = getUnlockedIds(ANIMALS[0].id).length;
    const earned = earnedTokens(completedDays);
    const available = availableTokens(completedDays, unlockedCount);
    if (earned > getSeenEarnedTokens() && available > 0) {
      setTokenEarned(true);
    }
  }, [settings]);

  // 关闭弹窗时，记下当前累计赚到的钥匙数（之后只有新钥匙才会再弹）
  const closeTokenPopup = (): void => {
    const completedDays = getCompletedDays().length;
    setSeenEarnedTokens(earnedTokens(completedDays));
    setTokenEarned(false);
  };

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
      <TimeBackground theme={(new URLSearchParams(window.location.search).get('theme') as any) || undefined} />
      <header className="page-header">
        <div className="muted" style={{ fontSize: 13 }}>
          {greeting}
          {userName ? <>，<span style={{ fontStyle: 'italic' }}>{userName}</span></> : '，今天'}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <Link to="/stats" className="icon-btn" aria-label="记录"><BarChart3 size={20} strokeWidth={1.8} /></Link>
          <Link to="/collection" className="icon-btn" aria-label="收藏"><PawPrint size={20} strokeWidth={1.8} /></Link>
          <Link to="/friends" className="icon-btn" aria-label="好友" style={{ position: 'relative' }}>
            <Users size={20} strokeWidth={1.8} />
            {incomingCount > 0 && (
              <span style={{
                position: 'absolute', top: -2, right: -2,
                minWidth: 16, height: 16, padding: '0 4px',
                borderRadius: 999, fontSize: 10, fontWeight: 700, color: 'white',
                background: '#ef4444',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{incomingCount}</span>
            )}
          </Link>
          <Link to="/settings" className="icon-btn" aria-label="设置"><SettingsIcon size={20} strokeWidth={1.8} /></Link>
        </div>
      </header>
      <h1 className="page-title" style={{ marginTop: -20 }}>和{companion.name.slice(0, 3)}一起喝水</h1>

      {/* Stats + horizontal progress */}
      <div className="hero-block" style={{ marginTop: 32 }}>
        <div className="row-between">
          <div>
            <div className="muted" style={{ fontSize: 12 }}>已喝 / 目标</div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              {progress.drunkMl}
              <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-soft)' }}> / {goalMl} ml</span>
            </div>
          </div>
          <div className="tag">
            {progress.pct >= 1
              ? (<><Trophy size={13} style={{ display: 'inline', verticalAlign: -2 }} /> 达标</>)
              : `还差 ${progress.remainingMl} ml`}
          </div>
        </div>

        {(() => {
          // 红黄绿渐变进度条：fill 显示 red→yellow→green 渐变。
          // 关键：让渐变映射到「100% 目标」的宽度而不是 fill 自己的宽度，这样
          // 50% 进度时只看到红→黄那一段，不会整条都"翻绿"。
          const fillPct = Math.max(0, Math.min(100, progress.pct * 100));
          const reached = progress.pct >= 1;
          const bgScale = fillPct > 0 ? (100 / fillPct) * 100 : 100;
          return (
            <div
              style={{
                height: 12,
                background: 'rgba(0,0,0,0.06)',
                borderRadius: 999,
                overflow: 'hidden',
                marginTop: 14,
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${fillPct}%`,
                  height: '100%',
                  background: reached
                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                    : 'linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #22c55e 100%)',
                  backgroundSize: reached ? '100% 100%' : `${bgScale}% 100%`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'left center',
                  borderRadius: 999,
                  transition: 'width 0.6s cubic-bezier(.2,.7,.2,1), background-size 0.6s cubic-bezier(.2,.7,.2,1), background 0.4s ease',
                  boxShadow: reached ? '0 0 12px rgba(34, 197, 94, 0.4)' : undefined,
                }}
              />
            </div>
          );
        })()}

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

        {/* + 加一杯水 — 直接在 hero 卡里 */}
        <Link
          to="/add"
          className="btn btn-full"
          style={{ marginTop: 18, fontSize: 17 }}
        >
          + 加一杯水
        </Link>
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


      {tokenEarned && (
        <div
          onClick={closeTokenPopup}
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
            <div style={{ fontSize: 13, color: 'var(--text-soft)', fontWeight: 600, letterSpacing: 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <PartyPopper size={14} color="#f59e0b" /> 完成今日目标
            </div>
            <div style={{ marginTop: 18, marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
              <Key size={56} strokeWidth={1.6} color="#f59e0b" />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>多了 1 把解锁钥匙</div>
            <div className="muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
              去「我的小伙伴」<br/>挑一只你喜欢的动物加入喝水小队
            </div>
            <Link
              to="/collection"
              className="btn btn-full"
              style={{ marginTop: 18 }}
              onClick={closeTokenPopup}
            >
              去挑选 →
            </Link>
            <button
              className="btn-pill"
              style={{ marginTop: 10, background: 'transparent', boxShadow: 'none' }}
              onClick={closeTokenPopup}
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
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
              {authMode === 'quick' && <Hand size={42} strokeWidth={1.6} color="#3aa6dd" />}
              {authMode === 'register' && <Sparkles size={42} strokeWidth={1.6} color="#f59e0b" />}
              {authMode === 'login' && <LogIn size={42} strokeWidth={1.6} color="#3aa6dd" />}
              {authMode === 'restore' && <Cloud size={42} strokeWidth={1.6} color="#3aa6dd" />}
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>
              {authMode === 'quick' && '嗨，新朋友'}
              {authMode === 'register' && '创建账号'}
              {authMode === 'login' && '欢迎回来'}
              {authMode === 'restore' && '用备份码恢复'}
            </div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
              {authMode === 'quick' && '直接开始用 — 数据存这台手机上'}
              {authMode === 'register' && '账号能跨设备同步，删 app 也不丢'}
              {authMode === 'login' && '输入用户名密码，把数据拉回来'}
              {authMode === 'restore' && '老用户的恢复方式 — 用备份码'}
            </div>

            {/* 三档主选择 */}
            <div className="row" style={{ gap: 6, marginBottom: 14 }}>
              <button
                className={authMode === 'quick' ? 'btn-pill btn-pill-active' : 'btn-pill'}
                onClick={() => switchAuthMode('quick')}
                style={{ flex: 1, fontSize: 12, padding: '8px 4px' }}
              >直接用</button>
              <button
                className={authMode === 'register' ? 'btn-pill btn-pill-active' : 'btn-pill'}
                onClick={() => switchAuthMode('register')}
                style={{ flex: 1, fontSize: 12, padding: '8px 4px' }}
              >注册</button>
              <button
                className={authMode === 'login' || authMode === 'restore' ? 'btn-pill btn-pill-active' : 'btn-pill'}
                onClick={() => switchAuthMode('login')}
                style={{ flex: 1, fontSize: 12, padding: '8px 4px' }}
              >登录</button>
            </div>

            {/* 「直接用」: 输名字开始 */}
            {authMode === 'quick' && (
              <>
                <input
                  className="input"
                  type="text"
                  placeholder="你叫什么"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value.slice(0, 30))}
                  onKeyDown={(e) => { if (e.key === 'Enter') onSaveName(); }}
                  maxLength={30}
                  style={{ textAlign: 'center', fontSize: 17 }}
                />
                <button
                  className="btn btn-full"
                  style={{ marginTop: 12 }}
                  onClick={onSaveName}
                  disabled={!nameInput.trim()}
                >
                  开始
                </button>
                <div className="muted" style={{ fontSize: 11, marginTop: 10, lineHeight: 1.5 }}>
                  之后想跨设备同步可以在「设置」里随时注册账号
                </div>
              </>
            )}

            {/* 「注册」 */}
            {authMode === 'register' && (
              <>
                <input
                  className="input"
                  type="text"
                  placeholder="用户名（3-30 字母数字）"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value.slice(0, 30))}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  style={{ textAlign: 'center', fontSize: 15 }}
                />
                <input
                  className="input"
                  type="password"
                  placeholder="密码（≥6 位）"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  style={{ textAlign: 'center', fontSize: 15, marginTop: 8 }}
                />
                <input
                  className="input"
                  type="text"
                  placeholder="显示名字（可选，给小伙伴叫）"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value.slice(0, 30))}
                  style={{ textAlign: 'center', fontSize: 15, marginTop: 8 }}
                />
                {authErr && <div className="warn" style={{ marginTop: 10, fontSize: 12 }}>{authErr}</div>}
                <button
                  className="btn btn-full"
                  style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={onRegister}
                  disabled={authBusy || !regUsername.trim() || regPassword.length < 6}
                >
                  {authBusy ? '正在创建…' : (<><UserPlus size={16} /> 创建账号</>)}
                </button>
              </>
            )}

            {/* 「登录」 */}
            {authMode === 'login' && (
              <>
                <input
                  className="input"
                  type="text"
                  placeholder="用户名"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value.slice(0, 30))}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  style={{ textAlign: 'center', fontSize: 15 }}
                />
                <input
                  className="input"
                  type="password"
                  placeholder="密码"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && loginUsername && loginPassword) onLogin(); }}
                  style={{ textAlign: 'center', fontSize: 15, marginTop: 8 }}
                />
                {authErr && <div className="warn" style={{ marginTop: 10, fontSize: 12 }}>{authErr}</div>}
                <button
                  className="btn btn-full"
                  style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={onLogin}
                  disabled={authBusy || !loginUsername.trim() || !loginPassword}
                >
                  {authBusy ? '正在登录…' : (<><LogIn size={16} /> 登录</>)}
                </button>
                <button
                  className="btn-pill"
                  style={{ marginTop: 10, background: 'transparent', boxShadow: 'none', fontSize: 12 }}
                  onClick={() => switchAuthMode('restore')}
                >
                  忘了密码？用备份码恢复 →
                </button>
              </>
            )}

            {/* 「用备份码」 — 兼容旧用户 */}
            {authMode === 'restore' && (
              <>
                <input
                  className="input"
                  type="text"
                  placeholder="K3M7-P2AS"
                  value={restoreCodeInput}
                  onChange={(e) => setRestoreCodeInput(e.target.value)}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  style={{ fontFamily: 'ui-monospace, monospace', fontSize: 17, textAlign: 'center', letterSpacing: '0.06em' }}
                />
                {authErr && <div className="warn" style={{ marginTop: 10, fontSize: 12 }}>{authErr}</div>}
                <button
                  className="btn btn-full"
                  style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={onRestoreInPrompt}
                  disabled={authBusy || !restoreCodeInput.trim()}
                >
                  {authBusy ? '正在恢复…' : (<><Sparkles size={16} /> 恢复数据</>)}
                </button>
                <button
                  className="btn-pill"
                  style={{ marginTop: 10, background: 'transparent', boxShadow: 'none', fontSize: 12 }}
                  onClick={() => switchAuthMode('login')}
                >
                  ← 用账号登录
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showWeightPrompt && (
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
            <div style={{ fontSize: 36, marginBottom: 6 }}>⚖️</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>
              你的体重？
            </div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
              用来算每天该喝多少水<br/>
              （体重 × 35 ml/kg）
            </div>
            <input
              className="input"
              type="text"
              inputMode="decimal"
              placeholder="例：65"
              value={weightInput}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d{1,3}(\.\d{0,2})?$/.test(v)) setWeightInput(v);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') onSaveWeight(); }}
              autoFocus
              style={{ textAlign: 'center', fontSize: 22, fontWeight: 600 }}
            />
            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>kg</div>
            {weightInput && parseFloat(weightInput) > 0 && (
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                每日目标：{Math.round(parseFloat(weightInput) * 35)} ml
              </div>
            )}
            <button
              className="btn btn-full"
              style={{ marginTop: 14 }}
              onClick={onSaveWeight}
              disabled={!weightInput || parseFloat(weightInput) <= 0}
            >
              确定
            </button>
            <button
              className="btn-pill"
              style={{ marginTop: 8, background: 'transparent', boxShadow: 'none', fontSize: 13 }}
              onClick={onSkipWeight}
            >
              用默认 65 kg
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
