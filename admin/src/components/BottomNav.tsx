import React from 'react';
import { AppTab } from '../types';

interface BottomNavProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

interface NavItem {
  id: AppTab;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: 'shield_with_house' },
  { id: 'monitor', label: 'Devices', icon: 'devices' },
  { id: 'voice', label: 'AI Chats', icon: 'graphic_eq' },
  { id: 'visitors', label: 'Users', icon: 'group' },
  { id: 'settings', label: 'Settings', icon: 'tune' },
];

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange }) => {
  return (
    <nav className="fixed bottom-0 w-full z-40 pb-safe bg-[#f8f9ff]/92 backdrop-blur-xl shadow-[0_-2px_12px_rgba(0,0,0,0.05)] border-t border-surface-container-high/60">
      <div className="flex items-center justify-around h-16 px-2 max-w-xl mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 gap-1 transition-all duration-150 ${
                isActive
                  ? 'text-primary font-semibold scale-105'
                  : 'text-[#3e4947] hover:text-[#0b1c30] opacity-80 hover:opacity-100'
              }`}
            >
              <div className="relative">
                <span
                  className={`material-symbols-outlined text-[22px] ${
                    isActive ? 'fill-1' : ''
                  }`}
                >
                  {item.icon}
                </span>
                {item.id === 'voice' && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-secondary animate-ping" />
                )}
              </div>
              <span className="text-[11px] leading-none tracking-tight font-medium">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
