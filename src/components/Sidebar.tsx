import React from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  FileSpreadsheet,
  Users, 
  Building2, 
  TrendingUp, 
  Bell, 
  Settings,
  ShieldCheck,
  Layers,
  Image as ImageIcon,
  MessageSquareText
} from 'lucide-react';
import { DongSonDrum, DongSonBorder } from './DongSonMotif';

export type NavTab = 'dashboard' | 'courses' | 'exams' | 'feedbacks' | 'users' | 'units' | 'banners' | 'progress' | 'notifications' | 'settings' | 'firebase-diagnostics';

export interface SidebarProps {
  activeTab: NavTab | string;
  setActiveTab?: (tab: NavTab) => void;
  onSelectTab?: (tab: string) => void;
  trashCount?: number;
  unresolvedFeedbacksCount?: number;
  stats?: {
    totalCourses: number;
    totalLessons: number;
    unreadNotifs?: number;
    pendingFeedbacks?: number;
  };
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  onSelectTab,
  trashCount = 0,
  unresolvedFeedbacksCount,
  stats,
  onLogout
}) => {
  const handleTabClick = (tabId: NavTab) => {
    if (onSelectTab) {
      onSelectTab(tabId);
    } else if (setActiveTab) {
      setActiveTab(tabId);
    }
  };

  const pendingFeedbacks = unresolvedFeedbacksCount ?? stats?.pendingFeedbacks ?? 0;

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
      id: 'exams' as NavTab,
      label: 'ĐỀ KIỂM TRA EXCEL',
      icon: FileSpreadsheet,
      badge: 'MỚI',
    },
    {
      id: 'feedbacks' as NavTab,
      label: 'PHẢN ÁNH & GÓP Ý',
      icon: MessageSquareText,
      badge: pendingFeedbacks > 0 ? `${pendingFeedbacks}` : null,
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
      id: 'banners' as NavTab,
      label: 'POSTER / BANNER',
      icon: ImageIcon,
      badge: 'APP',
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
      badge: null,
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
    <aside className="w-72 h-full bg-[#0B1E3B] text-white flex flex-col shrink-0 border-r border-slate-700/80 relative select-none shadow-lg z-30 overflow-hidden min-h-0">
      {/* Background Dong Son Watermark */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 pointer-events-none opacity-5">
        <DongSonDrum className="w-80 h-80" color="#F59E0B" opacity={1} />
      </div>
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 pointer-events-none opacity-5">
        <DongSonDrum className="w-72 h-72" color="#F59E0B" opacity={1} />
      </div>

      {/* Main Navigation Menu */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto relative z-10 min-h-0">
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
                      ? item.id === 'feedbacks'
                        ? 'bg-rose-600 text-white font-extrabold shadow'
                        : 'bg-slate-950 text-amber-300'
                      : item.id === 'feedbacks'
                      ? 'bg-rose-500 text-white font-extrabold shadow-sm ring-1 ring-rose-400/50'
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

      <DongSonBorder color="#F59E0B" className="h-1.5 opacity-30 shrink-0" />
    </aside>
  );
};
