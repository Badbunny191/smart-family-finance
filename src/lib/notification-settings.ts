/**
 * Notification Settings Service
 * 
 * Manages LINE notification settings stored in database.
 * Used by:
 * - LINE Daily Summary cron (src/app/api/line-notify/cron/route.ts)
 * - Future: Settings API endpoints
 */

import { eq, and, isNull, sql } from 'drizzle-orm';
import { lineAccounts } from '@/db/schema';

// ============================================================
// TYPES
// ============================================================

export type NotificationType = 'daily_summary' | 'pending_reminder' | 'overdue_alert';

export interface DailySummarySettings {
  sendTime: string;      // "08:00" (HH:mm format, 24-hour, ICT)
  additionalTimes?: string[];  // "08:00" array (HH:mm format, optional, Multi-SendTime)
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showNet: boolean;       // show monthly net (income - expense)
  showPending: boolean;
  showOverdue: boolean;
  showPendingDetails: boolean;  // show top-3 pending items (bullet list)
  showOverdueDetails: boolean;  // show top-3 overdue items (bullet list)
}

export interface PendingReminderSettings {
  daysBefore: number[];  // e.g., [1, 3, 7]
}

export interface OverdueAlertSettings {
  alertMode: 'daily' | 'once';
}

export interface NotificationSetting {
  id: string;
  userId: string;
  notificationType: NotificationType;
  settings: DailySummarySettings | PendingReminderSettings | OverdueAlertSettings;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// Default settings for daily summary
export const DEFAULT_DAILY_SUMMARY_SETTINGS: DailySummarySettings = {
  sendTime: '08:00',
  showBalance: true,
  showIncome: true,
  showExpense: true,
  showNet: true,
  showPending: true,
  showOverdue: true,
  showPendingDetails: true,
  showOverdueDetails: true,
};

// ============================================================
// GET LINE USER IDs
// ============================================================

/**
 * Get all LINE user IDs from lineAccounts table
 * These are the recipients for LINE push messages
 * Only returns users with notifyEnabled = true
 */
export async function getAllLineUserIds(
  db: ReturnType<typeof import('@/db/client').getDb>
): Promise<string[]> {
  const result = await db
    .select({ lineUserId: lineAccounts.lineUserId })
    .from(lineAccounts)
    .where(
      and(
        isNull(lineAccounts.deletedAt),
        eq(lineAccounts.notifyEnabled, true)
      )
    );

  // Filter out null/empty values
  return result
    .map(row => row.lineUserId)
    .filter((id): id is string => id !== null && id !== '');
}

/**
 * Get LINE user ID for a specific user
 */
export async function getLineUserId(
  db: ReturnType<typeof import('@/db/client').getDb>,
  userId: string
): Promise<string | null> {
  const result = await db
    .select({ lineUserId: lineAccounts.lineUserId })
    .from(lineAccounts)
    .where(
      and(
        eq(lineAccounts.userId, userId),
        isNull(lineAccounts.deletedAt)
      )
    );

  return result[0]?.lineUserId ?? null;
}

// ============================================================
// SET LINE USER ID
// ============================================================

/**
 * Update or insert LINE user ID for a user
 */
export async function setLineUserId(
  db: ReturnType<typeof import('@/db/client').getDb>,
  userId: string,
  lineUserId: string
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  // Try to update first
  const updated = await db
    .update(lineAccounts)
    .set({
      lineUserId,
      notifyEnabled: true,
      updatedAt: new Date(now * 1000),
    })
    .where(
      and(
        eq(lineAccounts.userId, userId),
        isNull(lineAccounts.deletedAt)
      )
    )
    .run();

  // If no rows updated, insert new record
  if (updated.meta.changes === 0) {
    await db.insert(lineAccounts).values({
      id: `la_${userId}_${now}`,
      userId,
      lineUserId,
      notifyEnabled: true,
      createdAt: new Date(now * 1000),
      updatedAt: new Date(now * 1000),
    });
  }
}

// ============================================================
// NOTIFICATION SETTINGS (Database)
// ============================================================

/**
 * Get notification settings from database
 * Requires notification_settings table
 */
export async function getNotificationSettingFromDb(
  db: ReturnType<typeof import('@/db/client').getDb>,
  notificationType: NotificationType
): Promise<NotificationSetting | null> {
  // For MVP, just get the first enabled setting
  // In future, this should be per-user
  try {
    const result = await db
      .select()
      .from(sql`notification_settings`)
      .where(
        and(
          sql`notification_type = ${notificationType}`,
          sql`enabled = 1`
        )
      )
      .limit(1);

    if (result.length > 0) {
      const row = result[0] as Record<string, unknown>;
      return {
        id: row.id as string,
        userId: row.user_id as string,
        notificationType: row.notification_type as NotificationType,
        settings: JSON.parse(row.settings as string),
        enabled: Boolean(row.enabled),
        createdAt: row.created_at as number,
        updatedAt: row.updated_at as number,
      };
    }
  } catch {
    // Table might not exist yet
    return null;
  }

  return null;
}

/**
 * Get all enabled LINE user IDs with their per-user settings
 * Returns list of LINE user IDs to send notification to
 *
 * BUGFIX: JOIN ตาม user_id เพื่อให้แต่ละ recipient ได้ settings ของตัวเอง
 * เดิม map settingsList[0] ใส่ทุกคน ทำให้ sendTime ของ user หนึ่งไปใช้กับอีก user
 */
export async function getEnabledRecipients(
  db: ReturnType<typeof import('@/db/client').getDb>
): Promise<{ lineUserId: string; settings: DailySummarySettings }[]> {
  // Get all enabled LINE accounts (joined with their per-user settings)
  let lineAccountsList: { lineUserId: string }[] = [];
  try {
    lineAccountsList = await db
      .select({
        lineUserId: lineAccounts.lineUserId,
      })
      .from(lineAccounts)
      .where(
        and(
          isNull(lineAccounts.deletedAt),
          eq(lineAccounts.notifyEnabled, true)
        )
      );
  } catch {
    return [];
  }

  if (lineAccountsList.length === 0) {
    return [];
  }

  // Try to get settings from notification_settings table (per-user)
  try {
    const settingsList = await db
      .select()
      .from(sql`notification_settings`)
      .where(
        and(
          sql`notification_type = 'daily_summary'`,
          sql`enabled = 1`
        )
      );

    if (settingsList.length > 0) {
      // Build a map: user_id -> settings (จาก row ของ user นั้นจริงๆ)
      const settingsByUserId = new Map<string, DailySummarySettings>();
      for (const row of settingsList) {
        const r = row as Record<string, unknown>;
        settingsByUserId.set(
          r.user_id as string,
          JSON.parse(r.settings as string) as DailySummarySettings
        );
      }

      // Map settings to LINE accounts โดย join ตาม user_id (ต้อง query user_id ของแต่ละ LINE account)
      const lineAccountUserIds = await db
        .select({ lineUserId: lineAccounts.lineUserId, userId: lineAccounts.userId })
        .from(lineAccounts)
        .where(
          and(
            isNull(lineAccounts.deletedAt),
            eq(lineAccounts.notifyEnabled, true)
          )
        );

      return lineAccountUserIds.map(account => ({
        lineUserId: account.lineUserId,
        settings: settingsByUserId.get(account.userId) ?? DEFAULT_DAILY_SUMMARY_SETTINGS,
      }));
    }
  } catch {
    // Table might not exist yet
  }

  // Return with default settings (fallback)
  return lineAccountsList.map(account => ({
    lineUserId: account.lineUserId,
    settings: DEFAULT_DAILY_SUMMARY_SETTINGS,
  }));
}

// ============================================================
// TIME CHECK FUNCTIONS
// ============================================================

/**
 * Get current time in Bangkok timezone
 * Returns hours, minutes, seconds
 */
export function getBangkokTime(): { hour: number; minute: number; second: number; timeString: string } {
  const now = new Date();
  
  // Use Intl.DateTimeFormat with timeZone option - this is the most reliable way
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);
  
  // Normalize hour (Intl can return "24" for midnight in some locales)
  const normalizedHour = hour === 24 ? 0 : hour;
  
  const timeString = `${normalizedHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  
  return { hour: normalizedHour, minute, second, timeString };
}

/**
 * Check if it's time to send the daily summary
 * Uses Asia/Bangkok timezone for all comparisons
 * 
 * @param sendTime - Time to send in "HH:mm" format (Asia/Bangkok)
 * @returns true if current Bangkok time matches send time (within 1 minute window)
 */
export function shouldSendNow(sendTime: string): boolean {
  // Get current time in Bangkok timezone (NEVER use UTC)
  const bangkok = getBangkokTime();
  
  // Parse send time (e.g., "08:00")
  const [sendHour, sendMinute] = sendTime.split(':').map(Number);
  const sendTimeString = `${sendHour.toString().padStart(2, '0')}:${sendMinute.toString().padStart(2, '0')}`;
  
  const matches = bangkok.hour === sendHour && bangkok.minute === sendMinute;
  
  console.log(`[shouldSendNow] Current Thai Time: ${bangkok.timeString}, Configured Time: ${sendTimeString}, Match: ${matches}`);
  
  return matches;
}

/**
 * Get current Bangkok time as HH:mm string for logging
 */
export function getCurrentBangkokTimeString(): string {
  return getBangkokTime().timeString;
}

/**
 * Get current Bangkok date string for display
 * Format: 22/09/2569 (Buddhist calendar year)
 * Uses Asia/Bangkok timezone (NEVER UTC)
 */
export function getBangkokDateString(): string {
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  
  const parts = formatter.formatToParts(now);
  const day = parts.find(p => p.type === 'day')?.value || '00';
  const month = parts.find(p => p.type === 'month')?.value || '00';
  const yearCE = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
  const yearBE = yearCE + 543; // Buddhist Era = CE + 543
  
  return `${day}/${month}/${yearBE}`;
}
