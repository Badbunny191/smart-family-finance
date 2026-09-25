import { NextRequest, NextResponse } from 'next/server';
import {
  ForbiddenError,
  getRequestContext,
  handleApiError,
  isAdmin,
} from '@/lib/api-auth';
import { users, notificationSettings, lineAccounts } from '@/db/schema';
import { eq, isNull } from 'drizzle-orm';
import {
  type UserListItem,
  parseSettingsJson,
  getLineStatus,
} from '@/types/admin-users';

/**
 * GET /api/admin/users
 * List all users with their LINE and notification status (Read Only)
 * 
 * Phase 1: No Add/Edit user - only viewing and notification settings
 */
export async function GET(request: NextRequest) {
  try {
    const { db, session } = await getRequestContext(request);

    if (!isAdmin(session)) {
      throw new ForbiddenError('ต้องเป็น admin เท่านั้น');
    }

    // ─── Fetch Data ─────────────────────────────────────────────────────────────
    // Get all users (not deleted)
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(isNull(users.deletedAt))
      .orderBy(users.createdAt);

    // Get LINE accounts for all users
    const lineAccountsData = await db
      .select({
        userId: lineAccounts.userId,
        displayName: lineAccounts.displayName,
        notifyEnabled: lineAccounts.notifyEnabled,
      })
      .from(lineAccounts)
      .where(isNull(lineAccounts.deletedAt));

    // Get notification settings (daily_summary) for all users
    const notifSettingsData = await db
      .select({
        userId: notificationSettings.userId,
        settings: notificationSettings.settings,
        enabled: notificationSettings.enabled,
        lastSentAt: notificationSettings.lastSentAt,
      })
      .from(notificationSettings)
      .where(eq(notificationSettings.notificationType, 'daily_summary'));

    // Create lookup maps
    const lineMap = new Map(
      lineAccountsData.map((la) => [la.userId, la])
    );
    const notifMap = new Map(
      notifSettingsData.map((ns) => [ns.userId, ns])
    );

    // Combine data
    const userList: UserListItem[] = allUsers.map((user) => {
      const lineData = lineMap.get(user.id);
      const notifData = notifMap.get(user.id);
      const hasLine = !!lineData;
      const notifyEnabled = hasLine ? (lineData?.notifyEnabled ?? false) : false;
      const { sendTime } = parseSettingsJson(notifData?.settings);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        lineStatus: getLineStatus(hasLine, notifyEnabled),
        lineDisplayName: lineData?.displayName ?? null,
        notifyEnabled: hasLine ? notifyEnabled : false,
        sendTime: sendTime,
        lastSentAt: notifData?.lastSentAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ users: userList });
  } catch (error) {
    return handleApiError(error);
  }
}
