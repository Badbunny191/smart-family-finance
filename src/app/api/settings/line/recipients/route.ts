/**
 * LINE Notification Settings - Recipients API
 *
 * GET    /api/settings/line/recipients - List recipients
 * PATCH  /api/settings/line/recipients - Toggle a recipient's notify_enabled
 *
 * Body for PATCH: { lineAccountId: string, notifyEnabled: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { getRequestContext, handleApiError, ValidationError } from '@/lib/api-auth';
import { getD1 } from '@/lib/cloudflare';
import { lineAccounts } from '@/db/schema';

export const runtime = 'nodejs';

// ============================================================
// GET /api/settings/line/recipients
// ============================================================

export async function GET(_request: NextRequest) {
  try {
    const { db } = await getRequestContext(_request);

    const recipientsRaw = await db
      .select({
        id: lineAccounts.id,
        userId: lineAccounts.userId,
        lineUserId: lineAccounts.lineUserId,
        displayName: lineAccounts.displayName,
        notifyEnabled: lineAccounts.notifyEnabled,
        createdAt: lineAccounts.createdAt,
      })
      .from(lineAccounts)
      .where(isNull(lineAccounts.deletedAt));

    // Lookup user names via D1 directly
    const userIds = recipientsRaw.map((r) => r.userId);
    let userNameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const d1 = await getD1();
      const placeholders = userIds.map(() => '?').join(',');
      const stmt = d1
        .prepare(`SELECT id, name FROM users WHERE id IN (${placeholders})`)
        .bind(...userIds);
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
      recipients,
      summary: {
        total: recipients.length,
        enabled: recipients.filter((r) => r.notifyEnabled).length,
      },
    });
  } catch (error) {
    console.error('[Recipients] GET error:', error);
    return handleApiError(error);
  }
}

// ============================================================
// PATCH /api/settings/line/recipients
// ============================================================

export async function PATCH(request: NextRequest) {
  try {
    const { db } = await getRequestContext(request);
    const body = await request.json().catch(() => ({}));

    const { lineAccountId, notifyEnabled } = body as {
      lineAccountId?: string;
      notifyEnabled?: boolean;
    };

    if (!lineAccountId || typeof lineAccountId !== 'string') {
      throw new ValidationError({ message: 'lineAccountId is required' });
    }
    if (typeof notifyEnabled !== 'boolean') {
      throw new ValidationError({ message: 'notifyEnabled must be a boolean' });
    }

    const now = new Date();
    const updated = await db
      .update(lineAccounts)
      .set({ notifyEnabled, updatedAt: now })
      .where(
        and(
          eq(lineAccounts.id, lineAccountId),
          isNull(lineAccounts.deletedAt)
        )
      )
      .run();

    if (updated.meta.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Line account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Recipient updated',
      lineAccountId,
      notifyEnabled,
    });
  } catch (error) {
    console.error('[Recipients] PATCH error:', error);
    return handleApiError(error);
  }
}
