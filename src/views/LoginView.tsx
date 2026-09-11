import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  Anchor,
  Compass,
  ArrowRight
} from 'lucide-react';
import { DongSonDrum, DongSonBorder } from '../components/DongSonMotif';
import { Vung4Logo } from '../components/Vung4Logo';

interface LoginViewProps {
  onLoginSuccess: (adminUser: { email: string; name: string; role: string }) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPass = password.trim();

    if (!trimmedEmail || !trimmedPass) {
      setErrorMsg('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu.');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      // Validate credentials: admin@v4.hq / 123@abc
      if (
        (trimmedEmail === 'admin@v4.hq' || trimmedEmail === 'admin') &&
        trimmedPass === '123@abc'
      ) {
        const adminData = {
          email: 'admin@v4.hq',
          name: 'Ban Tuyên Huấn - Vùng 4 Hải Quân',
          role: 'ADMINISTRATOR'
        };

        if (rememberMe) {
          localStorage.setItem('hq_admin_session', JSON.stringify({
            ...adminData,
            loginTime: new Date().toISOString()
          }));
        } else {
          sessionStorage.setItem('hq_admin_session', JSON.stringify({
            ...adminData,
            loginTime: new Date().toISOString()
          }));
        }

        onLoginSuccess(adminData);
      } else {
        setErrorMsg('Tài khoản hoặc mật khẩu không chính xác! Vui lòng kiểm tra lại.');
        setIsSubmitting(false);
      }
    }, 450);
  };

  return (
    <div className="min-h-screen bg-[#07152B] text-slate-100 flex flex-col justify-between relative overflow-hidden select-none font-sans">
      {/* Background Decorative Dong Son Motifs & Radial Glows */}
      <div className="absolute -top-32 -right-32 pointer-events-none opacity-10">
        <DongSonDrum className="w-[500px] h-[500px]" color="#F59E0B" opacity={1} />
      </div>
      <div className="absolute -bottom-40 -left-40 pointer-events-none opacity-10">
        <DongSonDrum className="w-[560px] h-[560px]" color="#F59E0B" opacity={1} />
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-blue-900/20 via-transparent to-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner Header */}
      <header className="relative z-10 pt-6 px-6 sm:px-12 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <Vung4Logo className="h-12 w-auto shrink-0" />
          <div>
            <div className="text-[11px] font-extrabold tracking-widest text-amber-400 uppercase">
              QUÂN CHỦNG HẢI QUÂN • VÙNG 4 HẢI QUÂN
            </div>
            <div className="text-sm sm:text-base font-black text-white tracking-tight uppercase">
              HỆ THỐNG QUẢN TRỊ GIÁO DỤC CHÍNH TRỊ
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 bg-slate-900/80 border border-slate-700/80 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Hệ thống mạng nội bộ an toàn</span>
        </div>
      </header>

      {/* Main Login Form Container */}
      <main className="relative z-10 max-w-md w-full mx-auto px-4 py-8 my-auto">
        <div className="bg-[#0D2140]/90 backdrop-blur-md border border-amber-500/30 rounded-3xl p-7 sm:p-9 shadow-2xl shadow-black/60 relative overflow-hidden">
          {/* Top Decorative Border */}
          <div className="absolute top-0 left-0 right-0">
            <DongSonBorder color="#F59E0B" className="h-1.5 opacity-60" />
          </div>

          {/* Form Header */}
          <div className="text-center mb-7 pt-2">
            <div className="inline-flex items-center justify-center mb-3">
              <Vung4Logo className="h-20 w-auto drop-shadow-xl" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              ĐĂNG NHẬP QUẢN TRỊ
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Xác thực quyền quản lý cán bộ tuyên huấn & chính trị
            </p>
          </div>

          {/* Error Message Box */}
          {errorMsg && (
            <div 
              id="login-error-alert"
              className="mb-5 p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/60 text-rose-200 text-xs flex items-start space-x-2.5 animate-in fade-in slide-in-from-top-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account / Email Input */}
            <div>
              <label 
                htmlFor="admin-account-input" 
                className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-1.5"
              >
                Tài khoản / Email quản trị
              </label>
              <div className="relative">
                <input
                  id="admin-account-input"
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Nhập tên tài khoản hoặc email..."
                  className="w-full bg-slate-900/90 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white placeholder-slate-500 text-sm rounded-xl pl-10 pr-4 py-3 outline-none transition-all"
                  required
                />
                <User className="w-4 h-4 text-amber-400/80 absolute left-3.5 top-3.5" />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label 
                  htmlFor="admin-password-input" 
                  className="block text-xs font-bold text-slate-200 uppercase tracking-wider"
                >
                  Mật khẩu bảo mật
                </label>
              </div>
              <div className="relative">
                <input
                  id="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu quản trị..."
                  className="w-full bg-slate-900/90 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white placeholder-slate-500 text-sm rounded-xl pl-10 pr-11 py-3 outline-none transition-all"
                  required
                />
                <Lock className="w-4 h-4 text-amber-400/80 absolute left-3.5 top-3.5" />
                <button
                  type="button"
                  id="toggle-password-visibility-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-200 transition-colors"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                <input
                  id="remember-me-checkbox"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-amber-500"
                />
                <span className="font-medium">Ghi nhớ đăng nhập</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              id="admin-login-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 active:scale-[0.99] text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Đang xác thực bảo mật...</span>
                </>
              ) : (
                <>
                  <span>ĐĂNG NHẬP HỆ THỐNG</span>
                  <ArrowRight className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer / Confidentiality Warning */}
      <footer className="relative z-10 py-4 px-6 text-center text-[11px] text-slate-400 border-t border-slate-800 bg-[#061224]/80">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-slate-300 font-medium">
            <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Cổng thông tin quản trị giáo dục chính trị nội bộ • Bộ Tư lệnh Vùng 4 Hải Quân</span>
          </div>
          <div className="text-slate-400 font-mono text-[10px]">
            Bản quyền © 2026 Quân chủng Hải quân Nhân dân Việt Nam
          </div>
        </div>
      </footer>
    </div>
  );
};
