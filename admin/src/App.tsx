import React, { useEffect, useState } from 'react';
import Login from './login/login.jsx';
import { apiGet, apiPost, clearSession, getSession, logoutFromBackend } from './api.js';
import { AppTab, SecurityMode, AppTheme } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './components/screens/HomeScreen';
import { MonitorScreen } from './components/screens/MonitorScreen';
import { VoiceScreen } from './components/screens/VoiceScreen';
import { VisitorsScreen } from './components/screens/VisitorsScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { QuickPassValidationForm } from './components/QuickPassValidationForm';

const tabs: AppTab[] = ['home', 'monitor', 'voice', 'visitors', 'settings'];
const appBasePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function appPath(pathname: string) {
  if (appBasePath && pathname.startsWith(appBasePath)) {
    return pathname.slice(appBasePath.length) || '/';
  }
  return pathname;
}

function readTab(pathname: string): AppTab {
  const path = appPath(pathname).slice(1) as AppTab;
  return tabs.includes(path) ? path : 'home';
}

function hasSavedSession() {
  return getSession()?.role === 'ADMIN';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getSession());
  const [authenticated, setAuthenticated] = useState(hasSavedSession);
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const currentTab = readTab(pathname);
  const showLogin = !authenticated || appPath(pathname) === '/login';

  function setCurrentTab(tab: AppTab) {
    const nextPath = `${appBasePath}/${tab}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setPathname(nextPath);
  }

  useEffect(() => {
  function syncRoute() {
      let path = appPath(window.location.pathname);
      if (!hasSavedSession()) {
        clearSession();
        setCurrentUser(null);
        path = '/login';
      } else if (path !== '/login' && !tabs.includes(path.slice(1) as AppTab)) {
        path = '/home';
        setCurrentUser(getSession());
      } else {
        setCurrentUser(getSession());
      }
      const nextPath = `${appBasePath}${path}`;
      if (nextPath !== window.location.pathname) {
        window.history.replaceState({}, '', nextPath);
      }
      setPathname(nextPath);
    }
    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  useEffect(() => {
    if (!authenticated) return undefined;
    const sendHeartbeat = () => { apiPost('/communicate/heartbeat').catch(() => undefined); };
    sendHeartbeat();
    const heartbeat = window.setInterval(sendHeartbeat, 60000);
    return () => window.clearInterval(heartbeat);
  }, [authenticated]);

  function handleAuthenticated(session?: ReturnType<typeof getSession>) {
    setCurrentUser(session || getSession());
    setAuthenticated(true);
    const nextPath = `${appBasePath}/home`;
    window.history.replaceState({}, '', nextPath);
    setPathname(nextPath);
  }
  function handleLogout() {
    logoutFromBackend();
    clearSession();
    setCurrentUser(null);
    setAuthenticated(false);
    window.history.replaceState({}, '', '/login');
    setPathname('/login');
  }
  const [securityMode, setSecurityMode] = useState<SecurityMode>('away');
  const [isLockdownActive, setIsLockdownActive] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<AppTheme>('daylight');
  const [showSecretAdvisoryModal, setShowSecretAdvisoryModal] = useState<boolean>(false);
  const [showQuickPassModal, setShowQuickPassModal] = useState<boolean>(false);
  const [motionAlert, setMotionAlert] = useState<{ id: string; createdAt: string } | null>(null);
  const [dismissedMotionId, setDismissedMotionId] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return undefined;
    let active = true;
    const syncSecurityState = () => {
      apiGet('/iot/mode').then((response) => {
        const state = response?.state;
        if (!active || !state) return;
        if (['away', 'home', 'disarm'].includes(state.mode)) setSecurityMode(state.mode as SecurityMode);
        setIsLockdownActive(Boolean(state.lockdown_active));
      }).catch(() => undefined);
    };
    syncSecurityState();
    const timer = window.setInterval(syncSecurityState, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return undefined;
    let active = true;
    const pollMotionAlert = () => {
      Promise.all([
        apiGet('/iot/latest?device_code=esp32-porch-01'),
        apiGet('/iot/activity?limit=1'),
      ]).then(([latestResponse, activityResponse]) => {
        if (!active) return;
        const reading = latestResponse?.reading;
        const event = Array.isArray(activityResponse?.events) ? activityResponse.events[0] : null;
        const createdAt = event?.created_at || (reading?.motion_detected ? reading.created_at : '');
        if (!createdAt) return;
        const id = event?.id || `${reading?.device_id || 'esp32-porch-01'}-${createdAt}`;
        if (id !== dismissedMotionId && id !== motionAlert?.id) {
          setMotionAlert({ id, createdAt });
        }
      }).catch(() => undefined);
    };
    pollMotionAlert();
    const timer = window.setInterval(pollMotionAlert, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [authenticated, dismissedMotionId, motionAlert?.id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleSetSecurityMode = async (mode: SecurityMode) => {
    setSecurityMode(mode);
    const labels: Record<SecurityMode, string> = {
      away: 'System Armed: Away (Full Perimeter Radar & AI Guard Active)',
      home: 'System Armed: Home (Porch Sensors Armed, Interior Disarmed)',
      disarm: 'System Disarmed: Porch radar placed in passive log mode',
    };
    try {
      const response = await apiPost('/iot/mode', { mode });
      if (response?.state) {
        setSecurityMode(response.state.mode as SecurityMode);
        setIsLockdownActive(Boolean(response.state.lockdown_active));
      }
      showToast(labels[mode]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update security mode');
    }
  };

  const handleToggleLockdown = () => {
    const nextState = !isLockdownActive;
    setIsLockdownActive(nextState);
    apiPost('/iot/mode', { mode: securityMode, lockdown_active: nextState }).catch(() => {
      setIsLockdownActive(!nextState);
      showToast('Unable to update lockdown state');
    });
    if (nextState) {
      showToast('⚠️ Instant Porch Lockdown Activated! Strikes engaged.');
    } else {
      showToast('Porch Lockdown released. Normal perimeter rules restored.');
    }
  };

  const handleUnlockDoor = () => {
    showToast('🔑 Porch Door Strike Latch Triggered: Unlocked for 8 seconds.');
  };

  const getThemeBackgroundClass = (theme: AppTheme) => {
    switch (theme) {
      case 'twilight':
        return 'theme-twilight bg-[#1e293b] text-[#f8fafc]';
      case 'midnight':
        return 'theme-midnight bg-[#090e17] text-[#e2e8f0]';
      case 'sage':
        return 'theme-sage bg-[#f0fdf4] text-[#052e16]';
      case 'daylight':
      default:
        return 'theme-daylight bg-[#f8f9ff] text-[#0b1c30]';
    }
  };

  if (showLogin) return <Login onAuthenticated={handleAuthenticated} />;

  return (
    <div
      className={`neo-admin min-h-screen flex flex-col antialiased selection:bg-primary-fixed transition-colors duration-300 ${getThemeBackgroundClass(
        currentTheme
      )}`}
    >
      {/* Global Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 inset-x-4 z-50 flex justify-center pointer-events-none">
          <div role="status" aria-live="polite" className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-[#0b1c30]/95 text-white shadow-[0_18px_50px_rgba(5,18,35,0.32)] backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="h-1 bg-gradient-to-r from-[#70e8dc] via-[#16b8aa] to-[#0b6f70]" />
            <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
            <span className="material-symbols-outlined text-[18px] text-primary-fixed shrink-0">
              info
            </span>
            <span className="min-w-0 flex-1 text-sm font-semibold leading-5 tracking-[0.01em]">{toastMessage}</span>
            <button
              type="button"
              aria-label="Close notification"
              onClick={() => setToastMessage(null)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[0px] text-white/60 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#70e8dc]/70"
            >
              <span className="material-symbols-outlined text-[19px]">close</span>
              ✕
            </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Global Header */}
      <Header
        onLogout={handleLogout}
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        currentTheme={currentTheme}
        onChangeTheme={(theme) => {
          setCurrentTheme(theme);
          showToast(`Theme switched to ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
        }}
        onOpenAiAssistant={() => {
          setCurrentTab('voice');
          window.setTimeout(() => window.dispatchEvent(new Event('sentinel-open-ai-chat')), 0);
        }}
        currentUser={currentUser}
      />

      {/* Main Responsive Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-24">
        {currentTab === 'home' && (
          <HomeScreen
            onNavigate={(tab) => setCurrentTab(tab)}
            securityMode={securityMode}
            onSetSecurityMode={handleSetSecurityMode}
            isLockdownActive={isLockdownActive}
            onToggleLockdown={handleToggleLockdown}
          />
        )}

        {currentTab === 'monitor' && (
          <MonitorScreen onNavigate={(tab) => setCurrentTab(tab)} />
        )}

        {currentTab === 'voice' && (
          <VoiceScreen onUnlockDoor={handleUnlockDoor} />
        )}

        {currentTab === 'visitors' && (
          <VisitorsScreen onOpenQuickPassForm={() => setShowQuickPassModal(true)} />
        )}

        {currentTab === 'settings' && <SettingsScreen onLogout={handleLogout} />}
      </main>

      {motionAlert && (currentTab === 'home' || currentTab === 'monitor') && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#071725]/55 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="motion-alert-title"
            className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-white/95 shadow-[0_30px_90px_rgba(4,25,42,0.32)]"
          >
            <div className="h-1.5 bg-gradient-to-r from-[#087f76] via-[#20c8b7] to-[#75eee0]" />
            <button
              type="button"
              aria-label="Close motion alert"
              onClick={() => {
                setDismissedMotionId(motionAlert.id);
                setMotionAlert(null);
              }}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl text-[#50605f] transition-colors hover:bg-[#e8f0f0] hover:text-[#0b1c30]"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            <div className="p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#d2faf4] text-[#007d73] shadow-inner">
                  <span className="absolute inset-0 rounded-2xl border-2 border-[#38cfc0] animate-ping opacity-40" />
                  <span className="material-symbols-outlined relative text-[34px]">motion_sensor_active</span>
                </div>
                <div className="min-w-0 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff0ed] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#b3261e]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#d93025] animate-pulse" />
                    Security Alert
                  </span>
                  <h2 id="motion-alert-title" className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#0b1c30]">
                    Motion detected
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-[#5b6b69]">
                    HC-SR501 detected movement at the front entrance.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl bg-[#eef6f7] px-3.5 py-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#71817f]">Sensor</span>
                  <span className="mt-1 block text-sm font-semibold text-[#0b1c30]">ESP32 Porch Node</span>
                </div>
                <div className="rounded-2xl bg-[#eef6f7] px-3.5 py-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#71817f]">Detected</span>
                  <span className="mt-1 block text-sm font-semibold text-[#0b1c30]">
                    {new Date(motionAlert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setDismissedMotionId(motionAlert.id);
                    setMotionAlert(null);
                  }}
                  className="flex-1 rounded-xl border border-[#d8e4e4] bg-white px-4 py-3 text-sm font-semibold text-[#36504e] transition-colors hover:bg-[#f1f7f7]"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDismissedMotionId(motionAlert.id);
                    setMotionAlert(null);
                    setCurrentTab('monitor');
                  }}
                  className="flex-1 rounded-xl bg-[#087f76] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(8,127,118,0.22)] transition-colors hover:bg-[#066b64]"
                >
                  Open Monitor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Validated Quick Visitor Pass Modal */}
      <QuickPassValidationForm
        isOpen={showQuickPassModal}
        onClose={() => setShowQuickPassModal(false)}
        onSuccess={(pass) => {
          showToast(`Visitor Pass ${pass.id} authorized for ${pass.visitorName}!`);
        }}
      />

      {/* Secret Encrypted Security Advisory Modal */}
      {showSecretAdvisoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-secondary/30 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">encrypted</span>
                <h3 className="font-display font-bold text-sm text-[#0b1c30]">
                  Decrypted Sentinel Telemetry Advisory
                </h3>
              </div>
              <button
                onClick={() => setShowSecretAdvisoryModal(false)}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-xs text-[#3e4947] hover:text-black"
              >
                ✕
              </button>
            </div>
            <div className="p-3 bg-[#eff4ff] rounded-xl border border-secondary/20 space-y-1.5 text-xs text-[#0b1c30]">
              <div className="flex items-center justify-between font-mono text-[11px] text-secondary font-bold">
                <span>STATUS: mTLS VERIFIED</span>
                <span>ID: #AI-SEC-9902</span>
              </div>
              <p className="leading-relaxed">
                "Optical-thermal gradient cross-check confirmed 0 secondary bodies beyond the 120° HC-SR501 beam. ESP32 DevKit node latency is 12ms over TLS 1.3 mTLS. All strike relays test negative for physical tamper."
              </p>
              <div className="pt-1 text-[10px] font-mono text-[#6e7977] flex items-center justify-between">
                <span>Hash: 8A4F-C029-BEEF</span>
                <span>ECDSA Valid</span>
              </div>
            </div>
            <button
              onClick={() => setShowSecretAdvisoryModal(false)}
              className="w-full py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary-container transition-colors shadow-xs"
            >
              Dismiss Advisory
            </button>
          </div>
        </div>
      )}

      {/* Persistent Bottom Navigation (Mobile & Tablet) */}
      <BottomNav currentTab={currentTab} onTabChange={(tab) => setCurrentTab(tab)} />
    </div>
  );
}
