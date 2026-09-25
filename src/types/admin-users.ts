/**
 * Admin User Management - Shared Types
 * Phase 1: Read Only + Notification Settings
 */

// ─── API Request Types ────────────────────────────────────────────────────────

export interface UpdateUserRequest {
  enableDailySummary?: boolean;
  sendTime?: string; // HH:MM format
}

// ─── API Response Types ───────────────────────────────────────────────────────

export type UserLineStatus = 'no_line' | 'notify_off' | 'active';

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'viewer';
  createdAt: string; // ISO string for JSON
  lineStatus: UserLineStatus;
  lineDisplayName: string | null;
  notifyEnabled: boolean;
  sendTime: string | null; // HH:MM
  lastSentAt: string | null; // ISO string
}

export interface UpdateUserResponse {
  user: UserListItem;
}

export interface ApiError {
  error: string;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

export function parseSettingsJson(settingsJson: unknown): {
  sendTime: string | null;
} {
  // Handle null/undefined
  if (settingsJson == null) return { sendTime: null };
  
  // If already an object, extract sendTime directly
  if (typeof settingsJson === 'object') {
    const obj = settingsJson as Record<string, unknown>;
    return {
      sendTime: typeof obj.sendTime === 'string' ? obj.sendTime : null,
    };
  }
  
  // If string, parse JSON
  if (typeof settingsJson === 'string') {
    if (!settingsJson.trim()) return { sendTime: null };
    try {
      const parsed = JSON.parse(settingsJson);
      return {
        sendTime: typeof parsed.sendTime === 'string' ? parsed.sendTime : null,
      };
    } catch {
      return { sendTime: null };
    }
  }
  
  return { sendTime: null };
}

export function getLineStatus(
  hasLine: boolean,
  notifyEnabled: boolean | null
): UserLineStatus {
  if (!hasLine) return 'no_line';
  if (notifyEnabled === false) return 'notify_off';
  return 'active';
}
