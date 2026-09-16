// ภาพรวม Dashboard (เฉพาะ Admin) — stat card + กราฟแท่งรายเดือน + กราฟวงกลมสถานะ + ตารางครุภัณฑ์ยอดนิยม
// กราฟวาดเองด้วย SVG ธรรมดา ไม่ใช้ library เพิ่ม เพราะข้อมูลมีแค่ 12 เดือน/4 สถานะ ไม่คุ้มเพิ่ม dependency
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { getDashboardSummary } from '../../../api/dashboard.js';

const monthLabels = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

const statusMeta = [
  { key: 'available', label: 'พร้อมใช้งาน', color: '#22a06b' },
  { key: 'borrowed', label: 'ถูกยืม', color: '#ffbf02' },
  { key: 'pending_repair', label: 'รอซ่อม', color: '#e2574c' },
  { key: 'repairing', label: 'กำลังซ่อม', color: '#3b82c4' },
];

// ปีปัจจุบัน + ย้อนหลัง 2 ปี ให้เลือก แสดงเป็น พ.ศ. ตามธรรมเนียมเว็บนี้ แต่ค่าที่ส่ง API เป็น ค.ศ.
function buildYearOptions() {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2];
}

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
  const [year, setYear] = useState(() => new Date().getFullYear());

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary', year],
    queryFn: () => getDashboardSummary(year),
  });

  const summary = summaryQuery.data;
  const yearOptions = buildYearOptions();

  return (
    <section className="equipment-section">
      <div className="section-heading equipment-toolbar">
        <div>
          <p className="section-kicker">Overview</p>
          <h2>ภาพรวมระบบ</h2>
        </div>

        <div className="toolbar-actions">
          <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {yearOptions.map((option) => (
              <option key={option} value={option}>
                ปี {option + 543}
              </option>
            ))}
          </select>
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
            <h3>ครุภัณฑ์ที่ถูกยืมบ่อยที่สุด</h3>
            {summary.topBorrowedItems.length === 0 ? (
              <div className="empty-state">
                <p>ยังไม่มีประวัติการยืมที่อนุมัติแล้ว</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="user-table">
                  <thead>
                    <tr>
                      <th>อันดับ</th>
                      <th>รหัสครุภัณฑ์</th>
                      <th>ชื่อครุภัณฑ์</th>
                      <th>จำนวนครั้งที่ถูกยืม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topBorrowedItems.map((item, index) => (
                      <tr key={item.item_id}>
                        <td>{index + 1}</td>
                        <td className="equipment-code">{item.equipment_code}</td>
                        <td>{item.equipment_name}</td>
                        <td>{item.borrow_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
