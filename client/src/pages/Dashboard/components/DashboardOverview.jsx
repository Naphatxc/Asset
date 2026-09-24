// ภาพรวม Dashboard (เฉพาะ Admin) — stat card + การ์ดสิ่งที่ต้องดำเนินการ + กราฟแท่งรายเดือน + กราฟวงกลมสถานะ
// + รายการเลยกำหนดคืน + กิจกรรมล่าสุด
// กราฟวาดเองด้วย SVG ธรรมดา ไม่ใช้ library เพิ่ม เพราะข้อมูลมีแค่ 12 เดือน/4 สถานะ ไม่คุ้มเพิ่ม dependency
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { getDashboardSummary } from '../../../api/dashboard.js';

const monthLabels = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

function formatDateTime(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

// due_date ของวัสดุเป็นวันล้วน (เที่ยงคืน UTC) แสดงเวลาจะกลายเป็น 07:00 ที่ไม่มีความหมาย
function formatDate(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(value));
}

// ข้อความ/ไอคอนของกิจกรรมแต่ละประเภท แยกจาก field ดิบที่ backend ส่งมา (ดู dashboard.service.js
// buildRecentActivity) เพื่อให้แก้ข้อความฝั่งนี้ได้โดยไม่ต้องแตะ backend
const activityMeta = {
  borrow: { icon: '📤', className: 'activity-icon-borrow' },
  return: { icon: '📥', className: 'activity-icon-return' },
  repair: { icon: '🔧', className: 'activity-icon-repair' },
};

function formatActivityText(activity) {
  switch (activity.type) {
    case 'borrow':
      return `${activity.actor_name} ยืม ${activity.equipment_name}${
        activity.item_count > 1 ? ` และอีก ${activity.item_count - 1} ชิ้น` : ''
      }`;
    case 'return':
      return `${activity.actor_name} คืน ${activity.equipment_name}`;
    case 'repair':
      return `${activity.actor_name} แจ้งซ่อม ${activity.equipment_name}`;
    default:
      return '';
  }
}

const statusMeta = [
  { key: 'available', label: 'พร้อมใช้งาน', color: '#22a06b' },
  { key: 'borrowed', label: 'ถูกยืม', color: '#ffbf02' },
  { key: 'pending_repair', label: 'รอซ่อม', color: '#e2574c' },
  { key: 'repairing', label: 'กำลังซ่อม', color: '#3b82c4' },
  { key: 'damaged', label: 'ชำรุด', color: '#7c5cbf' },
];

function MonthlyBarChart({ data }) {
  const width = 760;
  const height = 200;
  const max = Math.max(1, ...data);
  const slot = width / data.length;
  const barWidth = slot - 10;

  return (
    <svg
      viewBox={`0 0 ${width} ${height + 26}`}
      role="img"
      aria-label="กราฟจำนวนการยืมรายเดือน"
      style={{ width: '100%', height: 'auto' }}
    >
      {data.map((value, index) => {
        const barHeight = (value / max) * height;
        const x = index * slot + 5;
        const y = height - barHeight;

        return (
          <g key={monthLabels[index]}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, value > 0 ? 2 : 0)}
              fill="var(--stat-pink)"
              rx="3"
            />
            {value > 0 && (
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="11"
                fill="#637f84"
              >
                {value}
              </text>
            )}
            <text
              x={x + barWidth / 2}
              y={height + 18}
              textAnchor="middle"
              fontSize="11"
              fill="#637f84"
            >
              {monthLabels[index]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function StatusPieChart({ statusCounts }) {
  const size = 180;
  const outerRadius = 80;
  const pathRadius = outerRadius / 2;
  const circumference = 2 * Math.PI * pathRadius;
  const segments = statusMeta
    .map((meta) => ({ ...meta, value: statusCounts[meta.key] ?? 0 }))
    .filter((segment) => segment.value > 0);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total === 0) {
    return <p className="loading-message">ยังไม่มีข้อมูลครุภัณฑ์</p>;
  }

  let cumulative = 0;

  return (
    <div className="pie-chart-wrap">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="สัดส่วนสถานะครุภัณฑ์"
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((segment) => {
            const fraction = segment.value / total;
            const dash = fraction * circumference;
            const element = (
              <circle
                key={segment.key}
                cx={size / 2}
                cy={size / 2}
                r={pathRadius}
                fill="none"
                stroke={segment.color}
                strokeWidth={outerRadius}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-cumulative}
              />
            );

            cumulative += dash;
            return element;
          })}
        </g>
      </svg>

      <ul className="pie-legend">
        {segments.map((segment) => (
          <li key={segment.key}>
            <span
              className="pie-legend-swatch"
              style={{ background: segment.color }}
            />
            {segment.label} ({segment.value})
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardOverview() {
  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: getDashboardSummary,
  });

  const summary = summaryQuery.data;

  return (
    <section className="equipment-section">
      <div className="section-heading equipment-toolbar">
        <div>
          <p className="section-kicker">Overview</p>
          <h2>ภาพรวมระบบ</h2>
        </div>
      </div>

      {summaryQuery.error && (
        <p className="error-message">{summaryQuery.error.message}</p>
      )}

      {summaryQuery.isLoading ? (
        <p className="loading-message">กำลังโหลดข้อมูลภาพรวม...</p>
      ) : summary ? (
        <>
          <div className="stat-cards">
            <div className="stat-card stat-card-total">
              <span className="stat-card-value">{summary.totalEquipment}</span>
              <span className="stat-card-label">ครุภัณฑ์ทั้งหมด</span>
            </div>
            <div className="stat-card stat-card-available">
              <span className="stat-card-value">
                {summary.statusCounts.available}
              </span>
              <span className="stat-card-label">พร้อมใช้งาน</span>
            </div>
            <div className="stat-card stat-card-borrowed">
              <span className="stat-card-value">
                {summary.statusCounts.borrowed}
              </span>
              <span className="stat-card-label">ถูกยืมอยู่</span>
            </div>
            <div className="stat-card stat-card-users">
              <span className="stat-card-value">{summary.userCount}</span>
              <span className="stat-card-label">ผู้ใช้งานทั้งหมด</span>
            </div>
          </div>

          <div className="attention-grid">
            <Link
              to="/?tab=borrow"
              className={`attention-card${
                summary.pendingBorrowCount > 0 ? ' attention-card-active' : ''
              }`}
            >
              <span className="attention-card-value">
                {summary.pendingBorrowCount}
              </span>
              <span className="attention-card-label">คำขอยืมรออนุมัติ</span>
            </Link>
            <Link
              to="/?tab=repair"
              className={`attention-card${
                summary.pendingRepairCount > 0 ? ' attention-card-active' : ''
              }`}
            >
              <span className="attention-card-value">
                {summary.pendingRepairCount}
              </span>
              <span className="attention-card-label">ครุภัณฑ์รอซ่อม</span>
            </Link>
            <Link
              to="/?tab=borrow"
              className={`attention-card${
                summary.overdueCount > 0 ? ' attention-card-overdue' : ''
              }`}
            >
              <span className="attention-card-value">{summary.overdueCount}</span>
              <span className="attention-card-label">เลยกำหนดคืน</span>
            </Link>
            <Link
              to="/?tab=materials&view=withdrawals&outstanding=1"
              className={`attention-card${
                summary.overdueMaterialCount > 0 ? ' attention-card-overdue' : ''
              }`}
            >
              <span className="attention-card-value">{summary.overdueMaterialCount}</span>
              <span className="attention-card-label">วัสดุเลยกำหนดคืน</span>
            </Link>
          </div>

          <div className="overview-panel">
            <h3>รายการเลยกำหนดคืน</h3>
            {summary.overdueBorrows.length === 0 && summary.overdueMaterials.length === 0 && (
              <div className="empty-state">
                <p>ไม่มีรายการเลยกำหนดคืนตอนนี้</p>
              </div>
            )}

            {summary.overdueBorrows.length > 0 && (
              <div className="table-wrap">
                <table className="user-table responsive-table">
                  <thead>
                    <tr>
                      <th>ครุภัณฑ์</th>
                      <th>ผู้ยืม</th>
                      <th>ครบกำหนดคืน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.overdueBorrows.map((item) => (
                      <tr key={item.borrow_detail_id}>
                        <td data-label="ครุภัณฑ์">
                          <span className="equipment-code">
                            {item.equipment_code}
                          </span>{' '}
                          {item.equipment_name}
                        </td>
                        <td data-label="ผู้ยืม">{item.borrower_name}</td>
                        <td data-label="ครบกำหนดคืน">{formatDateTime(item.return_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {summary.overdueCount > summary.overdueBorrows.length && (
                  <p className="loading-message">
                    และอีก {summary.overdueCount - summary.overdueBorrows.length}{' '}
                    รายการ —{' '}
                    <Link to="/?tab=borrow">ดูทั้งหมดที่หน้ายืม-คืน</Link>
                  </p>
                )}
              </div>
            )}

            {summary.overdueMaterials.length > 0 && (
              <div className="table-wrap">
                <table className="user-table responsive-table">
                  <thead>
                    <tr>
                      <th>วัสดุ</th>
                      <th>ผู้เบิก</th>
                      <th>ครบกำหนดคืน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.overdueMaterials.map((item) => (
                      <tr key={item.withdrawal_id}>
                        <td data-label="วัสดุ">
                          <span className="equipment-code">{item.material_code}</span>{' '}
                          {item.material_name} ({item.outstanding_quantity} {item.unit_name})
                        </td>
                        <td data-label="ผู้เบิก">{item.borrower_name}</td>
                        <td data-label="ครบกำหนดคืน">{formatDate(item.due_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {summary.overdueMaterialCount > summary.overdueMaterials.length && (
                  <p className="loading-message">
                    และอีก {summary.overdueMaterialCount - summary.overdueMaterials.length}{' '}
                    รายการ —{' '}
                    <Link to="/?tab=materials&view=withdrawals&outstanding=1">
                      ดูทั้งหมดที่หน้าวัสดุ
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="overview-grid">
            <div className="overview-panel">
              <h3>จำนวนการยืมรายเดือน</h3>
              <MonthlyBarChart data={summary.monthlyBorrows} />
            </div>

            <div className="overview-panel">
              <h3>สัดส่วนสถานะครุภัณฑ์</h3>
              <StatusPieChart statusCounts={summary.statusCounts} />
            </div>
          </div>

          <div className="overview-panel">
            <h3>กิจกรรมล่าสุด</h3>
            {summary.recentActivity.length === 0 ? (
              <div className="empty-state">
                <p>ยังไม่มีกิจกรรม</p>
              </div>
            ) : (
              <ul className="activity-list">
                {summary.recentActivity.map((activity, index) => (
                  <li key={index} className="activity-item">
                    <span
                      className={`activity-icon ${activityMeta[activity.type].className}`}
                      aria-hidden="true"
                    >
                      {activityMeta[activity.type].icon}
                    </span>
                    <div className="activity-body">
                      <p className="activity-text">
                        {formatActivityText(activity)}
                      </p>
                      <span className="activity-time">
                        {formatDateTime(activity.occurred_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
