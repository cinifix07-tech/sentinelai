import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AppTab, AppTheme } from '../types';
import { BRAND_ASSETS } from '../mockData';
import { apiGet, apiPut } from '../api.js';

interface AlertRow {
  alert_id?: number | string;
  id?: number | string;
  alert_type?: string;
  title?: string;
  message?: string;
  severity?: string;
  is_read?: boolean;
  created_at?: string;
  source?: 'alert' | 'activity' | 'communication';
  sender_user_id?: string;
}

interface HeaderProps {
  onLogout: () => void;
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  currentTheme: AppTheme;
  onChangeTheme: (theme: AppTheme) => void;
  onOpenAiAssistant?: () => void;
  unreadAlertCount?: number;
  currentUser?: {
    full_name?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
}

export const Header: React.FC<HeaderProps> = ({
  onLogout,
  currentTab,
  onTabChange,
  currentTheme,
  onChangeTheme,
  onOpenAiAssistant,
  unreadAlertCount = 0,
  currentUser,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
  const profileName = currentUser?.full_name || currentUser?.name || currentUser?.email || 'Admin User';
  const profileRole = currentUser?.role === 'ADMIN' ? 'Administrator' : currentUser?.role || 'User';
  const profileInitials = profileName.split(/\s+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const visibleAlerts = useMemo(() => alerts.filter((alert) => !dismissedAlertIds.has(String(alert.alert_id || alert.id))).slice(0, 5), [alerts, dismissedAlertIds]);
  const unreadCount = useMemo(() => visibleAlerts.filter((alert) => !alert.is_read).length, [visibleAlerts]);

  async function loadAlerts() {
    setAlertsLoading(true);
    setAlertsError('');
    try {
      const [databaseAlerts, activities] = await Promise.all([
        apiGet('/alerts'),
        apiGet('/access/attempts'),
      ]);
      const communicationNotifications = await apiGet('/communicate/notifications').catch(() => []);
      const normalizedAlerts = databaseAlerts.map((alert: AlertRow) => ({ ...alert, source: 'alert' as const }))
        .concat((activities || []).map((activity: Record<string, unknown>, index: number) => ({
          id: `activity-${activity.attempt_id || activity.id || index}`,
          title: String(activity.result || 'Activity update'),
          message: String(activity.reason || 'Security activity recorded.'),
          created_at: String(activity.created_at || activity.attempt_time || ''),
          is_read: false,
          source: 'activity' as const,
        })))
        .concat((communicationNotifications || []).map((message: Record<string, unknown>) => ({
          id: `communication-${message.message_id}`,
          title: `Message from ${String(message.sender_name || 'User')}`,
          message: String(message.message || 'New secure message.'),
          created_at: String(message.created_at || ''),
          is_read: false,
          source: 'communication' as const,
          sender_user_id: String(message.sender_user_id || ''),
        })))
        .sort((left: AlertRow, right: AlertRow) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());
      setAlerts(normalizedAlerts.slice(0, 5));
    } catch (error) {
      setAlertsError(error instanceof Error ? error.message : 'Unable to load alerts.');
    } finally {
      setAlertsLoading(false);
    }
  }

  async function markAllReviewed() {
    const unreadAlerts = visibleAlerts.filter((alert) => !alert.is_read && (alert.alert_id || alert.id));
    if (!unreadAlerts.length) return;
    setAlertsError('');
    try {
      await Promise.all(unreadAlerts.map((alert) => alert.source === 'communication' && alert.sender_user_id
        ? apiPut(`/communicate/messages/${alert.sender_user_id}/read`)
        : alert.source === 'alert'
          ? apiPut(`/alerts/${alert.alert_id || alert.id}/read`)
          : Promise.resolve()));
      await loadAlerts();
    } catch (error) {
      setAlertsError(error instanceof Error ? error.message : 'Could not mark alerts reviewed.');
    }
  }

  function formatAlertTime(value?: string) {
    if (!value) return 'No timestamp';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No timestamp';
    const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? '' : 's'} ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function alertDotClass(alert: AlertRow) {
    if (alert.is_read) return 'bg-[#616980]';
    if (alert.severity === 'critical' || alert.severity === 'high') return 'bg-[#ba1a1a]';
    if (alert.severity === 'warning' || alert.severity === 'medium') return 'bg-secondary';
    return 'bg-primary';
  }

  useEffect(() => {
    loadAlerts();
    const timer = window.setInterval(loadAlerts, 15000);
    return () => window.clearInterval(timer);
  }, []);

  function dismissAlert(alert: AlertRow) {
    const id = String(alert.alert_id || alert.id || `${alert.title}-${alert.created_at}`);
    setDismissedAlertIds((current) => new Set(current).add(id));
    if (alert.source === 'alert' && (alert.alert_id || alert.id)) {
      apiPut(`/alerts/${alert.alert_id || alert.id}/read`).catch(() => undefined);
    } else if (alert.source === 'communication' && alert.sender_user_id) {
      apiPut(`/communicate/messages/${alert.sender_user_id}/read`).catch(() => undefined);
    }
  }

  function openAlert(alert: AlertRow) {
    const content = `${alert.title || ''} ${alert.message || ''}`.toLowerCase();
    const destination: AppTab = content.includes('user') || content.includes('login') || content.includes('password')
      ? 'visitors'
      : content.includes('access') || content.includes('door') || content.includes('motion')
        ? 'monitor'
        : content.includes('message') || content.includes('chat') || content.includes('communication')
          ? 'voice'
          : 'home';
    dismissAlert(alert);
    setShowNotifications(false);
    onTabChange(destination);
  }

  const NAV_LINKS: { id: AppTab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: 'shield_with_house' },
    { id: 'monitor', label: 'Devices', icon: 'devices' },
    { id: 'voice', label: 'AI Chats', icon: 'graphic_eq' },
    { id: 'visitors', label: 'Users', icon: 'group' },
    { id: 'settings', label: 'Settings', icon: 'tune' },
  ];

  const THEMES: { id: AppTheme; label: string; bgClass: string; desc: string }[] = [
    { id: 'daylight', label: 'Daylight Calm', bgClass: 'bg-[#f8f9ff]', desc: 'Light serene architectural' },
    { id: 'twilight', label: 'Twilight Slate', bgClass: 'bg-[#1e293b]', desc: 'High-security low glare' },
    { id: 'midnight', label: 'Midnight Patrol', bgClass: 'bg-[#090e17]', desc: 'Deep stealth dark atmosphere' },
    { id: 'sage', label: 'Sage Garden', bgClass: 'bg-[#f0fdf4]', desc: 'Soft organic domestic tone' },
  ];

  return (
    <>
      <button type="button" className={`ai-floating-launcher ${currentTab === 'voice' ? 'ai-floating-launcher-hidden' : ''}`} onClick={() => onOpenAiAssistant?.()} aria-label="Open AI assistant chat">
        <span className="ai-floating-launcher-pulse" />
        <span className="material-symbols-outlined">smart_toy</span>
        <span className="ai-floating-launcher-label">AI Assistant</span>
      </button>
      <header className="admin-sidebar-shell fixed top-0 w-full z-40 pt-safe bg-[#f8f9ff]/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container-high/60 transition-colors duration-300">
        <div className="admin-sidebar-inner h-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Brand Name */}
          <div
            onClick={() => onTabChange('home')}
            className="admin-sidebar-brand flex items-center gap-2.5 min-w-0 cursor-pointer select-none"
          >
            <img
              src={BRAND_ASSETS.emblem}
              alt="Sentinel AI Emblem"
              className="h-8 w-auto object-contain shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="font-display font-bold text-lg tracking-tight text-[#0b1c30] leading-none truncate">
                SENTINEL AI
              </span>
              <span className="text-[11px] text-[#3e4947] font-medium leading-tight truncate mt-0.5">
                Smart Home Security
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links (Responsive: visible on lg+ screens) */}
          <nav className="admin-sidebar-nav hidden lg:flex items-center gap-1 bg-surface-container/60 p-1.5 rounded-full border border-surface-container" aria-label="Primary navigation">
            {NAV_LINKS.map((item) => {
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                    active
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-[#3e4947] hover:text-[#0b1c30] hover:bg-white/60'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[17px] ${active ? 'fill-1' : ''}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Actions: Theme Switcher, Secret Advisory, Notifications & Avatar */}
          <div className="admin-sidebar-actions flex items-center gap-1 sm:gap-2 shrink-0 relative">
            {/* Change Background Color Button */}
            <div className="admin-theme-picker relative">
              <button
                type="button"
                aria-label="Change Background Color"
                title="Change Background Color & Atmosphere"
                aria-expanded={showThemeMenu}
                onClick={() => setShowThemeMenu((open) => !open)}
                className="w-10 h-10 flex items-center justify-center rounded-full text-[#3e4947] hover:text-[#0b1c30] hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">palette</span>
                <span className="admin-color-label"></span>
              </button>

              {/* Theme Dropdown Popover */}
              {showThemeMenu && (
                <div className="admin-theme-menu absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-surface-container p-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1.5 border-b border-surface-container text-[11px] font-bold text-on-surface uppercase tracking-wider">
                    Background Atmosphere
                  </div>
                  <div className="py-1 space-y-1">
                    {THEMES.map((th) => (
                      <button
                        key={th.id}
                        onClick={() => {
                          onChangeTheme(th.id);
                          setShowThemeMenu(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-left transition-colors ${
                          currentTheme === th.id
                            ? 'bg-primary text-white font-semibold'
                            : 'text-[#3e4947] hover:bg-surface-container'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full border border-black/20 ${th.bgClass}`} />
                        <div className="flex flex-col min-w-0">
                          <span className="leading-tight">{th.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Notifications Button */}
            <button
              aria-label="Notifications"
              onClick={() => {
                setShowNotifications(!showNotifications);
                loadAlerts();
              }}
              className="w-10 h-10 flex items-center justify-center relative rounded-full text-[#3e4947] hover:text-[#0b1c30] hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {(unreadCount || unreadAlertCount) > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ba1a1a] ring-2 ring-surface animate-pulse" />
              )}
            </button>

            {/* Profile Avatar */}
            <button
              aria-label="User Profile"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="relative flex items-center justify-center rounded-full ring-2 ring-[#005c55]/20 hover:ring-[#005c55] transition-all p-0.5 ml-0.5"
            >
              <span className="w-8 h-8 rounded-full grid place-items-center bg-primary-fixed text-primary text-[11px] font-bold" aria-hidden="true">
                {profileInitials}
              </span>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#005c55] ring-2 ring-white" />
            </button>
          </div>
        </div>
      </header>

      {showThemeMenu && typeof document !== 'undefined' && createPortal(
        <div className="admin-theme-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowThemeMenu(false);
        }}>
          <div className="admin-theme-modal" role="dialog" aria-modal="true" aria-labelledby="theme-modal-title">
            <div className="admin-theme-modal-header">
              <div>
                <span className="admin-theme-modal-kicker">COLOR / BACKGROUND ATMOSPHERE</span>
                <h2 id="theme-modal-title">Background atmosphere</h2>
              </div>
              <button type="button" className="admin-theme-modal-close" onClick={() => setShowThemeMenu(false)} aria-label="Close background atmosphere selector">×</button>
            </div>
            <div className="admin-theme-modal-options">
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => {
                    onChangeTheme(th.id);
                    setShowThemeMenu(false);
                  }}
                  className={`admin-theme-option ${currentTheme === th.id ? 'is-active' : ''}`}
                >
                  <span className={`admin-theme-swatch ${th.bgClass}`} />
                  <span><strong>{th.label}</strong><small>{th.desc}</small></span>
                  {currentTheme === th.id && <span className="material-symbols-outlined">check</span>}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Notifications Drawer Modal */}
      {showNotifications && (
        <div className="fixed inset-0 z-50 flex justify-center items-start pt-20 px-4 bg-black/20 backdrop-blur-xs">
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-surface-container p-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">notifications_active</span>
                <span className="font-semibold text-sm text-[#0b1c30]">Security Notifications</span>
              </div>
              <button
                onClick={() => setShowNotifications(false)}
                className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-xs text-[#3e4947] hover:text-black"
              >
                ✕
              </button>
            </div>
            <div className="divide-y divide-surface-container-low text-xs py-2 max-h-72 overflow-y-auto">
              {alertsLoading && (
                <div className="py-5 text-center text-[#3e4947]">Loading alerts...</div>
              )}
              {!alertsLoading && alertsError && (
                <div className="py-4 text-center text-[#ba1a1a]">{alertsError}</div>
              )}
              {!alertsLoading && !alertsError && visibleAlerts.length === 0 && (
                <div className="py-5 text-center text-[#3e4947]">No alerts in the database.</div>
              )}
              {!alertsLoading && !alertsError && visibleAlerts.map((alert) => (
                <div className="admin-notification-row py-2.5 flex items-start gap-2.5" key={alert.alert_id || alert.id || `${alert.title}-${alert.created_at}`} onClick={() => openAlert(alert)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') openAlert(alert); }}>
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${alertDotClass(alert)}`} />
                  <div>
                    <p className="font-semibold text-[#0b1c30]">{alert.title || alert.alert_type || 'Security alert'}</p>
                    <p className="text-[#3e4947] text-[11px] mt-0.5">
                      {alert.message || alert.severity || 'Alert recorded.'}
                      <span> {formatAlertTime(alert.created_at)}.</span>
                    </p>
                  </div>
                  <button type="button" className="admin-notification-dismiss ml-auto" aria-label="Dismiss notification" onClick={(event) => { event.stopPropagation(); dismissAlert(alert); }}>×</button>
                </div>
              ))}
              {false && <div className="py-2.5 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#616980] mt-1.5 shrink-0" />
                <div>
                  <p className="font-semibold text-[#0b1c30]">ESP32 Node Heartbeat Synced</p>
                  <p className="text-[#3e4947] text-[11px] mt-0.5">MQTT ping 14ms • Wi-Fi RSSI -61 dBm (Stable).</p>
                </div>
              </div>}
            </div>
            <button
              onClick={markAllReviewed}
              disabled={alertsLoading || unreadCount === 0}
              className="w-full mt-2 py-2 text-center text-xs font-semibold text-primary bg-surface-container-low rounded-xl hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
            >
              Mark all as reviewed
            </button>
          </div>
        </div>
      )}

      {/* User Profile Popover */}
      {showProfileMenu && (
        <div className="fixed inset-0 z-50 flex justify-center items-start pt-20 px-4 bg-black/20 backdrop-blur-xs">
          <div
            className="w-full max-w-xs bg-white rounded-2xl shadow-xl border border-surface-container p-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 pb-3 border-b border-surface-container">
              <span className="w-11 h-11 rounded-full grid place-items-center bg-primary-fixed text-primary text-sm font-bold ring-2 ring-primary/20" aria-hidden="true">
                {profileInitials}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sm text-[#0b1c30]">{profileName}</span>
                <span className="text-[11px] text-[#3e4947]">{profileRole}</span>
                <span className="text-[10px] text-primary font-mono mt-0.5">Residence #402-A</span>
              </div>
            </div>
            <div className="py-2 space-y-1 text-xs">
              <div className="p-2 rounded-lg bg-surface-container-low flex items-center justify-between">
                <span className="text-[#3e4947]">Location:</span>
                <span className="font-medium text-[#0b1c30]">Oakridge Estates (Porch)</span>
              </div>
              <div className="p-2 rounded-lg bg-surface-container-low flex items-center justify-between">
                <span className="text-[#3e4947]">Sentinel AI Tier:</span>
                <span className="font-semibold text-primary">Pro Edge (ESP32 Live)</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onTabChange('settings');
                }}
                className="flex-1 py-2 text-center text-xs font-semibold text-white bg-primary rounded-xl hover:bg-primary-container transition-colors"
              >
                System Settings
              </button>
              <button
                onClick={() => setShowProfileMenu(false)}
                className="px-3 py-2 text-center text-xs font-semibold text-[#3e4947] bg-surface-container-low rounded-xl hover:bg-surface-container"
              >
                Close
              </button>
            </div>
            <button
              onClick={() => { setShowProfileMenu(false); onLogout(); }}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
};
