import React from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Building2, 
  TrendingUp, 
  Bell, 
  Settings,
  Shield,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { DongSonDrum, DongSonBorder } from './DongSonMotif';

export type NavTab = 'dashboard' | 'courses' | 'users' | 'units' | 'progress' | 'notifications' | 'settings' | 'firebase-diagnostics';

export interface SidebarProps {
  activeTab: NavTab | string;
  setActiveTab?: (tab: NavTab) => void;
  onSelectTab?: (tab: string) => void;
  trashCount?: number;
  stats?: {
    totalCourses: number;
    totalLessons: number;
    unreadNotifs?: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  onSelectTab,
  trashCount = 0,
  stats 
}) => {
  const handleTabClick = (tabId: NavTab) => {
    if (onSelectTab) {
      onSelectTab(tabId);
    } else if (setActiveTab) {
      setActiveTab(tabId);
    }
  };

  const menuItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'TỔNG QUAN',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'courses' as NavTab,
      label: 'GIÁO DỤC CHÍNH TRỊ',
      icon: BookOpen,
      badge: null,
    },
    {
      id: 'users' as NavTab,
      label: 'NGƯỜI DÙNG',
      icon: Users,
      badge: null,
    },
    {
      id: 'units' as NavTab,
      label: 'ĐƠN VỊ',
      icon: Building2,
      badge: null,
    },
    {
      id: 'progress' as NavTab,
      label: 'TIẾN ĐỘ HỌC TẬP',
      icon: TrendingUp,
      badge: null,
    },
    {
      id: 'notifications' as NavTab,
      label: 'THÔNG BÁO',
      icon: Bell,
      badge: stats?.unreadNotifs ? `${stats.unreadNotifs}` : undefined,
    },
    {
      id: 'settings' as NavTab,
      label: 'CÀI ĐẶT',
      icon: Settings,
      badge: null,
    },
    {
      id: 'firebase-diagnostics' as NavTab,
      label: 'CHẨN ĐOÁN FIREBASE',
      icon: ShieldCheck,
      badge: 'LIVE',
    },
  ];

  return (
    <aside className="w-72 bg-[#0B1E3B] text-white flex flex-col shrink-0 border-r border-slate-700/80 relative select-none shadow-lg z-30">
      {/* Background Dong Son Watermark */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 pointer-events-none opacity-5">
        <DongSonDrum className="w-80 h-80" color="#F59E0B" opacity={1} />
      </div>
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 pointer-events-none opacity-5">
        <DongSonDrum className="w-72 h-72" color="#F59E0B" opacity={1} />
      </div>

      {/* Military Command Header */}
      <div className="p-5 border-b border-slate-700/80 relative z-10 bg-slate-900/40">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 p-0.5 shadow flex-shrink-0">
            <div className="w-full h-full bg-[#0B1E3B] rounded-[9px] flex items-center justify-center relative overflow-hidden">
              <DongSonDrum className="absolute inset-0 w-full h-full scale-150 opacity-20" color="#FBBF24" />
              <Shield className="w-5 h-5 text-amber-300 relative z-10 drop-shadow" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold tracking-wider text-amber-300 uppercase">
              BỘ TƯ LỆNH VÙNG 4
            </div>
            <div className="text-sm font-extrabold text-white tracking-tight uppercase leading-tight truncate">
              HẢI QUÂN NHÂN DÂN
            </div>
            <div className="text-[11px] text-slate-300 font-medium truncate mt-0.5">
              Ban Tuyên huấn Vùng 4
            </div>
          </div>
        </div>

        <div className="mt-3.5 pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-300 font-medium">
          <span className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
            <span>Hệ Thống Trực Tuyến</span>
          </span>
          <span className="bg-slate-800 text-amber-300 px-2 py-0.5 rounded text-[10px] font-mono border border-slate-700">
            Phiên bản 2026
          </span>
        </div>
      </div>

      <DongSonBorder color="#F59E0B" className="h-1.5 opacity-30" />

      {/* Main Navigation Menu */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto relative z-10">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 tracking-wider uppercase">
          Danh mục quản trị
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}`}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all duration-150 group ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`p-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-slate-950/15 text-slate-950'
                      : 'bg-slate-800 text-slate-300 group-hover:text-amber-300 border border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-slate-950 text-amber-300'
                      : 'bg-slate-800 text-amber-300 border border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <DongSonBorder color="#F59E0B" className="h-1.5 opacity-30" />

      {/* Footer / App Info */}
      <div className="p-4 bg-slate-950/50 border-t border-slate-800 relative z-10 text-xs">
        <div className="flex items-center space-x-2 text-amber-300 mb-1">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-bold text-[11px]">GIÁO DỤC CHÍNH TRỊ HQV4</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Đồng bộ trực tuyến sẵn sàng kết nối ứng dụng học tập chiến sĩ.
        </p>
      </div>
    </aside>
  );
};
