// ภาพรวม Dashboard (เฉพาะ Admin) — เรียงจากสิ่งที่ต้องทำก่อน: การ์ดต้องดำเนินการ -> ตัวเลขสรุป
// -> แถบสถานะครุภัณฑ์ + กราฟยืมรายเดือน -> ตารางจองห้อง -> รายการเลยกำหนดคืน + กิจกรรมล่าสุด
// กราฟวาดเองด้วย SVG/CSS ธรรมดา ไม่ใช้ library เพิ่ม เพราะข้อมูลมีแค่ 12 เดือน/5 สถานะ ไม่คุ้มเพิ่ม dependency
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { getDashboardSummary } from '../../../api/dashboard.js';
import { getRoomBookings, getRooms } from '../../../api/rooms.js';
import { MAX_DAYS_AHEAD, addDays, todayDateInput } from '../../../utils/roomBooking.js';
import RoomTimeline from './RoomTimeline.jsx';

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
  room: { icon: '🏫', className: 'activity-icon-room' },
};

// "22 ต.ค. 2569 09:00–12:00" ตามเวลาไทย ไว้บอกว่าห้องถูกจองให้ใช้เมื่อไร (ต่างจาก occurred_at ที่เป็นเวลาที่กดจอง)
function formatBookingPeriod(startAt, endAt) {
  const time = { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' };
  const day = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' });
  const clock = new Intl.DateTimeFormat('th-TH', time);

  return `${day.format(new Date(startAt))} ${clock.format(new Date(startAt))}–${clock.format(new Date(endAt))}`;
}

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
    case 'room':
      return `${activity.actor_name} จอง ${activity.room_name} ${formatBookingPeriod(activity.start_at, activity.end_at)}`;
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
  // เดือนปัจจุบันเข้มกว่าเดือนอื่น ให้รู้ทันทีว่าตอนนี้อยู่ตรงไหนของปี
  const currentMonth = new Date().getMonth();

  return (
    <svg
      viewBox={`0 0 ${width} ${height + 26}`}
      role="img"
      aria-label="กราฟจำนวนการยืมรายเดือน"
      style={{ width: '100%', height: 'auto' }}
    >
      {[0.5, 1].map((fraction) => (
        <line
          key={fraction}
          x1="0"
          x2={width}
          y1={height - fraction * height}
          y2={height - fraction * height}
          stroke="#efe3e8"
          strokeDasharray="4 4"
        />
      ))}
      <line x1="0" x2={width} y1={height} y2={height} stroke="#ead9df" />

      {data.map((value, index) => {
        const barHeight = (value / max) * height;
        const x = index * slot + 5;
        const y = height - barHeight;
        const isCurrent = index === currentMonth;

        return (
          <g key={monthLabels[index]}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, value > 0 ? 2 : 0)}
              fill={isCurrent ? 'var(--stat-pink)' : 'var(--stat-pink-soft)'}
              opacity={isCurrent ? 1 : 0.55}
              rx="4"
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
              fontWeight={isCurrent ? 700 : 400}
              fill={isCurrent ? '#b43b6b' : '#637f84'}
            >
              {monthLabels[index]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// แถบสัดส่วนสถานะเส้นเดียว + รายการเรียงใต้แถบ อ่านตัวเลขได้ตรงกว่ากราฟวงกลม และไม่กินที่แนวตั้ง
function StatusBar({ statusCounts }) {
  const segments = statusMeta
    .map((meta) => ({ ...meta, value: statusCounts[meta.key] ?? 0 }))
    .filter((segment) => segment.value > 0);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total === 0) {
    return <p className="loading-message">ยังไม่มีข้อมูลครุภัณฑ์</p>;
  }

  return (
    <div>
      <div
        className="status-bar"
        role="img"
        aria-label="สัดส่วนสถานะครุภัณฑ์"
      >
        {segments.map((segment) => (
          <span
            key={segment.key}
            className="status-bar-segment"
            style={{ flexGrow: segment.value, background: segment.color }}
            title={`${segment.label} ${segment.value}`}
          />
        ))}
      </div>

      <ul className="status-list">
        {segments.map((segment) => (
          <li key={segment.key}>
            <span
              className="status-list-swatch"
              style={{ background: segment.color }}
            />
            <span className="status-list-label">{segment.label}</span>
            <strong>{segment.value}</strong>
            <span className="status-list-percent">
              {Math.round((segment.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AttentionCard({ to, value, label, tone }) {
  // tone: 'warn' = มีงานค้างที่ต้องตอบ, 'danger' = เลยกำหนด; ค่าเป็น 0 เทาเสมอ (ไม่มีอะไรต้องทำ)
  const active = value > 0;

  return (
    <Link
      to={to}
      className={`attention-card${active ? ` attention-card-${tone}` : ''}`}
    >
      <span className="attention-card-text">
        <span className="attention-card-value">{value}</span>
        <span className="attention-card-label">{label}</span>
      </span>
      <span className="attention-card-arrow" aria-hidden="true">›</span>
    </Link>
  );
}

function OverdueRow({ code, title, who, dueDate }) {
  return (
    <li className="overdue-item">
      <div className="overdue-main">
        <span className="equipment-code">{code}</span>
        <span className="overdue-title">{title}</span>
      </div>
      <div className="overdue-meta">
        <span>{who}</span>
        <span className="overdue-due">กำหนด {formatDate(dueDate)}</span>
      </div>
    </li>
  );
}

export default function DashboardOverview({ user }) {
  const today = todayDateInput();
  const [roomDate, setRoomDate] = useState(today);

  // queryKey เดียวกับหน้าจองห้อง (RoomBooking.jsx) จึงแชร์ cache กัน และจองใหม่แล้วตารางนี้ก็รีเฟรชตาม
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: getRooms });
  const bookingsQuery = useQuery({
    queryKey: ['room-bookings', roomDate],
    queryFn: () => getRoomBookings(roomDate),
  });
  const roomLoadError = roomsQuery.error?.message || bookingsQuery.error?.message;

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: getDashboardSummary,
  });

  const summary = summaryQuery.data;

  const todayLabel = new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'full',
    timeZone: 'Asia/Bangkok',
  }).format(new Date());

  return (
    <section className="equipment-section overview-page">
      <div className="section-heading equipment-toolbar">
        <div>
          <p className="section-kicker">Overview</p>
          <h2>ภาพรวมระบบ</h2>
        </div>
        <p className="overview-date">{todayLabel}</p>
      </div>

      {summaryQuery.error && (
        <p className="error-message">{summaryQuery.error.message}</p>
      )}

      {summaryQuery.isLoading ? (
        <p className="loading-message">กำลังโหลดข้อมูลภาพรวม...</p>
      ) : summary ? (
        <>
          <h3 className="overview-label">ต้องดำเนินการ</h3>
          <div className="attention-grid">
            <AttentionCard
              to="/?tab=borrow"
              value={summary.pendingBorrowCount}
              label="คำขอยืมรออนุมัติ"
              tone="warn"
            />
            <AttentionCard
              to="/?tab=repair"
              value={summary.pendingRepairCount}
              label="ครุภัณฑ์รอซ่อม"
              tone="warn"
            />
            <AttentionCard
              to="/?tab=borrow"
              value={summary.overdueCount}
              label="ครุภัณฑ์เลยกำหนดคืน"
              tone="danger"
            />
            <AttentionCard
              to="/?tab=materials&view=withdrawals&outstanding=1"
              value={summary.overdueMaterialCount}
              label="วัสดุเลยกำหนดคืน"
              tone="danger"
            />
          </div>

          <h3 className="overview-label">สรุปคลัง</h3>
          <div className="stat-cards">
            <div className="stat-card stat-card-total">
              <span className="stat-card-label">ครุภัณฑ์ทั้งหมด</span>
              <span className="stat-card-value">{summary.totalEquipment}</span>
            </div>
            <div className="stat-card stat-card-available">
              <span className="stat-card-label">พร้อมใช้งาน</span>
              <span className="stat-card-value">
                {summary.statusCounts.available}
              </span>
            </div>
            <div className="stat-card stat-card-borrowed">
              <span className="stat-card-label">ถูกยืมอยู่</span>
              <span className="stat-card-value">
                {summary.statusCounts.borrowed}
              </span>
            </div>
            <div className="stat-card stat-card-users">
              <span className="stat-card-label">ผู้ใช้งานทั้งหมด</span>
              <span className="stat-card-value">{summary.userCount}</span>
            </div>
          </div>

          <div className="overview-grid overview-grid-wide">
            <div className="overview-panel">
              <h3>จำนวนการยืมรายเดือน</h3>
              <MonthlyBarChart data={summary.monthlyBorrows} />
            </div>

            <div className="overview-panel">
              <h3>สถานะครุภัณฑ์</h3>
              <StatusBar statusCounts={summary.statusCounts} />
            </div>
          </div>

          <div className="overview-panel overview-panel-spaced">
            <div className="overview-panel-heading">
              <h3>ตารางการใช้ห้อง</h3>
              <Link to="/?tab=room">จองห้อง ›</Link>
            </div>
            <RoomTimeline
              rooms={roomsQuery.data?.rooms ?? []}
              bookings={bookingsQuery.data?.bookings ?? []}
              date={roomDate}
              minDate={today}
              maxDate={addDays(today, MAX_DAYS_AHEAD)}
              loading={roomsQuery.isLoading || bookingsQuery.isLoading}
              failed={Boolean(roomLoadError)}
              userId={user.user_id}
              selection={null}
              onChangeDate={setRoomDate}
            />
          </div>

          <div className="overview-grid">
            <div className="overview-panel">
              <h3>รายการเลยกำหนดคืน</h3>
              {summary.overdueBorrows.length === 0 && summary.overdueMaterials.length === 0 ? (
                <div className="empty-state overdue-empty">
                  <p>✅ ไม่มีรายการเลยกำหนดคืนตอนนี้</p>
                </div>
              ) : (
                <>
                  {summary.overdueBorrows.length > 0 && (
                    <>
                      <p className="overdue-group">ครุภัณฑ์</p>
                      <ul className="overdue-list">
                        {summary.overdueBorrows.map((item) => (
                          <OverdueRow
                            key={item.borrow_detail_id}
                            code={item.equipment_code}
                            title={item.equipment_name}
                            who={item.borrower_name}
                            dueDate={item.return_date}
                          />
                        ))}
                      </ul>
                      {summary.overdueCount > summary.overdueBorrows.length && (
                        <p className="overdue-more">
                          และอีก {summary.overdueCount - summary.overdueBorrows.length}{' '}
                          รายการ — <Link to="/?tab=borrow">ดูทั้งหมด</Link>
                        </p>
                      )}
                    </>
                  )}

                  {summary.overdueMaterials.length > 0 && (
                    <>
                      <p className="overdue-group">วัสดุ</p>
                      <ul className="overdue-list">
                        {summary.overdueMaterials.map((item) => (
                          <OverdueRow
                            key={item.withdrawal_id}
                            code={item.material_code}
                            title={`${item.material_name} (${item.outstanding_quantity} ${item.unit_name})`}
                            who={item.borrower_name}
                            dueDate={item.due_date}
                          />
                        ))}
                      </ul>
                      {summary.overdueMaterialCount > summary.overdueMaterials.length && (
                        <p className="overdue-more">
                          และอีก {summary.overdueMaterialCount - summary.overdueMaterials.length}{' '}
                          รายการ —{' '}
                          <Link to="/?tab=materials&view=withdrawals&outstanding=1">
                            ดูทั้งหมด
                          </Link>
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
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
          </div>
        </>
      ) : null}
    </section>
  );
}
