/**
 * LINE Notification Settings API
 *
 * GET  /api/settings/line - Get current user's daily_summary settings + bot info + recipients
 * PUT  /api/settings/line - Update current user's daily_summary settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getRequestContext, handleApiError, ValidationError } from '@/lib/api-auth';
import { getD1 } from '@/lib/cloudflare';
import { lineAccounts, notificationSettings } from '@/db/schema';
import { getLineBotInfo, LINEApiError } from '@/lib/line-notify';

export const runtime = 'nodejs';

interface DailySummarySettings {
  sendTime: string;        // "HH:mm"
  showBalance: boolean;
  showIncome: boolean;
  showExpense: boolean;
  showPending: boolean;
  showOverdue: boolean;
}

const DEFAULT_SETTINGS: DailySummarySettings = {
  sendTime: '08:00',
  showBalance: true,
  showIncome: true,
  showExpense: true,
  showPending: true,
  showOverdue: true,
};

function validateSettings(input: unknown): DailySummarySettings | { error: unknown } {
  if (!input || typeof input !== 'object') {
    return { error: 'Invalid settings object' };
  }
  const s = input as Record<string, unknown>;

  // sendTime: HH:mm (00-23 : 00-59)
  const sendTime = typeof s.sendTime === 'string' ? s.sendTime : '';
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(sendTime)) {
    return { error: 'sendTime must be in HH:mm format (00:00 - 23:59)' };
  }

  const boolFields = ['showBalance', 'showIncome', 'showExpense', 'showPending', 'showOverdue'] as const;
  for (const f of boolFields) {
    if (typeof s[f] !== 'boolean') {
      return { error: `${f} must be a boolean` };
    }
  }

  return {
    sendTime,
    showBalance: s.showBalance as boolean,
    showIncome: s.showIncome as boolean,
    showExpense: s.showExpense as boolean,
    showPending: s.showPending as boolean,
    showOverdue: s.showOverdue as boolean,
  };
}

// ============================================================
// GET /api/settings/line
// ============================================================

export async function GET(_request: NextRequest) {
  try {
    const { db, session } = await getRequestContext(_request);
    const userId = session.user.id;

    // 1) Read settings for current user (default if missing)
    const rows = await db
      .select()
      .from(notificationSettings)
      .where(
        and(
          eq(notificationSettings.userId, userId),
          eq(notificationSettings.notificationType, 'daily_summary')
        )
      )
      .limit(1);

    let settings: DailySummarySettings = DEFAULT_SETTINGS;
    let enabled = true;
    let lastTestAt: string | null = null;

    if (rows.length > 0) {
      const row = rows[0];
      enabled = row.enabled;
      try {
        const parsed = JSON.parse(row.settings);
        settings = { ...DEFAULT_SETTINGS, ...parsed };
      } catch {
        // Use defaults if JSON is malformed
      }
    }

    // 2) Get recipients FIRST — we need them for the connected heuristic
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

    // 3) Bot connection status
    //
    // "Connected" = we can actually send a LINE message.
    //
    // 3 conditions must all be true:
    //   (a) LINE_CHANNEL_ACCESS_TOKEN env var exists
    //   (b) We can either:
    //       - verify the token via /v2/bot/info, OR
    //       - send a push (proven by successful test-send / cron)
    //   (c) At least one enabled recipient exists
    //
    // The OLD logic was buggy: it required LINE_CHANNEL_SECRET AND LINE_BOT_BASIC_ID,
    // both of which are NOT needed to push messages — only the access token is.
    // That's why "Test Send" succeeded but the UI showed "Not configured".

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
          console.warn(`[Settings LINE] /v2/bot/info failed: ${err.statusCode} — falling back to heuristic`);
        } else {
          verifyError = err instanceof Error ? err.message : 'unknown';
        }
        // Fall through — we'll fall back to heuristic below
      }
    }

    // Heuristic fallback: if token is set AND we have ≥1 enabled recipient,
    // we know the token at least parses. (Cron/test-send prove this works.)
    let enabledRecipientCount = 0;
    for (const r of recipientsRaw) {
      if (r.notifyEnabled) enabledRecipientCount++;
    }

    const connected =
      hasAccessToken &&
      (tokenVerified || (verifyError === null && enabledRecipientCount > 0));

    if (!connected && !hasAccessToken) {
      verifyError = 'LINE_CHANNEL_ACCESS_TOKEN is not set';
    }

    // Map userId → user name — query users table via D1 directly
    const d1 = await getD1();
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

    const recipients = recipientsRaw.map((r) => ({
      id: r.id,
      userId: r.userId,
      lineUserId: r.lineUserId,
      displayName: r.displayName ?? userNameMap.get(r.userId) ?? 'Unknown',
      notifyEnabled: r.notifyEnabled,
    }));

    return NextResponse.json({
      success: true,
      settings,
      enabled,
      lastTestAt,
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
        enabled: enabledRecipientCount,
      },
    });
  } catch (error) {
    console.error('[Settings LINE] GET error:', error);
    return handleApiError(error);
  }
}

// ============================================================
// PUT /api/settings/line
// ============================================================

export async function PUT(request: NextRequest) {
  try {
    const { db, session } = await getRequestContext(request);
    const userId = session.user.id;

    const body = await request.json().catch(() => ({}));
    const {
      enabled: newEnabled,
      settings: newSettings,
    } = body as { enabled?: boolean; settings?: unknown };

    // Validate settings if provided
    let validatedSettings: DailySummarySettings | null = null;
    if (newSettings !== undefined) {
      const result = validateSettings(newSettings);
      if ('error' in result) {
        throw new ValidationError({ message: result.error });
      }
      validatedSettings = result;
    }

    if (newEnabled !== undefined && typeof newEnabled !== 'boolean') {
      throw new ValidationError({ message: 'enabled must be a boolean' });
    }

    const now = new Date();
    const nowSec = Math.floor(now.getTime() / 1000);

    // Check if exists
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
      // Insert new
      await db.insert(notificationSettings).values({
        id: `ns_daily_${userId}_${nowSec}`,
        userId,
        notificationType: 'daily_summary',
        settings: JSON.stringify(validatedSettings ?? DEFAULT_SETTINGS),
        enabled: newEnabled ?? true,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Update
      const updateData: { settings?: string; enabled?: boolean; updatedAt: Date } = {
        updatedAt: now,
      };
      if (validatedSettings !== null) {
        updateData.settings = JSON.stringify(validatedSettings);
      }
      if (newEnabled !== undefined) {
        updateData.enabled = newEnabled;
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

    return NextResponse.json({
      success: true,
      message: 'Settings updated',
      updated: {
        enabled: newEnabled,
        settings: validatedSettings,
      },
    });
  } catch (error) {
    console.error('[Settings LINE] PUT error:', error);
    return handleApiError(error);
  }
}
