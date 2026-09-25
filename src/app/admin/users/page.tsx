'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Loader2,
  Pencil,
  ShieldAlert,
  User,
  Bell,
  BellOff,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { MobileNav } from '@/components/mobile-nav';
import { useSession } from '@/lib/auth-client';
import {
  type UserListItem,
  type UpdateUserRequest,
  UserLineStatus,
} from '@/types/admin-users';

// ─── Constants ───────────────────────────────────────────────────────────────

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

// ─── Status Badge Component ─────────────────────────────────────────────────

function LineStatusBadge({ status }: { status: UserLineStatus }) {
  const configs: Record<UserLineStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    no_line: {
      label: 'NO LINE',
      color: 'text-red-600',
      bg: 'bg-red-50 border-red-200',
      icon: <User size={12} />,
    },
    notify_off: {
      label: 'NOTIFY OFF',
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
      icon: <BellOff size={12} />,
    },
    active: {
      label: 'ACTIVE',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
      icon: <Bell size={12} />,
    },
  };

  const config = configs[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${config.color} ${config.bg}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

// ─── User Row Component ─────────────────────────────────────────────────────

function UserRow({
  user,
  onEdit,
}: {
  user: UserListItem;
  onEdit: (user: UserListItem) => void;
}) {
  const roleColors = {
    admin: 'bg-purple-100 text-purple-700',
    viewer: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition-all hover:shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900 truncate">{user.name}</span>
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${roleColors[user.role]}`}>
            {user.role === 'admin' ? 'Admin' : 'Viewer'}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 truncate">{user.email}</p>
        <div className="mt-2 flex items-center gap-3">
          <LineStatusBadge status={user.lineStatus} />
          {user.sendTime && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Clock size={11} />
              {user.sendTime}
            </span>
          )}
          {user.lastSentAt && (
            <span suppressHydrationWarning className="text-xs text-slate-400">
              ส่งล่าสุด: {new Date(user.lastSentAt).toLocaleDateString('th-TH')}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onEdit(user)}
        className="touch-button ml-3 shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <Pencil size={16} />
      </button>
    </div>
  );
}

// ─── Edit Modal (Notification Settings Only) ───────────────────────────────

interface EditModalProps {
  user: UserListItem;
  onClose: () => void;
  onSuccess: () => void;
}

function EditModal({ user, onClose, onSuccess }: EditModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enableDailySummary, setEnableDailySummary] = useState(user.notifyEnabled);
  const [sendTime, setSendTime] = useState(user.sendTime ?? '08:00');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const body: UpdateUserRequest = {
        enableDailySummary,
        sendTime,
      };

      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? 'เกิดข้อผิดพลาด');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="relative w-full max-w-md rounded-t-2xl bg-white pb-safe sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">ตั้งค่าการแจ้งเตือน</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <span className="sr-only">ปิด</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* User Info */}
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
          <p className="font-medium text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4">
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Enable Notify */}
          <div className="mb-4">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <input
                type="checkbox"
                checked={enableDailySummary}
                onChange={(e) => setEnableDailySummary(e.target.checked)}
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-medium text-slate-700">เปิด Daily Summary</span>
                <p className="text-xs text-slate-500">
                  ส่งสรุปยอดคงเหลือทุกวัน
                </p>
              </div>
            </label>
          </div>

          {/* Send Time */}
          {enableDailySummary && (
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                เวลาส่ง Daily Summary
              </label>
              <select
                value={sendTime}
                onChange={(e) => setSendTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-colors hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                {TIME_OPTIONS.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { data: session, isPending: sessionPending } = useSession();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);

  const isAdmin = (session?.user as { role?: string })?.role === 'admin';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json() as { error?: string; users: UserListItem[] };

      if (!res.ok) {
        throw new Error(data.error ?? 'เกิดข้อผิดพลาด');
      }

      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session && isAdmin) {
      fetchUsers();
    }
  }, [session, isAdmin, fetchUsers]);

  // Loading state
  if (sessionPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 size={32} className="animate-spin text-slate-400" />
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-5">
        <ShieldAlert size={48} className="text-slate-300" />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">ไม่ได้เข้าสู่ระบบ</h1>
        <p className="mt-1 text-sm text-slate-500">กรุณาเข้าสู่ระบบก่อน</p>
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-5">
        <ShieldAlert size={48} className="text-slate-300" />
        <h1 className="mt-4 text-lg font-semibold text-slate-900">ไม่มีสิทธิ์เข้าถึง</h1>
        <p className="mt-1 text-sm text-slate-500">หน้านี้ต้องการสิทธิ์ Admin</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <MobileNav />

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              User Settings
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              จัดการการแจ้งเตือนของผู้ใช้
            </p>
          </div>
        </div>
      </header>

      <div className="px-5 py-5">
        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
            <button
              type="button"
              onClick={fetchUsers}
              className="ml-auto underline"
            >
              ลองใหม่
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-slate-400" size={28} />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
            <User size={48} className="text-slate-300" />
            <h3 className="mt-4 font-semibold text-slate-600">ยังไม่มีผู้ใช้</h3>
            <p className="mt-1 text-sm text-slate-400">
              ผู้ใช้จะปรากฏที่นี่เมื่อมีการสร้างบัญชี
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Stats */}
            <div className="mb-4 flex items-center gap-4 text-sm text-slate-500">
              <span>ผู้ใช้ทั้งหมด: {users.length}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Bell size={14} className="text-emerald-500" />
                {users.filter((u) => u.lineStatus === 'active').length} Active
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <User size={14} className="text-red-500" />
                {users.filter((u) => u.lineStatus === 'no_line').length} No LINE
              </span>
            </div>

            {/* User List */}
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                onEdit={(u) => setEditingUser(u)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <EditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={fetchUsers}
        />
      )}
    </div>
  );
}
