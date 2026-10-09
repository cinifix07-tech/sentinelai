import React, { useEffect, useState } from 'react';
import Login from './login/login.jsx';
import { apiGet, apiPost, clearSession, getSession, logoutFromBackend } from './api.js';
import { AppTab, SecurityMode, AppTheme } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './components/screens/HomeScreen';
import { MonitorScreen } from './components/screens/MonitorScreen';
import { DevicesScreen } from './components/screens/DevicesScreen';
import { VoiceScreen } from './components/screens/VoiceScreen';
import { VisitorsScreen } from './components/screens/VisitorsScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { QuickPassValidationForm } from './components/QuickPassValidationForm';

const tabs: AppTab[] = ['home', 'monitor', 'voice', 'visitors', 'settings'];
const appBasePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const routePrefix = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/') || appBasePath === '/admin' ? '/admin' : appBasePath;
const LAST_ADMIN_TAB_KEY = 'sentinel-admin-last-tab';

function appPath(pathname: string) {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return pathname.slice('/admin'.length) || '/';
  }
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
  const session = getSession();
  return Boolean(session && String(session.role || '').toUpperCase() === 'ADMIN');
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => getSession());
  const [authenticated, setAuthenticated] = useState(hasSavedSession);
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const currentTab = readTab(pathname);
  const showLogin = !authenticated || appPath(pathname) === '/login';

  function setCurrentTab(tab: AppTab) {
    const nextPath = `${routePrefix}/${tab}`;
    window.localStorage.setItem(LAST_ADMIN_TAB_KEY, tab);
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
      } else if (path === '/' || path === '' || path === '/login') {
        const savedTab = window.localStorage.getItem(LAST_ADMIN_TAB_KEY) as AppTab | null;
        path = savedTab && tabs.includes(savedTab) ? `/${savedTab}` : '/home';
        setCurrentUser(getSession());
      } else if (!tabs.includes(path.slice(1) as AppTab)) {
        path = '/home';
        setCurrentUser(getSession());
      } else {
        setCurrentUser(getSession());
      }
      const nextPath = `${routePrefix}${path}`;
      if (nextPath !== window.location.pathname) {
        window.history.replaceState({}, '', nextPath);
      }
      setPathname(nextPath);
      const activeTab = path.slice(1) as AppTab;
      if (tabs.includes(activeTab)) window.localStorage.setItem(LAST_ADMIN_TAB_KEY, activeTab);
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
    const nextPath = `${routePrefix}/home`;
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
      const response = await apiPost('/iot/mode', { mode, ...(mode === 'disarm' ? { lockdown_active: false } : {}) });
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
          <DevicesScreen onNavigate={(tab) => setCurrentTab(tab)} />
        )}

        {currentTab === 'voice' && (
          <VoiceScreen onUnlockDoor={handleUnlockDoor} />
        )}

        {currentTab === 'visitors' && (
          <VisitorsScreen onOpenQuickPassForm={() => setShowQuickPassModal(true)} />
        )}

        {currentTab === 'settings' && <SettingsScreen onLogout={handleLogout} currentUser={currentUser} onProfileUpdated={(profile) => setCurrentUser((current) => ({ ...current, ...profile }))} />}
      </main>

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
