import type { Report } from '@/lib/report';
import {
  formatCurrencyExact,
  formatCurrencyShort,
} from '@/lib/report';

type ShareableReportProps = {
  report: Report;
};

/**
 * Map property name -> emoji.
 * Accepts common Thai variants. Falls back to 📍.
 */
function getPropertyEmoji(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (
    normalized.includes('บ้าน') ||
    normalized.includes('house') ||
    normalized.includes('home')
  ) {
    return '🏠';
  }
  if (
    normalized.includes('คอนโด') ||
    normalized.includes('condo') ||
    normalized.includes('apartment')
  ) {
    return '🏢';
  }
  if (
    normalized.includes('รถ') ||
    normalized.includes('car') ||
    normalized.includes('vehicle')
  ) {
    return '🚗';
  }
  if (
    normalized.includes('ที่ดิน') ||
    normalized.includes('land') ||
    normalized.includes('ที่ ดิน')
  ) {
    return '🌍';
  }
  return '📍';
}

/**
 * Detect empty report (no income & no expense).
 */
function isEmptyReport(report: Report): boolean {
  return (
    report.income.items.length === 0 && report.expense.items.length === 0
  );
}

export function ShareableReport({ report }: ShareableReportProps) {
  // Empty state
  if (isEmptyReport(report)) {
    return (
      <div
        data-shareable-report
        style={{
          width: '720px',
          background: '#ffffff',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "Sarabun", sans-serif',
          color: '#1e293b',
          padding: '48px 36px',
          boxSizing: 'border-box',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
        <div
          style={{
            fontSize: '14px',
            color: '#64748b',
            fontWeight: 600,
            letterSpacing: '0.5px',
            marginBottom: '8px',
          }}
        >
          สรุปการเงิน
        </div>
        <div
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: '12px',
          }}
        >
          {report.periodLabel}
        </div>
        <div
          style={{
            fontSize: '18px',
            color: '#94a3b8',
            fontStyle: 'italic',
            marginTop: '24px',
          }}
        >
          ไม่มีข้อมูลในช่วงเวลานี้
        </div>
        <div
          style={{
            marginTop: '32px',
            paddingTop: '16px',
            borderTop: '1px dashed #e2e8f0',
            fontSize: '13px',
            color: '#64748b',
            fontWeight: 500,
          }}
        >
          สร้างจาก Smart Family Finance
        </div>
      </div>
    );
  }

  return (
    <div
      // This component is rendered both in preview UI and captured as image
      // Keep styling simple & deterministic for image rendering
      data-shareable-report
      style={{
        width: '720px',
        background: '#ffffff',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "Sarabun", sans-serif',
        color: '#1e293b',
        padding: '32px 36px',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div
          style={{
            fontSize: '14px',
            color: '#64748b',
            fontWeight: 600,
            letterSpacing: '0.5px',
          }}
        >
          📊 สรุปการเงิน
        </div>
        <div
          style={{
            fontSize: '28px',
            fontWeight: 800,
            marginTop: '6px',
            color: '#0f172a',
            lineHeight: 1.2,
          }}
        >
          {report.periodLabel}
        </div>
      </div>

      {/* Income Section */}
      <ReportSection title="💰 รายรับรวม" total={report.income.total} color="#059669" />
      {report.income.items.length > 0 && (
        <ReportItemList
          title="📥 รายรับ"
          items={report.income.items}
          color="#059669"
        />
      )}

      {/* Divider */}
      <Divider />

      {/* Expense Section */}
      <ReportSection
        title="💸 รายจ่ายรวม"
        total={report.expense.total}
        color="#e11d48"
      />

      {/* Expense by property groups */}
      {report.expense.byProperty.length > 0 ? (
        report.expense.byProperty.map((group) => (
          <PropertyGroupBlock
            key={group.propertyId || 'unassigned'}
            name={group.propertyName}
            emoji={getPropertyEmoji(group.propertyName)}
            total={group.total}
            items={group.items}
          />
        ))
      ) : (
        <EmptyLine text="ไม่มีรายจ่ายในช่วงนี้" />
      )}

      {/* Divider before Net */}
      <Divider />

      {/* Net Section */}
      <NetSection net={report.net} />

      {/* Footer */}
      <div
        style={{
          marginTop: '32px',
          paddingTop: '16px',
          borderTop: '1px dashed #e2e8f0',
          fontSize: '13px',
          color: '#64748b',
          fontWeight: 500,
          textAlign: 'center',
        }}
      >
        สร้างจาก Smart Family Finance
      </div>
    </div>
  );
}

function ReportSection({
  title,
  total,
  color,
}: {
  title: string;
  total: number;
  color: string;
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#475569',
          marginBottom: '4px',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: '32px',
          fontWeight: 800,
          color,
          lineHeight: 1,
          letterSpacing: '-0.5px',
        }}
      >
        {formatCurrencyExact(total)} บาท
      </div>
    </div>
  );
}

function ReportItemList({
  title,
  items,
  color,
}: {
  title: string;
  items: import('@/lib/report').ReportItem[];
  color: string;
}) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#475569',
          marginBottom: '10px',
        }}
      >
        {title}
      </div>
      <div>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: idx < items.length - 1 ? '1px dashed #f1f5f9' : 'none',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: '#64748b',
                fontWeight: 500,
                width: '96px',
                flexShrink: 0,
              }}
            >
              {item.dateDisplay}
            </div>
            <div
              style={{
                flex: 1,
                fontSize: '15px',
                fontWeight: 500,
                color: '#334155',
                marginLeft: '12px',
                marginRight: '12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ marginRight: '8px' }}>{item.icon}</span>
              {item.title}
            </div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color,
                flexShrink: 0,
              }}
            >
              {formatCurrencyShort(item.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PropertyGroupBlock({
  name,
  emoji,
  total,
  items,
}: {
  name: string;
  emoji: string;
  total: number;
  items: import('@/lib/report').ReportItem[];
}) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
          padding: '8px 12px',
          background: '#f8fafc',
          borderRadius: '8px',
        }}
      >
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
          {emoji} {name}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#e11d48' }}>
          {formatCurrencyExact(total)} บาท
        </div>
      </div>
      <div style={{ paddingLeft: '12px' }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 0',
              borderBottom:
                idx < items.length - 1 ? '1px dashed #f1f5f9' : 'none',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                color: '#64748b',
                fontWeight: 500,
                width: '96px',
                flexShrink: 0,
              }}
            >
              {item.dateDisplay}
            </div>
            <div
              style={{
                flex: 1,
                fontSize: '14px',
                fontWeight: 500,
                color: '#475569',
                marginLeft: '12px',
                marginRight: '12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ marginRight: '6px' }}>{item.icon}</span>
              {item.title}
            </div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#e11d48',
                flexShrink: 0,
              }}
            >
              {formatCurrencyShort(item.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Net Section — รายรับรวม - รายจ่ายรวม.
 * Positive => green, negative => rose, zero => slate.
 * Spec: header = "📊 ยอดสุทธิ", big number = "📊 สุทธิ  X,XXX.XX"
 */
function NetSection({ net }: { net: number }) {
  const isPositive = net > 0;
  const isNegative = net < 0;
  const color = isPositive ? '#059669' : isNegative ? '#e11d48' : '#0f172a';
  const prefix = isPositive ? '+' : isNegative ? '-' : '';
  const formatted = `${prefix}${formatCurrencyExact(Math.abs(net))}`;

  return (
    <div
      style={{
        marginBottom: '14px',
        padding: '16px 20px',
        background: isPositive
          ? '#ecfdf5'
          : isNegative
          ? '#fff1f2'
          : '#f8fafc',
        borderRadius: '12px',
        border: `2px solid ${isPositive ? '#a7f3d0' : isNegative ? '#fecdd3' : '#e2e8f0'}`,
      }}
    >
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#475569',
          marginBottom: '4px',
        }}
      >
        📊 ยอดสุทธิ
      </div>
      <div
        style={{
          fontSize: '36px',
          fontWeight: 800,
          color,
          lineHeight: 1,
          letterSpacing: '-0.5px',
        }}
      >
        📊 สุทธิ {formatted}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: '1px',
        background: '#e2e8f0',
        margin: '24px 0',
      }}
    />
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: '13px',
        color: '#94a3b8',
        fontStyle: 'italic',
        padding: '8px 0',
      }}
    >
      {text}
    </div>
  );
}
