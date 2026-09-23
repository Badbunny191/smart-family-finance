/**
 * LINE Notification Settings - Per-Recipient Update
 *
 * PATCH /api/settings/line/recipient/:userId
 *
 * Update notification settings for a specific user (recipient).
 * This is the primary API for updating settings — does NOT affect other recipients.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getRequestContext, handleApiError, ValidationError } from '@/lib/api-auth';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { lineAccounts, notificationSettings } from '@/db/schema';
import { DEFAULT_DAILY_SUMMARY_SETTINGS } from '@/lib/notification-settings';

export const runtime = 'nodejs';

export interface DailySummarySettings {
  sendTime: string;
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showNet: boolean;
  showPending: boolean;
  showOverdue: boolean;
  showPendingDetails: boolean;
  showOverdueDetails: boolean;
}

function validateSettings(input: unknown): DailySummarySettings | { error: string } {
  if (!input || typeof input !== 'object') {
    return { error: 'Invalid settings object' };
  }
  const s = input as Record<string, unknown>;

  const sendTime = typeof s.sendTime === 'string' ? s.sendTime : '';
  if (sendTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(sendTime)) {
    return { error: 'sendTime must be in HH:mm format (00:00 - 23:59)' };
  }

  const boolFields = ['showBalance', 'showIncome', 'showExpense', 'showNet', 'showPending', 'showOverdue', 'showPendingDetails', 'showOverdueDetails'] as const;
  for (const f of boolFields) {
    if (s[f] !== undefined && typeof s[f] !== 'boolean') {
      return { error: `${f} must be a boolean` };
    }
  }

  return {
    sendTime: sendTime || DEFAULT_DAILY_SUMMARY_SETTINGS.sendTime,
    showBalance: typeof s.showBalance === 'boolean' ? s.showBalance : DEFAULT_DAILY_SUMMARY_SETTINGS.showBalance,
    showIncome: typeof s.showIncome === 'boolean' ? s.showIncome : DEFAULT_DAILY_SUMMARY_SETTINGS.showIncome,
    showExpense: typeof s.showExpense === 'boolean' ? s.showExpense : DEFAULT_DAILY_SUMMARY_SETTINGS.showExpense,
    showNet: typeof s.showNet === 'boolean' ? s.showNet : DEFAULT_DAILY_SUMMARY_SETTINGS.showNet,
    showPending: typeof s.showPending === 'boolean' ? s.showPending : DEFAULT_DAILY_SUMMARY_SETTINGS.showPending,
    showOverdue: typeof s.showOverdue === 'boolean' ? s.showOverdue : DEFAULT_DAILY_SUMMARY_SETTINGS.showOverdue,
    showPendingDetails: typeof s.showPendingDetails === 'boolean' ? s.showPendingDetails : DEFAULT_DAILY_SUMMARY_SETTINGS.showPendingDetails,
    showOverdueDetails: typeof s.showOverdueDetails === 'boolean' ? s.showOverdueDetails : DEFAULT_DAILY_SUMMARY_SETTINGS.showOverdueDetails,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Auth required
    await getRequestContext(request);
    const { userId } = await params;

    const db = getDb(await getD1());

    // Check that this user exists and has a line account
    const lineAccount = await db
      .select()
      .from(lineAccounts)
      .where(
        and(
          eq(lineAccounts.userId, userId),
          isNull(lineAccounts.deletedAt)
        )
      )
      .limit(1);

    if (lineAccount.length === 0) {
      return NextResponse.json(
        { success: false, error: `No LINE account found for user ${userId}` },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { enabled, settings: newSettings } = body as {
      enabled?: boolean;
      settings?: unknown;
    };

    // Validate enabled
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      throw new ValidationError({ message: 'enabled must be a boolean' });
    }

    // Validate settings
    let validatedSettings: DailySummarySettings | null = null;
    if (newSettings !== undefined) {
      const result = validateSettings(newSettings);
      if ('error' in result) {
        throw new ValidationError({ message: result.error });
      }
      validatedSettings = result;
    }

    const now = new Date();
    const nowSec = Math.floor(now.getTime() / 1000);

    // Check if notification_settings row exists for this user
    const existingRow = await db
      .select()
      .from(notificationSettings)
      .where(
        and(
          eq(notificationSettings.userId, userId),
          eq(notificationSettings.notificationType, 'daily_summary')
        )
      )
      .limit(1);

    if (existingRow.length === 0) {
      // Insert new row
      const defaultSettings: DailySummarySettings = {
        ...DEFAULT_DAILY_SUMMARY_SETTINGS,
        ...(validatedSettings ?? {}),
      };

      await db.insert(notificationSettings).values({
        id: `ns_daily_${userId}_${nowSec}`,
        userId,
        notificationType: 'daily_summary',
        settings: JSON.stringify(defaultSettings),
        enabled: enabled ?? true,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Update existing row
      const updateData: {
        settings?: string;
        enabled?: boolean;
        updatedAt: Date;
      } = { updatedAt: now };

      if (validatedSettings !== null) {
        // Merge with existing settings (partial update)
        const existingSettings = JSON.parse(existingRow[0].settings) as Partial<DailySummarySettings>;
        const merged = { ...existingSettings, ...validatedSettings };
        updateData.settings = JSON.stringify(merged);
      }

      if (enabled !== undefined) {
        updateData.enabled = enabled;
      }

      await db
        .update(notificationSettings)
        .set(updateData)
        .where(
          and(
            eq(notificationSettings.userId, userId),
            eq(notificationSettings.notificationType, 'daily_summary')
          )
        );
    }

    // Return updated settings
    const updatedRow = await db
      .select()
      .from(notificationSettings)
      .where(
        and(
          eq(notificationSettings.userId, userId),
          eq(notificationSettings.notificationType, 'daily_summary')
        )
      )
      .limit(1);

    const row = updatedRow[0];
    const parsed = JSON.parse(row.settings) as Partial<DailySummarySettings>;
    const finalSettings: DailySummarySettings = {
      ...DEFAULT_DAILY_SUMMARY_SETTINGS,
      ...parsed,
    };

    return NextResponse.json({
      success: true,
      message: 'Settings updated',
      userId,
      enabled: row.enabled,
      settings: finalSettings,
    });
  } catch (error) {
    console.error('[PATCH recipient] error:', error);
    return handleApiError(error);
  }
}
