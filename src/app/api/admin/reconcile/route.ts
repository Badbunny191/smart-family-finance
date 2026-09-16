import { NextRequest, NextResponse } from 'next/server';
import {
  ForbiddenError,
  getRequestContext,
  handleApiError,
  isAdmin,
} from '@/lib/api-auth';
import {
  runReconciliation,
  type ReconcileAccountRow,
} from '@/lib/reconciliation';

export const runtime = 'nodejs';

/**
 * GET /api/admin/reconcile
 *
 * Admin-only reconciliation report.
 *
 * Query params:
 *   - includeAll=true   → return every account (default false: only mismatches)
 *   - causeFor={id}     → also include possible root causes for one account
 *
 * Math is delegated to @/lib/reconciliation which uses getBalanceImpact /
 * getTransferImpact — no duplicated formulas.
 */
export async function GET(request: NextRequest) {
  try {
    const { db, session } = await getRequestContext(request);

    if (!isAdmin(session)) {
      throw new ForbiddenError('ต้องเป็น admin เท่านั้น');
    }

    const { searchParams } = new URL(request.url);
    const includeAll = searchParams.get('includeAll') === 'true';

    const report = await runReconciliation(db, { includeAll });

    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error);
  }
}

export type ReconcileApiResponse = Awaited<ReturnType<typeof GET>> extends NextResponse
  ? never
  : {
      accounts: ReconcileAccountRow[];
      hasDiscrepancy: boolean;
      totalAccounts: number;
      mismatchCount: number;
    };
