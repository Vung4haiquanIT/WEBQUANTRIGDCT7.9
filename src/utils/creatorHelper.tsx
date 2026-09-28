import React from 'react';

/**
 * Helper utilities for formatting and displaying administrator creator information.
 * Displays "tạo bởi: (họ tên người tạo)" in a subtle, muted style.
 * Filters out generic organizational names (e.g. 'Ban Tuyên huấn Vùng 4', 'Phòng Chính trị Vùng 4')
 * and resolves the exact administrator personal name who created the content.
 */

export function isGenericAgencyName(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return true;
  const lower = name.toLowerCase().trim();
  if (!lower) return true;
  return (
    lower === 'ban tuyên huấn vùng 4' ||
    lower === 'phòng chính trị vùng 4' ||
    lower === 'bộ tư lệnh vùng 4 hải quân' ||
    lower === 'bộ tư lệnh vùng 4' ||
    lower === 'ban tuyên huấn' ||
    lower === 'phòng chính trị' ||
    lower === 'ban quản trị' ||
    lower === 'ban biên tập' ||
    lower === 'admin' ||
    lower === 'admin-root' ||
    lower === 'user-admin' ||
    lower === 'admin@v4.hq' ||
    lower.startsWith('ban tuyên huấn') ||
    lower.startsWith('phòng chính trị') ||
    lower.startsWith('bộ tư lệnh')
  );
}

function lookupAdminFullName(usernameOrEmail?: string): string | null {
  if (!usernameOrEmail) return null;
  const target = String(usernameOrEmail).toLowerCase().replace(/^@/, '').trim();
  if (!target) return null;

  // 1. Check current logged-in session
  try {
    const sessionStr = localStorage.getItem('hq_admin_session') || sessionStorage.getItem('hq_admin_session');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      const sUsername = (session.username || '').toLowerCase().replace(/^@/, '');
      const sEmail = (session.email || '').toLowerCase();
      if (sUsername === target || sEmail === target || sEmail.startsWith(target + '@') || target === 'admin') {
        const candidate = session.fullName || session.name;
        if (candidate && candidate.trim() && !isGenericAgencyName(candidate)) {
          return candidate.trim();
        }
      }
    }
  } catch {}

  // 2. Check cached system admins list
  try {
    const adminsStr = localStorage.getItem('hq_local_system_admins');
    if (adminsStr) {
      const admins = JSON.parse(adminsStr);
      if (Array.isArray(admins)) {
        const found = admins.find((a: any) => {
          const u = (a.username || '').toLowerCase().replace(/^@/, '');
          const e = (a.email || '').toLowerCase();
          return u === target || e === target || e.startsWith(target + '@');
        });
        if (found) {
          const candidate = found.fullName || found.name;
          if (candidate && candidate.trim() && !isGenericAgencyName(candidate)) {
            return candidate.trim();
          }
        }
      }
    }
  } catch {}

  // 3. Known system admin mappings
  if (target === 'admin' || target === 'admin-root' || target === 'khacthanh@v4.hq') {
    return 'Phạm Khắc Thành';
  }
  if (target === 'xuantien@v4.hq' || target.includes('xuantien') || target.includes('tiến')) {
    return 'Lê Xuân Tiến';
  }

  return null;
}

export function getCreatorDisplayName(item: any, parentItem?: any): string {
  if (!item && !parentItem) return 'Phạm Khắc Thành';

  // 1. Priority 1: Explicit createdByName (Họ tên người tạo cá nhân)
  if (item?.createdByName && typeof item.createdByName === 'string' && item.createdByName.trim()) {
    const val = item.createdByName.trim();
    if (!isGenericAgencyName(val)) {
      return val;
    }
  }

  // 2. Priority 2: createdBy field (if it is a REAL personal full name)
  if (item?.createdBy && typeof item.createdBy === 'string' && item.createdBy.trim()) {
    const raw = item.createdBy.trim();
    if (!isGenericAgencyName(raw)) {
      if (raw.includes('@')) {
        const lookedUp = lookupAdminFullName(raw);
        if (lookedUp && !isGenericAgencyName(lookedUp)) return lookedUp;
      } else {
        return raw;
      }
    }
  }

  // 3. Priority 3: Lookup admin full name from createdByUsername
  if (item?.createdByUsername && typeof item.createdByUsername === 'string' && item.createdByUsername.trim()) {
    const lookedUp = lookupAdminFullName(item.createdByUsername);
    if (lookedUp && !isGenericAgencyName(lookedUp)) {
      return lookedUp;
    }
  }

  // 4. Priority 4: Inherit from parentItem (e.g. parent Course of a Lesson)
  if (parentItem) {
    if (parentItem.createdByName && !isGenericAgencyName(parentItem.createdByName)) {
      return parentItem.createdByName.trim();
    }
    if (parentItem.createdBy && !isGenericAgencyName(parentItem.createdBy)) {
      return parentItem.createdBy.trim();
    }
    if (parentItem.createdByUsername) {
      const lookedUp = lookupAdminFullName(parentItem.createdByUsername);
      if (lookedUp && !isGenericAgencyName(lookedUp)) {
        return lookedUp;
      }
    }
  }

  // 5. Priority 5: Active logged in admin session
  try {
    const sessionStr = localStorage.getItem('hq_admin_session') || sessionStorage.getItem('hq_admin_session');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      const sName = session.fullName || session.name;
      if (sName && !isGenericAgencyName(sName)) {
        return sName.trim();
      }
    }
  } catch {}

  // 6. Priority 6: Voice reader or author
  if (item?.voiceReader && typeof item.voiceReader === 'string' && item.voiceReader.trim()) {
    return item.voiceReader.trim();
  }

  return 'Phạm Khắc Thành';
}

export function getCreatorFullName(item: any, parentItem?: any): string {
  return getCreatorDisplayName(item, parentItem);
}

export function getCreatorUsername(item: any, parentItem?: any): string {
  return getCreatorDisplayName(item, parentItem);
}

export function formatCreatorHandle(item: any, parentItem?: any): string {
  return getCreatorDisplayName(item, parentItem);
}

export function getActiveAdminUsername(adminUser?: any): string {
  if (!adminUser) return 'admin';
  if (adminUser.username && typeof adminUser.username === 'string' && adminUser.username.trim()) {
    return adminUser.username.replace(/^@/, '').trim();
  }
  if (adminUser.email && typeof adminUser.email === 'string' && adminUser.email.trim()) {
    return adminUser.email.split('@')[0].trim();
  }
  return 'admin';
}

export function getActiveAdminFullName(adminUser?: any): string {
  if (adminUser) {
    const candidate = adminUser.fullName || adminUser.name;
    if (candidate && !isGenericAgencyName(candidate)) {
      return candidate.trim();
    }
  }
  try {
    const sessionStr = localStorage.getItem('hq_admin_session') || sessionStorage.getItem('hq_admin_session');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      const sName = session.fullName || session.name;
      if (sName && !isGenericAgencyName(sName)) {
        return sName.trim();
      }
    }
  } catch {}
  return 'Phạm Khắc Thành';
}

interface CreatorBadgeProps {
  item: any;
  label?: string;
  className?: string;
}

export const CreatorBadge: React.FC<CreatorBadgeProps> = ({
  item,
  label = 'tạo bởi:',
  className = ''
}) => {
  const name = getCreatorDisplayName(item);

  return (
    <span
      className={`text-[11px] text-slate-400 font-normal inline-flex items-center gap-1 ${className}`}
      title={`Người thực hiện: ${name}`}
    >
      <span>{label}</span>
      <span className="text-slate-500 font-medium">{name}</span>
    </span>
  );
};

