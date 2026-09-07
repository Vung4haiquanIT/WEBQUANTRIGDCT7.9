import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Bell, 
  Search, 
  CheckCircle2, 
  RefreshCw,
  User as UserIcon,
  Award
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
}) => {
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const isLive = isRealtimeConnected ?? realtimeConnected ?? true;
  const safeNotifs = notifications || [];

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
    <header className="h-18 bg-[#0F223D] text-white border-b border-slate-700/60 px-6 flex items-center justify-between shadow-sm relative z-20 overflow-hidden">
      {/* Background Subtle Drum */}
      <div className="absolute right-1/4 -top-12 pointer-events-none opacity-5">
        <DongSonDrum className="w-48 h-48" color="#F59E0B" opacity={1} />
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

        {/* Notifications Popover */}
        <div className="relative">
          <button
            id="header-notifications-btn"
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-600/60 transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            {safeNotifs.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-slate-950 text-[10px] font-extrabold rounded-full flex items-center justify-center">
                {safeNotifs.length}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in">
              <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Chỉ thị & Thông báo mới
                </span>
                <span className="text-[10px] text-slate-400">{safeNotifs.length} thông báo</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800">
                {safeNotifs.map((n) => (
                  <div key={n.id} className="p-3 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold text-slate-200 truncate">{n.title}</span>
                      <span className="text-[9px] bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded font-medium border border-slate-700">
                        {n.type === 'EMERGENCY' ? 'Khẩn cấp' : n.type === 'COURSE_UPDATE' ? 'Cập nhật' : 'Chỉ đạo'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 line-clamp-2">{n.content}</p>
                    <div className="mt-1 text-[9px] text-slate-400 flex items-center justify-between">
                      <span>{n.sentBy}</span>
                      <span>{new Date(n.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Current Officer Profile */}
        <div className="flex items-center space-x-3 pl-3 border-l border-slate-700">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 flex-shrink-0 shadow-sm">
            <div className="w-full h-full bg-slate-900 rounded-[9px] flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-amber-300" />
            </div>
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-bold text-white flex items-center space-x-1">
              <span>Đại tá Nguyễn Văn Hùng</span>
              <Award className="w-3 h-3 text-amber-400 inline" />
            </div>
            <div className="text-[10px] text-slate-300 font-medium truncate max-w-[180px]">
              Chủ nhiệm Chính trị Vùng 4 (Quản trị cấp cao)
            </div>
            <div className="text-[9px] text-amber-300 font-mono">{currentTime}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
