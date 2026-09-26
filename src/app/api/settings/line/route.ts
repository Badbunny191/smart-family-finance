/**
 * LINE Notification Settings API
 *
 * GET  /api/settings/line - Get all recipients with their per-user settings
 * PUT  (deprecated) - No longer used; use PATCH /recipient/:userId instead
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getRequestContext, handleApiError, ValidationError } from '@/lib/api-auth';
import { getD1 } from '@/lib/cloudflare';
import { getDb } from '@/db/client';
import { lineAccounts, notificationSettings } from '@/db/schema';
import { getLineBotInfo, LINEApiError } from '@/lib/line-notify';
import { DEFAULT_DAILY_SUMMARY_SETTINGS } from '@/lib/notification-settings';

export const runtime = 'nodejs';

export interface DailySummarySettings {
  sendTime: string;
  additionalTimes?: string[];
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showNet: boolean;
  showPending: boolean;
  showOverdue: boolean;
  showPendingDetails: boolean;
  showOverdueDetails: boolean;
}

function validateSettings(input: unknown): DailySummarySettings | { error: unknown } {
  if (!input || typeof input !== 'object') {
    return { error: 'Invalid settings object' };
  }
  const s = input as Record<string, unknown>;

  // sendTime: HH:mm (00-23 : 00-59)
  const sendTime = typeof s.sendTime === 'string' ? s.sendTime : '';
  if (sendTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(sendTime)) {
    return { error: 'sendTime must be in HH:mm format (00:00 - 23:59)' };
  }

  // additionalTimes: optional array of HH:mm — Multi-SendTime enhancement
  let additionalTimes: string[] = [];
  if (s.additionalTimes !== undefined) {
    if (!Array.isArray(s.additionalTimes)) {
      return { error: 'additionalTimes must be an array' };
    }
    additionalTimes = Array.from(
      new Set(
        (s.additionalTimes as unknown[])
          .filter((t): t is string => typeof t === 'string')
          .filter((t) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(t))
      )
    ).sort();
  }

  const boolFields = ['showBalance', 'showIncome', 'showExpense', 'showNet', 'showPending', 'showOverdue', 'showPendingDetails', 'showOverdueDetails'] as const;
  for (const f of boolFields) {
    if (s[f] !== undefined && typeof s[f] !== 'boolean') {
      return { error: `${f} must be a boolean` };
    }
  }

  return {
    sendTime: sendTime || DEFAULT_DAILY_SUMMARY_SETTINGS.sendTime,
    additionalTimes,
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

// ============================================================
// GET /api/settings/line
// ============================================================

export async function GET(_request: NextRequest) {
  try {
    const d1 = await getD1();
    const db = getDb(d1);

    // 1) Get all recipients
    const recipientsRaw = await db
      .select({
        id: lineAccounts.id,
        userId: lineAccounts.userId,
        lineUserId: lineAccounts.lineUserId,
        displayName: lineAccounts.displayName,
        notifyEnabled: lineAccounts.notifyEnabled,
      })
      .from(lineAccounts)
      .where(isNull(lineAccounts.deletedAt));

    // 2) Get notification settings for all recipients (per-user)
    const nsRows = await db
      .select()
      .from(notificationSettings)
      .where(
        and(
          eq(notificationSettings.notificationType, 'daily_summary'),
          eq(notificationSettings.enabled, true)
        )
      );

    // Build map: userId -> settings row
    const nsByUserId = new Map<string, { settings: DailySummarySettings; enabled: boolean }>();
    for (const row of nsRows) {
      const parsed = JSON.parse(row.settings) as Partial<DailySummarySettings>;
      const merged: DailySummarySettings = {
        ...DEFAULT_DAILY_SUMMARY_SETTINGS,
        ...parsed,
      };
      nsByUserId.set(row.userId, { settings: merged, enabled: row.enabled });
    }

    // 3) Map userId → user name
    let userNameMap = new Map<string, string>();
    if (recipientsRaw.length > 0) {
      const placeholders = recipientsRaw.map(() => '?').join(',');
      const stmt = d1
        .prepare(`SELECT id, name FROM users WHERE id IN (${placeholders})`)
        .bind(...recipientsRaw.map((r) => r.userId));
      const userRows = await stmt.all<{ id: string; name: string }>();
      for (const u of userRows.results ?? []) {
        userNameMap.set(u.id, u.name);
      }
    }

    // 4) Build recipients array with embedded settings
    const recipients = recipientsRaw.map((r) => {
      const ns = nsByUserId.get(r.userId);
      return {
        id: r.id,
        userId: r.userId,
        lineUserId: r.lineUserId,
        displayName: r.displayName ?? userNameMap.get(r.userId) ?? 'Unknown',
        notifyEnabled: r.notifyEnabled,
        enabled: ns?.enabled ?? true,
        settings: ns?.settings ?? DEFAULT_DAILY_SUMMARY_SETTINGS,
      };
    });

    let enabledCount = 0;
    for (const r of recipients) {
      if (r.notifyEnabled) enabledCount++;
    }

    // 5) Bot connection status
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const hasAccessToken = !!accessToken && accessToken.trim().length > 0;
    let tokenVerified = false;
    let verifyError: string | null = null;
    let botBasicId: string | null = process.env.LINE_BOT_BASIC_ID || null;
    let botName: string | null = botBasicId ? `@${botBasicId}` : null;
    let botDisplayName: string | null = null;
    let botPictureUrl: string | null = null;

    if (hasAccessToken && accessToken) {
      try {
        const info = await getLineBotInfo(accessToken);
        tokenVerified = true;
        botBasicId = info.basicId;
        botName = info.basicId;
        botDisplayName = info.displayName;
        botPictureUrl = info.pictureUrl ?? null;
      } catch (err) {
        if (err instanceof LINEApiError) {
          verifyError = `${err.statusCode}`;
        } else {
          verifyError = err instanceof Error ? err.message : 'unknown';
        }
      }
    }

    const connected =
      hasAccessToken &&
      (tokenVerified || (verifyError === null && enabledCount > 0));

    return NextResponse.json({
      success: true,
      bot: {
        connected,
        hasAccessToken,
        tokenVerified,
        botBasicId,
        botName,
        botDisplayName,
        botPictureUrl,
        verifyError,
      },
      recipients,
      recipientSummary: {
        total: recipients.length,
        enabled: enabledCount,
      },
    });
  } catch (error) {
    console.error('[Settings LINE] GET error:', error);
    return handleApiError(error);
  }
}

// ============================================================
// PUT /api/settings/line
// (Legacy — kept for backward compat; new code should use PATCH /recipient/:userId)
// ============================================================

export async function PUT(request: NextRequest) {
  // Legacy PUT: update current session user's settings
  // New code should use PATCH /api/settings/line/recipient/:userId instead
  try {
    const { db, session } = await getRequestContext(request);
    const userId = session.user.id;
    const body = await request.json().catch(() => ({}));
    const { enabled: newEnabled, settings: newSettings } = body as { enabled?: boolean; settings?: unknown };

    let validatedSettings: DailySummarySettings | null = null;
    if (newSettings !== undefined) {
      const result = validateSettings(newSettings);
      if ('error' in result) throw new ValidationError({ message: result.error });
      validatedSettings = result;
    }
    if (newEnabled !== undefined && typeof newEnabled !== 'boolean') {
      throw new ValidationError({ message: 'enabled must be a boolean' });
    }

    const now = new Date();
    const nowSec = Math.floor(now.getTime() / 1000);

    const existing = await db
      .select()
      .from(notificationSettings)
      .where(
        and(
          eq(notificationSettings.userId, userId),
          eq(notificationSettings.notificationType, 'daily_summary')
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(notificationSettings).values({
        id: `ns_daily_${userId}_${nowSec}`,
        userId,
        notificationType: 'daily_summary',
        settings: JSON.stringify(validatedSettings ?? DEFAULT_DAILY_SUMMARY_SETTINGS),
        enabled: newEnabled ?? true,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const updateData: { settings?: string; enabled?: boolean; updatedAt: Date } = { updatedAt: now };
      if (validatedSettings !== null) {
        updateData.settings = JSON.stringify(validatedSettings);
      }
      if (newEnabled !== undefined) {
        updateData.enabled = newEnabled;
      }
      await db.update(notificationSettings).set(updateData).where(
        and(
          eq(notificationSettings.userId, userId),
          eq(notificationSettings.notificationType, 'daily_summary')
        )
      );
    }

    return NextResponse.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    console.error('[Settings LINE] PUT error:', error);
    return handleApiError(error);
  }
}
