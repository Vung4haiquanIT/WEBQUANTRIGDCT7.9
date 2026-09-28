import React from 'react';

/**
 * Helper utilities for formatting and displaying administrator creator information.
 * Displays "tạo bởi: (họ tên người tạo)" in a subtle, muted style.
 */

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
      if (sUsername === target || sEmail === target || sEmail.startsWith(target + '@')) {
        const candidate = session.fullName || session.name;
        if (candidate && candidate.trim()) return candidate.trim();
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
          if (candidate && candidate.trim()) return candidate.trim();
        }
      }
    }
  } catch {}

  return null;
}

export function getCreatorDisplayName(item: any): string {
  if (!item) return 'Ban Quản Trị';

  // 1. Priority 1: Explicit createdByName (Họ tên người tạo)
  if (item.createdByName && typeof item.createdByName === 'string' && item.createdByName.trim()) {
    return item.createdByName.trim();
  }

  // 2. Priority 2: createdBy field (if it is a full name or agency title)
  if (item.createdBy && typeof item.createdBy === 'string' && item.createdBy.trim()) {
    const raw = item.createdBy.trim();
    // If it's an email or username like "admin@v4.hq" or "admin", look up full name
    if (raw.includes('@')) {
      const lookedUp = lookupAdminFullName(raw);
      if (lookedUp) return lookedUp;
      return raw.split('@')[0];
    }
    // If it's a short handle like "admin", lookup full name
    if (!raw.includes(' ') && raw.length <= 25) {
      const lookedUp = lookupAdminFullName(raw);
      if (lookedUp) return lookedUp;
    }
    return raw;
  }

  // 3. Priority 3: Lookup full name from createdByUsername
  if (item.createdByUsername && typeof item.createdByUsername === 'string' && item.createdByUsername.trim()) {
    const lookedUp = lookupAdminFullName(item.createdByUsername);
    if (lookedUp) return lookedUp;
    return item.createdByUsername.replace(/^@/, '').trim();
  }

  // 4. Priority 4: sentBy or broadcaster
  if (item.sentBy && typeof item.sentBy === 'string' && item.sentBy.trim()) {
    return item.sentBy.trim();
  }
  if (item.broadcaster && typeof item.broadcaster === 'string' && item.broadcaster.trim()) {
    return item.broadcaster.trim();
  }

  // 5. Fallback fields
  if (item.fullName && typeof item.fullName === 'string' && item.fullName.trim()) {
    return item.fullName.trim();
  }
  if (item.name && typeof item.name === 'string' && item.name.trim()) {
    return item.name.trim();
  }

  return 'Ban Quản Trị';
}

export function getCreatorFullName(item: any): string {
  return getCreatorDisplayName(item);
}

export function getCreatorUsername(item: any): string {
  return getCreatorDisplayName(item);
}

export function formatCreatorHandle(item: any): string {
  return getCreatorDisplayName(item);
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
  if (!adminUser) {
    try {
      const sessionStr = localStorage.getItem('hq_admin_session') || sessionStorage.getItem('hq_admin_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        return session.fullName || session.name || session.username || 'Ban Quản Trị';
      }
    } catch {}
    return 'Ban Quản Trị';
  }
  return adminUser.fullName || adminUser.name || adminUser.username || 'Ban Quản Trị';
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

