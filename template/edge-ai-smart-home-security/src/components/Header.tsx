import React, { useState } from 'react';
import { AppTab, AppTheme } from '../types';
import { BRAND_ASSETS } from '../mockData';

interface HeaderProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  currentTheme: AppTheme;
  onChangeTheme: (theme: AppTheme) => void;
  onToggleHiddenMessage: () => void;
  onOpenQuickPassForm: () => void;
  unreadAlertCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  currentTheme,
  onChangeTheme,
  onToggleHiddenMessage,
  onOpenQuickPassForm,
  unreadAlertCount = 2,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const NAV_LINKS: { id: AppTab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: 'shield_with_house' },
    { id: 'monitor', label: 'Monitor', icon: 'radar' },
    { id: 'voice', label: 'AI Voice', icon: 'graphic_eq' },
    { id: 'visitors', label: 'Visitors', icon: 'group' },
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
      <header className="fixed top-0 w-full z-40 pt-safe bg-[#f8f9ff]/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container-high/60 transition-colors duration-300">
        <div className="h-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Brand Name */}
          <div
            onClick={() => onTabChange('home')}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer select-none"
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
          <nav className="hidden lg:flex items-center gap-1 bg-surface-container/60 p-1.5 rounded-full border border-surface-container">
            {NAV_LINKS.map((item) => {
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
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

          {/* Micro Hardware Status Chips (hidden on small screens, visible on md+) */}
          <div className="hidden md:flex items-center gap-1.5 py-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-[11px] font-semibold text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              ESP32 Online
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-[11px] font-semibold text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              MQTT
            </span>
          </div>

          {/* Actions: Theme Switcher, Secret Advisory, Quick Form, Notifications & Avatar */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 relative">
            {/* Quick Access Validation Form Button */}
            <button
              onClick={onOpenQuickPassForm}
              title="Issue Quick Visitor Pass (Validated Form)"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary-container shadow-xs active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
              <span className="hidden xl:inline">Issue Pass</span>
            </button>

            {/* Change Background Color Button */}
            <div className="relative">
              <button
                aria-label="Change Background Color"
                title="Change Background Color & Atmosphere"
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="w-10 h-10 flex items-center justify-center rounded-full text-[#3e4947] hover:text-[#0b1c30] hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">palette</span>
              </button>

              {/* Theme Dropdown Popover */}
              {showThemeMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-surface-container p-2 z-50 animate-in fade-in zoom-in-95">
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

            {/* Reveal Hidden AI Security Advisory Button */}
            <button
              aria-label="Reveal Secret Advisory Message"
              title="Reveal Encrypted Sentinel Advisory"
              onClick={onToggleHiddenMessage}
              className="w-10 h-10 flex items-center justify-center rounded-full text-[#006398] hover:bg-secondary-fixed/50 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">encrypted</span>
            </button>

            {/* Notifications Button */}
            <button
              aria-label="Notifications"
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-10 h-10 flex items-center justify-center relative rounded-full text-[#3e4947] hover:text-[#0b1c30] hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {unreadAlertCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ba1a1a] ring-2 ring-surface animate-pulse" />
              )}
            </button>

            {/* Profile Avatar */}
            <button
              aria-label="User Profile"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="relative flex items-center justify-center rounded-full ring-2 ring-[#005c55]/20 hover:ring-[#005c55] transition-all p-0.5 ml-0.5"
            >
              <img
                src={BRAND_ASSETS.profile}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#005c55] ring-2 ring-white" />
            </button>
          </div>
        </div>
      </header>

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
              <div className="py-2.5 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <p className="font-semibold text-[#0b1c30]">PIR Motion Logged (Front Entrance)</p>
                  <p className="text-[#3e4947] text-[11px] mt-0.5">Automated human cadence verified. 2 mins ago.</p>
                </div>
              </div>
              <div className="py-2.5 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-secondary mt-1.5 shrink-0" />
                <div>
                  <p className="font-semibold text-[#0b1c30]">Courier Delivery In Progress</p>
                  <p className="text-[#3e4947] text-[11px] mt-0.5">FedEx express carrier requested parcel drop authorization.</p>
                </div>
              </div>
              <div className="py-2.5 flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#616980] mt-1.5 shrink-0" />
                <div>
                  <p className="font-semibold text-[#0b1c30]">ESP32 Node Heartbeat Synced</p>
                  <p className="text-[#3e4947] text-[11px] mt-0.5">MQTT ping 14ms • Wi-Fi RSSI -61 dBm (Stable).</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowNotifications(false)}
              className="w-full mt-2 py-2 text-center text-xs font-semibold text-primary bg-surface-container-low rounded-xl hover:bg-surface-container"
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
              <img
                src={BRAND_ASSETS.profile}
                alt="Profile"
                className="w-11 h-11 rounded-full object-cover ring-2 ring-primary/20"
              />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sm text-[#0b1c30]">Sarah Chen</span>
                <span className="text-[11px] text-[#3e4947]">Primary Homeowner</span>
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
          </div>
        </div>
      )}
    </>
  );
};

