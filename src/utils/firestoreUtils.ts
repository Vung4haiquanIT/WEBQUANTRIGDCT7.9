/**
 * Utility functions for Firestore sanitization, validation, and error handling.
 * Enforces strict Zero-Undefined payloads across all Firestore operations.
 */

/**
 * Recursively removes undefined, NaN, and Infinity values from an object or array.
 * Ensures no undefined properties are ever sent to Firestore setDoc/updateDoc/addDoc.
 */
export function sanitizeFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    if (typeof obj === 'number' && (isNaN(obj) || !isFinite(obj))) {
      return undefined as any;
    }
    return obj;
  }

  if (obj instanceof Date || obj instanceof RegExp) {
    return obj as any;
  }

  if (Array.isArray(obj)) {
    return obj
      .map(item => sanitizeFirestoreData(item))
      .filter(item => item !== undefined) as any;
  }

  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
      continue;
    }

    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      const sanitizedChild = sanitizeFirestoreData(value);
      if (sanitizedChild !== undefined) {
        cleaned[key] = sanitizedChild;
      }
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned as T;
}

export interface FriendlyErrorResult {
  userMessage: string;
  technicalDetails?: string;
}

/**
 * Format system errors into user-friendly Vietnamese text for standard UI,
 * while retaining technical log details for Admin diagnosis.
 */
export function formatFirestoreError(error: unknown, customUserMsg?: string): FriendlyErrorResult {
  const errStr = error instanceof Error ? error.message : String(error);
  console.error('[GDCT Firestore System Error]:', error);

  let defaultMsg = customUserMsg || 'Không thể lưu tài liệu. Hệ thống đang kiểm tra dữ liệu tài liệu.';

  if (errStr.includes('permission-denied') || errStr.includes('PERMISSION_DENIED')) {
    defaultMsg = 'Bạn không có quyền thực hiện thao tác này trên hệ thống GDCT.';
  } else if (errStr.includes('unsupported field value') || errStr.includes('undefined')) {
    defaultMsg = 'Dữ liệu tài liệu chứa thông tin không hợp lệ. Hệ thống đã tự động làm sạch dữ liệu.';
  } else if (errStr.includes('offline') || errStr.includes('unavailable')) {
    defaultMsg = 'Kết nối mạng gián đoạn. Dữ liệu đã được lưu tạm offline.';
  }

  return {
    userMessage: defaultMsg,
    technicalDetails: errStr
  };
}
