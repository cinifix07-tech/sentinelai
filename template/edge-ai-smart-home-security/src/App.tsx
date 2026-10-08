import React, { useState } from 'react';
import { AppTab, SecurityMode, AppTheme } from './types';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './components/screens/HomeScreen';
import { MonitorScreen } from './components/screens/MonitorScreen';
import { VoiceScreen } from './components/screens/VoiceScreen';
import { VisitorsScreen } from './components/screens/VisitorsScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { QuickPassValidationForm } from './components/QuickPassValidationForm';

export default function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>('home');
  const [securityMode, setSecurityMode] = useState<SecurityMode>('away');
  const [isLockdownActive, setIsLockdownActive] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentTheme, setCurrentTheme] = useState<AppTheme>('daylight');
  const [showSecretAdvisoryModal, setShowSecretAdvisoryModal] = useState<boolean>(false);
  const [showQuickPassModal, setShowQuickPassModal] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleSetSecurityMode = (mode: SecurityMode) => {
    setSecurityMode(mode);
    const labels: Record<SecurityMode, string> = {
      away: 'System Armed: Away (Full Perimeter Radar & AI Guard Active)',
      home: 'System Armed: Home (Porch Sensors Armed, Interior Disarmed)',
      disarm: 'System Disarmed: Porch radar placed in passive log mode',
    };
    showToast(labels[mode]);
  };

  const handleToggleLockdown = () => {
    const nextState = !isLockdownActive;
    setIsLockdownActive(nextState);
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

  return (
    <div
      className={`min-h-screen flex flex-col antialiased selection:bg-primary-fixed transition-colors duration-300 ${getThemeBackgroundClass(
        currentTheme
      )}`}
    >
      {/* Global Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-22 inset-x-4 z-50 max-w-md mx-auto pointer-events-none">
          <div className="bg-[#0b1c30] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto">
            <span className="material-symbols-outlined text-[18px] text-primary-fixed shrink-0">
              info
            </span>
            <span className="flex-1">{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-white/60 hover:text-white shrink-0 ml-1 text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Persistent Global Header */}
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        currentTheme={currentTheme}
        onChangeTheme={(theme) => {
          setCurrentTheme(theme);
          showToast(`Theme switched to ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
        }}
        onToggleHiddenMessage={() => {
          setShowSecretAdvisoryModal(true);
        }}
        onOpenQuickPassForm={() => setShowQuickPassModal(true)}
        unreadAlertCount={2}
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
            onOpenQuickPassForm={() => setShowQuickPassModal(true)}
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

        {currentTab === 'settings' && <SettingsScreen />}
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
