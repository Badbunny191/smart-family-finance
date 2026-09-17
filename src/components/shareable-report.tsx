import type { Report } from '@/lib/report';
import { formatCurrencyShort } from '@/lib/report';

type ShareableReportProps = {
  report: Report;
};

export function ShareableReport({ report }: ShareableReportProps) {
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
      {report.income.items.length === 0 && (
        <EmptyLine text="ไม่มีรายรับในช่วงนี้" />
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
            emoji={
              group.propertyName === 'บ้าน' ? '🏠'
              : group.propertyName === 'คอนโด' ? '🏢'
              : '📍'
            }
            total={group.total}
            items={group.items}
          />
        ))
      ) : (
        <EmptyLine text="ไม่มีรายจ่ายในช่วงนี้" />
      )}

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
        {formatCurrencyShort(total)} บาท
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
              {item.date}
            </div>
            <div
              style={{
                flex: 1,
                fontSize: '15px',
                fontWeight: 500,
                color: '#334155',
                marginLeft: '12px',
                marginRight: '12px',
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
          {formatCurrencyShort(total)} บาท
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
              {item.date}
            </div>
            <div
              style={{
                flex: 1,
                fontSize: '14px',
                fontWeight: 500,
                color: '#475569',
                marginLeft: '12px',
                marginRight: '12px',
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
