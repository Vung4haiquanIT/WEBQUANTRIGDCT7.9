import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Search, 
  CheckCircle2, 
  RefreshCw,
  User as UserIcon,
  Award,
  LogOut,
  Shield
} from 'lucide-react';
import { DongSonDrum } from './DongSonMotif';
import { SystemNotification } from '../types';

interface HeaderProps {
  realtimeConnected?: boolean;
  isRealtimeConnected?: boolean;
  onRefresh?: () => void;
  notifications?: SystemNotification[];
  searchTerm?: string;
  setSearchTerm?: (term: string) => void;
  activeTab?: string;
  onOpenTrash?: () => void;
  adminUser?: { email: string; name: string; role: string } | null;
  onLogout?: () => void;
  onSelectTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  realtimeConnected,
  isRealtimeConnected,
  onRefresh = () => {},
  notifications = [],
  searchTerm = '',
  setSearchTerm = (_term: string) => {},
  activeTab,
  onOpenTrash,
  adminUser,
  onLogout,
  onSelectTab,
}) => {
  const [currentTime, setCurrentTime] = useState('');
  const isLive = isRealtimeConnected ?? realtimeConnected ?? true;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString('vi-VN', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-18 shrink-0 bg-[#0F223D] text-white border-b border-slate-700/60 px-6 flex items-center justify-between shadow-sm relative z-30">
      {/* Background Subtle Drum (contained within overlay to not clip dropdowns) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute right-1/4 -top-12 opacity-5">
          <DongSonDrum className="w-48 h-48" color="#F59E0B" opacity={1} />
        </div>
      </div>

      {/* Left: Title & Live indicator */}
      <div className="flex items-center space-x-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold tracking-widest text-amber-300 uppercase bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 rounded">
              QUÂN CHỦNG HẢI QUÂN
            </span>
            <span className="text-[10px] text-slate-300 font-medium">| VÙNG 4 HẢI QUÂN</span>
          </div>
          <h1 className="text-base font-bold tracking-tight text-white uppercase mt-0.5">
            HỆ THỐNG QUẢN TRỊ GIÁO DỤC CHÍNH TRỊ
          </h1>
        </div>

        {/* Realtime Live Status Badge */}
        <div className="hidden lg:flex items-center ml-4 pl-4 border-l border-slate-700">
          <div
            className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold border ${
              isLive
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isLive ? 'animate-pulse text-emerald-400' : 'text-rose-400'}`} />
            <span>{isLive ? 'Đồng bộ trực tuyến' : 'Mất kết nối'}</span>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Search Bar */}
        <div className="relative hidden md:block w-60">
          <input
            id="global-search-input"
            type="text"
            placeholder="Tìm bài học, chuyên đề..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-600/70 text-white placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        {/* Refresh Button */}
        <button
          id="header-refresh-btn"
          onClick={onRefresh}
          title="Làm mới dữ liệu"
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600/60 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Current Officer Profile & Logout */}
        <div className="flex items-center space-x-3 pl-3 border-l border-slate-700">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 flex-shrink-0 shadow-sm">
            <div className="w-full h-full bg-slate-900 rounded-[9px] flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-amber-300" />
            </div>
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-bold text-white flex items-center space-x-1">
              <span>{adminUser?.email || 'admin@v4.hq'}</span>
              <Award className="w-3 h-3 text-amber-400 inline" />
            </div>
            <div className="text-[10px] text-slate-300 font-medium truncate max-w-[180px]">
              {adminUser?.name || 'Ban Tuyên Huấn Vùng 4'} (Quản trị viên)
            </div>
            <div className="text-[9px] text-amber-300 font-mono">{currentTime}</div>
          </div>

          {onLogout && (
            <button
              id="header-logout-btn"
              onClick={onLogout}
              title="Đăng xuất khỏi hệ thống quản trị"
              className="p-2 ml-1 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-700/50 hover:border-rose-500 transition-colors flex items-center space-x-1.5 text-xs font-semibold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
