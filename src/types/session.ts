/**
 * Extended session type with role support
 */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role: 'admin' | 'viewer';
  emailVerified: boolean;
}

export interface Session {
  session: {
    id: string;
    expiresAt: Date;
    token: string;
  };
  user: SessionUser;
}

/**
 * Get user role from session
 */
export function getUserRole(session: Session | null): 'admin' | 'viewer' {
  if (!session?.user) return 'viewer';
  return session.user.role || 'viewer';
}

/**
 * Check if user is admin
 */
export function isUserAdmin(session: Session | null): boolean {
  return getUserRole(session) === 'admin';
}
