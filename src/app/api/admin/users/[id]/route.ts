import { NextRequest, NextResponse } from 'next/server';
import {
  ForbiddenError,
  getRequestContext,
  handleApiError,
  isAdmin,
} from '@/lib/api-auth';
import { users, notificationSettings, lineAccounts } from '@/db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import {
  type UpdateUserRequest,
  type UserListItem,
  parseSettingsJson,
  getLineStatus,
} from '@/types/admin-users';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/users/[id]
 * Update notification settings only (Read Only for user info)
 * 
 * Phase 1: Only allow updating notification settings (enableDailySummary, sendTime)
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { db, session } = await getRequestContext(request);

    if (!isAdmin(session)) {
      throw new ForbiddenError('ต้องเป็น admin เท่านั้น');
    }

    const { id } = await context.params;
    const body = (await request.json()) as UpdateUserRequest;

    // ─── Validation ───────────────────────────────────────────────────────────
    // Only validate notification settings
    if (body.sendTime !== undefined && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(body.sendTime)) {
      return NextResponse.json(
        { error: 'รูปแบบเวลาไม่ถูกต้อง (HH:MM)' },
        { status: 400 }
      );
    }

    // ─── Check user exists ─────────────────────────────────────────────────────
    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);

    if (existingUser.length === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้นี้' }, { status: 404 });
    }

    const now = new Date();

    // ─── Update Notification Settings ───────────────────────────────────────────
    // Find existing notification settings for daily_summary
    const existingNotif = await db
      .select({ id: notificationSettings.id, settings: notificationSettings.settings })
      .from(notificationSettings)
      .where(
        and(
          eq(notificationSettings.userId, id),
          eq(notificationSettings.notificationType, 'daily_summary')
        )
      )
      .limit(1);

    if (existingNotif.length > 0) {
      // Update existing settings
      const currentSettings = parseSettingsJson(existingNotif[0].settings);
      const newSettings: Record<string, unknown> = {
        ...currentSettings,
      };

      if (body.sendTime !== undefined) {
        newSettings.sendTime = body.sendTime;
      }

      await db
        .update(notificationSettings)
        .set({
          settings: JSON.stringify(newSettings),
          enabled: body.enableDailySummary ?? undefined,
          updatedAt: now,
        })
        .where(eq(notificationSettings.id, existingNotif[0].id));
    } else if (body.sendTime !== undefined || body.enableDailySummary !== undefined) {
      // Create if doesn't exist (edge case)
      await db.insert(notificationSettings).values({
        id: crypto.randomUUID(),
        userId: id,
        notificationType: 'daily_summary',
        settings: JSON.stringify({ sendTime: body.sendTime ?? '08:00' }),
        enabled: body.enableDailySummary ?? true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // ─── Return updated user ────────────────────────────────────────────────────
    const updatedUser = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    // Get LINE account
    const lineData = await db
      .select({
        displayName: lineAccounts.displayName,
        notifyEnabled: lineAccounts.notifyEnabled,
      })
      .from(lineAccounts)
      .where(and(eq(lineAccounts.userId, id), isNull(lineAccounts.deletedAt)))
      .limit(1);

    // Get notification settings
    const notifData = await db
      .select({
        settings: notificationSettings.settings,
        enabled: notificationSettings.enabled,
        lastSentAt: notificationSettings.lastSentAt,
      })
      .from(notificationSettings)
      .where(
        and(
          eq(notificationSettings.userId, id),
          eq(notificationSettings.notificationType, 'daily_summary')
        )
      )
      .limit(1);

    const hasLine = lineData.length > 0;
    const notifyEnabled = hasLine ? (lineData[0]?.notifyEnabled ?? false) : false;
    const { sendTime } = parseSettingsJson(notifData[0]?.settings);

    const response: UserListItem = {
      id: updatedUser[0].id,
      name: updatedUser[0].name,
      email: updatedUser[0].email,
      role: updatedUser[0].role,
      createdAt: updatedUser[0].createdAt.toISOString(),
      lineStatus: getLineStatus(hasLine, notifyEnabled),
      lineDisplayName: lineData[0]?.displayName ?? null,
      notifyEnabled: hasLine ? notifyEnabled : false,
      sendTime: sendTime,
      lastSentAt: notifData[0]?.lastSentAt?.toISOString() ?? null,
    };

    return NextResponse.json({ user: response });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/admin/users/[id]
 * NOT IMPLEMENTED in Phase 1
 */
export async function DELETE(
  _request: NextRequest,
  _context: RouteContext
) {
  return NextResponse.json(
    { error: 'ฟังก์ชันนี้ยังไม่เปิดให้ใช้งาน' },
    { status: 501 }
  );
}
