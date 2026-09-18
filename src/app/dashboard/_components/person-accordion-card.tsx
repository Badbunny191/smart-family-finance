'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, PiggyBank, Building2 } from 'lucide-react';
import { formatAccountDisplayName, formatCurrency } from '@/lib/utils';

/**
 * Dashboard-friendly account display.
 * Bank: returns [nameLine, secondLine] — both as separate strings for different font sizes
 *   Line 1: "{name}"
 *   Line 2: "({bankName}) {last4}"
 * Cash: returns [nameLine, secondLine] — both as separate strings for different font sizes
 *   Line 1: "💵 {name}"
 *   Line 2: "(เงินสด)"
 */
function getDashboardAccountParts(account: AccountRow): [string, string] {
  const displayName = account.name?.trim() || account.owner?.trim() || '';

  if (account.accountType === 'cash') {
    const nameLine = displayName ? `💵 ${displayName}` : '💵 เงินสด';
    const secondLine = '(เงินสด)';
    return [nameLine, secondLine];
  }
  const bank = account.bankName || 'ไม่ระบุธนาคาร';
  const last4 =
    account.accountNumber && account.accountNumber.length > 0
      ? account.accountNumber.replace(/-/g, '').slice(-4)
      : '';
  const nameLine = displayName;
  const secondLine = last4 ? `(${bank}) ${last4}` : `(${bank})`;
  return [nameLine, secondLine];
}

// Types
type AccountRow = {
  id: string;
  name: string;
  accountType: 'cash' | 'bank';
  accountAlias?: string | null;
  accountNumber?: string | null;
  bankName: string | null;
  currentBalance: number;
  /** Owner/person name — used as fallback when name is empty */
  owner?: string | null;
};

type PersonWithAccounts = {
  personId: string;
  personName: string;
  totalBalance: number;
  accounts: AccountRow[];
};

type PersonAccordionCardProps = {
  persons: PersonWithAccounts[];
  variant: 'personal' | 'business';
};

// Get variant colors
function getVariantColors(variant: 'personal' | 'business') {
  return variant === 'business'
    ? {
        iconBg: 'bg-emerald-50',
        iconText: 'text-emerald-700',
        accentText: 'text-emerald-600',
        expandedIcon: 'text-emerald-600',
        accountBg: 'bg-emerald-50/50',
      }
    : {
        iconBg: 'bg-indigo-50',
        iconText: 'text-indigo-700',
        accentText: 'text-indigo-600',
        expandedIcon: 'text-indigo-600',
        accountBg: 'bg-indigo-50/50',
      };
}

// Account icon component
function AccountIcon({ type }: { type: 'cash' | 'bank' }) {
  if (type === 'cash') {
    return (
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    </div>
  );
}

// Person Accordion Row Component
function PersonAccordionRow({
  person,
  isExpanded,
  onToggle,
  variant,
}: {
  person: PersonWithAccounts;
  isExpanded: boolean;
  onToggle: () => void;
  variant: 'personal' | 'business';
}) {
  const colors = getVariantColors(variant);
  const contentId = `accordion-content-${person.personId}`;

  // Icon based on variant
  const IconComponent = variant === 'business' ? Building2 : PiggyBank;

  return (
    <div className="surface-card overflow-hidden">
      {/* Person Row - Expand/Collapse ONLY (no navigation) */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full min-h-[56px] items-center justify-between p-4 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        aria-label={`${person.personName} มี ${person.accounts.length} บัญชี`}
      >
        <div className="flex items-center gap-3">
          {/* Icon indicator */}
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${colors.iconBg} ${colors.iconText}`}>
            <IconComponent size={18} />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{person.personName}</p>
            <p className="text-xs text-slate-500">{person.accounts.length} บัญชี</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-900">{formatCurrency(person.totalBalance)}</span>
          {/* Expand/Collapse Indicator */}
          <div className="grid h-6 w-6 shrink-0 place-items-center text-slate-400 transition-transform duration-200">
            {isExpanded ? (
              <ChevronDown size={20} className={colors.expandedIcon} />
            ) : (
              <ChevronRight size={20} />
            )}
          </div>
        </div>
      </button>

      {/* Account Rows - Visible when expanded */}
      <div
        id={contentId}
        role="region"
        aria-labelledby={`accordion-${person.personId}`}
        className={`overflow-hidden border-t border-slate-100 transition-all duration-200 ease-out ${
          isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className={`divide-y divide-slate-100 ${colors.accountBg}`}>
          {person.accounts.map((account) => (
            <Link
              key={account.id}
              href={`/transactions?account=${account.id}`}
              prefetch={false}
              className="flex min-h-[52px] items-center justify-between p-4 pl-6 transition-colors hover:bg-white active:bg-slate-100"
            >
              <div className="flex items-center gap-3">
                <AccountIcon type={account.accountType} />
                {(function () {
                  const [nameLine, last4] = getDashboardAccountParts(account);
                  return (
                    <div>
                      <p className="font-medium text-slate-800 leading-tight">{nameLine}</p>
                      {last4 && <p className="text-xs text-slate-400">{last4}</p>}
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-700">{formatCurrency(account.currentBalance)}</span>
                <ChevronRight size={18} className="text-slate-400" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main PersonAccordionCard Component
export function PersonAccordionCard({ persons, variant }: PersonAccordionCardProps) {
  // State to track which person is expanded (only one at a time)
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);

  const handleToggle = (personId: string) => {
    setExpandedPersonId((current) => (current === personId ? null : personId));
  };

  if (persons.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {persons.map((person) => (
        <PersonAccordionRow
          key={person.personId}
          person={person}
          isExpanded={expandedPersonId === person.personId}
          onToggle={() => handleToggle(person.personId)}
          variant={variant}
        />
      ))}
    </div>
  );
}
