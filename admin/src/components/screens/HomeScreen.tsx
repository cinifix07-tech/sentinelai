import React, { useState } from 'react';
import { AppTab, SecurityMode } from '../../types';
import { BRAND_ASSETS } from '../../mockData';
import { PerimeterActivityChart } from '../PerimeterActivityChart';
import { apiGet, apiPost } from '../../api.js';

interface HomeScreenProps {
  onNavigate: (tab: AppTab) => void;
  securityMode: SecurityMode;
  onSetSecurityMode: (mode: SecurityMode) => void;
  isLockdownActive: boolean;
  onToggleLockdown: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  securityMode,
  onSetSecurityMode,
  isLockdownActive,
  onToggleLockdown,
}) => {
  const [pirTesting, setPirTesting] = useState(false);
  const [pirTestMessage, setPirTestMessage] = useState('Test PIR');
  const [userCount, setUserCount] = useState<number | null>(null);
  const showLogsModal = false;
  const setShowLogsModal = (_open: boolean) => {};
  const events: Array<{ id: string; title: string; description: string; time: string }> = [];
  const showLegacyPreviews = import.meta.env.VITE_ENABLE_LEGACY_PREVIEWS === 'true';

  React.useEffect(() => {
    let active = true;
    apiGet('/users')
      .then((users) => {
        if (!active) return;
        setUserCount(Array.isArray(users) ? users.length : 0);
      })
      .catch(() => {
        if (active) setUserCount(0);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleTestPIR = async () => {
    setPirTesting(true);
    setPirTestMessage('Pinging...');
    try {
      await apiPost('/iot/test-motion', { source: 'admin-dashboard' });
      setPirTestMessage('PIR OK (3.3V)');
    } catch (error) {
      setPirTestMessage(error instanceof Error ? 'PIR unavailable' : 'PIR error');
    } finally {
      window.setTimeout(() => {
        setPirTesting(false);
        setPirTestMessage('Test PIR');
      }, 1500);
    }
  };

  return (
    <div className="flex flex-col w-full gap-5 max-w-7xl mx-auto pb-24">
      {/* Lockdown Alert Banner if active */}
      {isLockdownActive && (
        <div className="bg-[#ffdad6] border border-[#ba1a1a] text-[#93000a] p-3.5 rounded-xl flex items-center justify-between animate-pulse shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[24px]">lock</span>
            <div>
              <p className="font-bold text-xs uppercase tracking-wider">Perimeter Lockdown Active</p>
              <p className="text-[11px]">All exterior strikes locked. Motion alarm primed.</p>
            </div>
          </div>
          <button
            onClick={onToggleLockdown}
            className="px-3 py-1.5 text-xs font-semibold bg-[#ba1a1a] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Release
          </button>
        </div>
      )}

      {/* Main Responsive Grid: 12-column adaptive layout on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (7 cols on lg screens): Core Status & Monitoring */}
        <div className="lg:col-span-12 flex flex-col gap-4">
          {/* Top System Security Hero */}
          <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-colors ${
                    isLockdownActive
                      ? 'bg-[#ffdad6] text-[#ba1a1a]'
                      : securityMode === 'disarm'
                      ? 'bg-surface-container text-[#3e4947]'
                      : 'bg-primary-fixed text-primary'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px] fill-1">
                    {isLockdownActive
                      ? 'security_update_warning'
                      : securityMode === 'disarm'
                      ? 'lock_open'
                      : 'verified_user'}
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-display font-semibold text-lg text-on-surface tracking-tight leading-tight">
                    {isLockdownActive
                      ? 'LOCKDOWN ACTIVE'
                      : securityMode === 'disarm'
                      ? 'SYSTEM DISARMED'
                      : 'SYSTEM SECURE'}
                  </span>
                  <span className="text-[11px] text-on-surface-variant flex items-center gap-1.5 mt-0.5 font-medium">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isLockdownActive
                          ? 'bg-[#ba1a1a]'
                          : securityMode === 'disarm'
                          ? 'bg-[#6e7977]'
                          : 'bg-primary'
                      }`}
                    />
                    {securityMode === 'disarm'
                      ? 'Sensors standby • Porch manual'
                      : 'All systems normal • Just now'}
                  </span>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  isLockdownActive
                    ? 'bg-[#ffdad6] text-[#ba1a1a]'
                    : 'bg-surface-container text-primary'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isLockdownActive ? 'bg-[#ba1a1a]' : 'bg-primary'
                  } animate-pulse`}
                />
                {isLockdownActive ? 'HIGH ALERT' : 'LIVE GUARD'}
              </span>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-container-low rounded-lg">
              <button
                onClick={() => onSetSecurityMode('away')}
                className={`h-[44px] px-2 rounded-md text-[11px] flex items-center justify-center gap-1 transition-all ${
                  securityMode === 'away'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/50'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">lock</span>
                <span>Armed Away</span>
              </button>
              <button
                onClick={() => onSetSecurityMode('home')}
                className={`h-[44px] px-2 rounded-md text-[11px] flex items-center justify-center gap-1 transition-all ${
                  securityMode === 'home'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/50'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">home</span>
                <span>Armed Home</span>
              </button>
              <button
                onClick={() => onSetSecurityMode('disarm')}
                className={`h-[44px] px-2 rounded-md text-[11px] flex items-center justify-center gap-1 transition-all ${
                  securityMode === 'disarm'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-lowest/50'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">lock_open</span>
                <span>Disarmed</span>
              </button>
            </div>
          </section>

          {/* 4 Status Metric Cards (Responsive: 2 cols on mobile, 4 cols on sm+) */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Card 1: System Status */}
            <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  System
                </span>
                <div className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">dns</span>
                </div>
              </div>
              <div>
                <div className="font-display font-semibold text-base text-on-surface">ONLINE</div>
                <div className="text-[12px] text-on-surface-variant mt-0.5 truncate">Normal operation</div>
              </div>
            </div>

            {/* Card 2: Motion Sensor */}
            <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  PIR Sensor
                </span>
                <div className="w-7 h-7 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">sensors</span>
                </div>
              </div>
              <div>
                <div className={`font-display font-semibold text-base ${securityMode === 'disarm' ? 'text-on-surface-variant' : 'text-primary'}`}>
                  {securityMode === 'disarm' ? 'PASSIVE' : securityMode === 'home' ? 'ARMED HOME' : 'ARMED AWAY'}
                </div>
                <div className="text-[12px] text-on-surface-variant mt-0.5 truncate">HC-SR501 • Porch</div>
              </div>
            </div>

            {/* Card 3: AI Guard */}
            <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  AI Guard
                </span>
                <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center text-tertiary">
                  <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                </div>
              </div>
              <div>
                <div className="font-display font-semibold text-base text-on-surface">READY</div>
                <div className="text-[12px] text-on-surface-variant mt-0.5 truncate">Voice active</div>
              </div>
            </div>

            {/* Card 4: Perimeter */}
            <div className="bg-surface-container-lowest rounded-xl p-3 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
                  Users
                </span>
                <div className="w-7 h-7 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">shield</span>
                </div>
              </div>
              <div>
                <div className="font-display font-semibold text-base text-on-surface">
                  {userCount === null ? '—' : userCount} USERS
                </div>
                <div className="text-[12px] text-on-surface-variant mt-0.5 truncate">Registered users</div>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-[0_18px_45px_rgba(11,28,48,0.08)] border border-surface-container/60 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Rapid Response</span>
                <h2 className="font-display font-semibold text-base text-on-surface mt-0.5">Quick Controls</h2>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-[11px] font-bold text-primary self-start sm:self-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Secure actions armed
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <button
                onClick={onToggleLockdown}
                className={`min-h-[54px] rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all duration-200 active:scale-[0.99] ${
                  isLockdownActive
                    ? 'bg-[#ba1a1a] text-white hover:bg-[#93000a]'
                    : 'bg-primary text-on-primary hover:bg-primary-container'
                }`}
              >
                <span className="material-symbols-outlined text-[21px]">
                  {isLockdownActive ? 'lock_open' : 'lock_clock'}
                </span>
                <span>{isLockdownActive ? 'Deactivate Porch Lockdown' : 'Instant Porch Lockdown'}</span>
              </button>

            </div>
          </section>

          {showLegacyPreviews && <>
          {/* Compact Live Motion Monitor Preview */}
          <section
            onClick={() => onNavigate('monitor')}
            className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3 cursor-pointer hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                <span className="font-display font-semibold text-base text-on-surface group-hover:text-primary transition-colors">
                  Perimeter Radar
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-low text-[11px] font-semibold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                HC-SR501 Active
              </span>
            </div>

            <div className="flex items-center gap-4 p-3 bg-surface-container-low rounded-xl">
              {/* Radar Circle SVG */}
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" fill="none" r="45" stroke="#dce9ff" strokeDasharray="2 2" strokeWidth="1" />
                  <circle cx="50" cy="50" fill="none" r="30" stroke="#dce9ff" strokeWidth="1" />
                  <circle cx="50" cy="50" fill="none" r="15" stroke="#dce9ff" strokeWidth="1" />
                  <line stroke="#dce9ff" strokeWidth="0.75" x1="50" x2="50" y1="5" y2="95" />
                  <line stroke="#dce9ff" strokeWidth="0.75" x1="5" x2="95" y1="50" y2="50" />
                  <path d="M 50 50 L 50 5 A 45 45 0 0 1 90 25 Z" fill="rgba(0, 92, 85, 0.12)" />
                  <circle className="animate-pulse" cx="68" cy="38" fill="#005c55" r="4" />
                  <circle cx="68" cy="38" fill="none" opacity="0.6" r="8" stroke="#80d5cb" strokeWidth="1" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="material-symbols-outlined text-[18px] text-primary">radar</span>
                </div>
              </div>

              {/* Radar Meta Details */}
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <span className="text-[11px] text-primary uppercase font-bold tracking-wider">
                  Front Entrance Zone
                </span>
                <span className="text-sm text-on-surface font-semibold truncate mt-0.5">
                  Motion Logged: 2m ago
                </span>
                <span className="text-[12px] text-on-surface-variant mt-1 leading-tight">
                  Sensitivity threshold 82% • Angle 110° normal
                </span>
                <div className="mt-2 flex items-center gap-1.5 text-on-surface-variant text-[11px] font-semibold">
                  <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                  <span>Verified Human Cadence</span>
                </div>
              </div>
            </div>
          </section>

          {/* Active Visitor Verification Banner */}
          <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px] text-secondary">record_voice_over</span>
                <span className="text-[11px] uppercase tracking-wider text-secondary font-bold">
                  Conversational Verification
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-[11px] font-bold text-on-secondary-fixed">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                Step 2 of 3
              </span>
            </div>

            <div className="flex items-start gap-3">
              <img
                className="w-16 h-16 rounded-lg object-cover shadow-sm shrink-0"
                src={BRAND_ASSETS.courierPortrait}
                alt="Courier delivery driver"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-display font-semibold text-sm text-on-surface truncate">
                    Courier Delivery
                  </span>
                  <span className="text-[11px] text-on-surface-variant font-mono shrink-0">14:34</span>
                </div>
                <p className="text-[12px] text-on-surface-variant line-clamp-2 mt-0.5">
                  "Hi, I have a package from Express Logistics requiring standard confirmation."
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container text-[11px] font-semibold text-primary">
                    <span className="material-symbols-outlined text-[14px]">graphic_eq</span>
                    Voice Confirmed 96%
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Audio Transcript Peek Bar */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-container-low mt-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-secondary shrink-0" />
                <span className="text-[12px] text-on-surface-variant truncate">
                  AI: "Please place the package inside parcel drop."
                </span>
              </div>
              <button
                onClick={() => onNavigate('voice')}
                className="shrink-0 flex items-center text-primary text-[11px] font-bold pl-2 hover:opacity-80 transition-opacity"
              >
                <span>View Log</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </section>
          </>}
        </div>

        {/* Right Column (5 cols on lg screens): Actions, Timeline, Hardware */}
        <div className="hidden">
          {/* Quick Action Buttons & Panic Action */}
          <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3">
            <span className="font-display font-semibold text-sm text-on-surface">Quick Controls</span>
            <div className="grid grid-cols-3 gap-2">
              {/* Action 1: Test PIR */}
              <button
                onClick={handleTestPIR}
                disabled={pirTesting}
                className="h-[52px] px-2 py-1.5 rounded-xl bg-surface-container-low text-on-surface shadow-xs text-[11px] font-semibold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px] text-primary">
                  {pirTesting ? 'sync' : 'sensors'}
                </span>
                <span className="truncate">{pirTestMessage}</span>
              </button>

              {/* Action 2: Intercom */}
              <button
                onClick={() => onNavigate('voice')}
                className="h-[52px] px-2 py-1.5 rounded-xl bg-surface-container-low text-on-surface shadow-xs text-[11px] font-semibold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px] text-secondary">mic</span>
                <span className="truncate">Intercom</span>
              </button>

              {/* Action 3: Event Logs */}
              <button
                onClick={() => onNavigate('settings')}
                className="h-[52px] px-2 py-1.5 rounded-xl bg-surface-container-low text-on-surface shadow-xs text-[11px] font-semibold flex flex-col items-center justify-center gap-1 active:scale-95 transition-all hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px] text-tertiary">history</span>
                <span className="truncate">Access Logs</span>
              </button>
            </div>

            {/* Main Panic / Instant Lockdown Action */}
            <button
              onClick={onToggleLockdown}
              className={`w-full h-[48px] rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all duration-200 active:scale-[0.99] ${
                isLockdownActive
                  ? 'bg-[#ba1a1a] text-white hover:bg-[#93000a]'
                  : 'bg-primary text-on-primary hover:bg-primary-container'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isLockdownActive ? 'lock_open' : 'lock_clock'}
              </span>
              <span>{isLockdownActive ? 'Deactivate Porch Lockdown' : 'Instant Porch Lockdown'}</span>
            </button>

          </section>

        </div>
      </div>

      {/* Full-width Perimeter Activity & Motion Telemetry Chart */}
      <PerimeterActivityChart onNavigateToMonitor={() => onNavigate('monitor')} />

      {/* Full Event Logs Modal */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-2xl border border-surface-container max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">security</span>
                <h3 className="font-display font-semibold text-base text-[#0b1c30]">Full Perimeter Event Logs</h3>
              </div>
              <button
                onClick={() => setShowLogsModal(false)}
                className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-sm text-[#3e4947] hover:text-black"
              >
                ✕
              </button>
            </div>
            <div className="divide-y divide-surface-container-low overflow-y-auto py-2 flex-1 space-y-2">
              {events.map((e) => (
                <div key={e.id} className="pt-2 flex items-start justify-between gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-on-surface">{e.title}</span>
                    <p className="text-[#3e4947] text-[11px] mt-0.5">{e.description}</p>
                  </div>
                  <span className="font-mono text-[11px] text-[#6e7977] shrink-0">{e.time}</span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-surface-container flex justify-end">
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-4 py-2 bg-surface-container text-xs font-semibold rounded-xl hover:bg-surface-container-high"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
