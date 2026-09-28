import React from 'react';
import { ShieldCheck, UserCheck, Shield } from 'lucide-react';

interface CreatorBadgeProps {
  creatorUsername?: string;
  createdBy?: string;
  createdByName?: string;
  label?: string;
  size?: 'xs' | 'sm' | 'md';
  variant?: 'amber' | 'blue' | 'slate' | 'emerald';
  className?: string;
  showIcon?: boolean;
}

/**
 * Chuẩn hóa tên tài khoản quản trị viên tạo nội dung
 */
export function formatCreatorUsername(
  creatorUsername?: string,
  createdBy?: string,
  createdByName?: string
): string {
  if (creatorUsername && creatorUsername.trim()) {
    return creatorUsername.trim().replace(/^@/, '');
  }

  const raw = (createdBy || createdByName || '').trim();
  if (!raw) return 'admin';

  // Email format -> lấy phần trước @ hoặc giữ nguyên nếu là email nội bộ
  if (raw.includes('@')) {
    return raw;
  }

  // Tên tài khoản hệ thống quen thuộc
  const lower = raw.toLowerCase();
  if (
    lower.includes('phạm khắc thành') ||
    lower.includes('ban tuyên huấn') ||
    lower.includes('phòng chính trị') ||
    lower === 'admin' ||
    lower === 'admin-root' ||
    lower === 'user-admin'
  ) {
    return 'admin';
  }

  if (lower.includes('lê xuân tiến') || lower.includes('tiến')) {
    return 'xuantien@v4.hq';
  }

  // Xóa tiền tố admin- hoặc user-
  if (raw.startsWith('admin-') || raw.startsWith('user-')) {
    return raw.replace(/^(admin-|user-)/, '');
  }

  return raw;
}

/**
 * Huy hiệu hiển thị rõ Tên tài khoản của Quản trị viên đã tạo ra chuyên đề, bài học, đề thi, truyền thanh...
 */
export const CreatorBadge: React.FC<CreatorBadgeProps> = ({
  creatorUsername,
  createdBy,
  createdByName,
  label = 'Tài khoản:',
  size = 'sm',
  variant = 'amber',
  className = '',
  showIcon = true,
}) => {
  const cleanUsername = formatCreatorUsername(creatorUsername, createdBy, createdByName);
  const fullName = createdByName || (cleanUsername === 'admin' ? 'Ban Tuyên Huấn (Phạm Khắc Thành)' : undefined);

  // Variant styling
  const variantStyles = {
    amber: 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs hover:bg-amber-100/80',
    blue: 'bg-blue-50 text-blue-900 border-blue-300 shadow-2xs hover:bg-blue-100/80',
    slate: 'bg-slate-100 text-slate-800 border-slate-300 shadow-2xs hover:bg-slate-200/80',
    emerald: 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-2xs hover:bg-emerald-100/80',
  }[variant];

  const sizeStyles = {
    xs: 'text-[9px] px-1.5 py-0.5 rounded',
    sm: 'text-[10px] px-2 py-0.5 rounded-md',
    md: 'text-xs px-2.5 py-1 rounded-lg',
  }[size];

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1 border font-bold transition-colors select-none ${variantStyles} ${sizeStyles} ${className}`}
      title={fullName ? `Quản trị viên khởi tạo: ${fullName} (Tài khoản: @${cleanUsername})` : `Quản trị viên khởi tạo: @${cleanUsername}`}
    >
      {showIcon && <ShieldCheck className={`${iconSizes} text-amber-600 shrink-0`} />}
      {label && <span className="text-slate-500 font-medium">{label}</span>}
      <span className="font-extrabold text-blue-800 font-mono tracking-tight">@{cleanUsername}</span>
    </span>
  );
};
