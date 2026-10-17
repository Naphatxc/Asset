// ตารางเวลาของทุกห้องในวันที่เลือก (ดูอย่างเดียว ไม่มีปุ่มจอง) แถว = ห้อง, คอลัมน์ = ชั่วโมง
// ช่วงที่มีคนจองเป็นแถบสีทาบบนช่องว่าง วางตำแหน่งด้วยเปอร์เซ็นต์ของเวลา 08:00–20:00
const OPEN_HOUR = 8; // ต้องตรงกับ OPEN_TIME/CLOSE_TIME ใน server (room.validator.js)
const CLOSE_HOUR = 20;
const TOTAL_MINUTES = (CLOSE_HOUR - OPEN_HOUR) * 60;
const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, index) => OPEN_HOUR + index);

// เวลาจาก server เป็น UTC -> จำนวนนาทีนับจาก 08:00 ตามเวลาไทย (UTC+7)
function minutesFromOpen(value) {
  const bangkok = new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000);
  return bangkok.getUTCHours() * 60 + bangkok.getUTCMinutes() - OPEN_HOUR * 60;
}

function formatClock(value) {
  const minutes = minutesFromOpen(value) + OPEN_HOUR * 60;
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// "2026-10-18" + 1 วัน -> "2026-10-19" (คำนวณแบบ UTC กันวันเพี้ยนตามเขตเวลาของเครื่อง)
function shiftDate(date, days) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function formatThaiDate(date) {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default function RoomTimeline({ rooms, bookings, date, minDate, userId, onChangeDate }) {
  const isToday = date === minDate;

  return (
    <div className="room-timeline">
      <div className="room-timeline-toolbar">
        <button
          className="button-secondary"
          type="button"
          disabled={date <= minDate}
          onClick={() => onChangeDate(shiftDate(date, -1))}
          aria-label="วันก่อนหน้า"
        >
          ‹
        </button>
        <button
          className="button-secondary"
          type="button"
          onClick={() => onChangeDate(shiftDate(date, 1))}
          aria-label="วันถัดไป"
        >
          ›
        </button>
        <button
          className="button-secondary"
          type="button"
          disabled={isToday}
          onClick={() => onChangeDate(minDate)}
        >
          วันนี้
        </button>
        <strong className="room-timeline-date">
          {formatThaiDate(date)}
          {isToday && ' (วันนี้)'}
        </strong>
      </div>

      {rooms.length === 0 ? (
        <p className="loading-message">ยังไม่มีห้องที่เปิดให้จอง</p>
      ) : (
        <div className="room-timeline-scroll">
          <div className="room-timeline-grid">
            <div className="room-timeline-row">
              <div />
              <div className="room-timeline-hours">
                {HOURS.map((hour) => (
                  <span key={hour}>{String(hour).padStart(2, '0')}:00</span>
                ))}
              </div>
            </div>

            {rooms.map((room) => (
              <div className="room-timeline-row" key={room.room_id}>
                <div className="room-timeline-room">{room.room_name}</div>
                <div className="room-timeline-track">
                  {bookings
                    .filter((booking) => booking.room_id === room.room_id)
                    .map((booking) => {
                      const start = minutesFromOpen(booking.start_at);
                      const end = minutesFromOpen(booking.end_at);

                      return (
                        <div
                          key={booking.booking_id}
                          className={`room-timeline-booking${booking.user_id === userId ? ' mine' : ''}`}
                          style={{
                            left: `${(start / TOTAL_MINUTES) * 100}%`,
                            width: `${((end - start) / TOTAL_MINUTES) * 100}%`,
                          }}
                          title={`${formatClock(booking.start_at)}–${formatClock(booking.end_at)} · ${booking.user_name}${booking.purpose ? ` · ${booking.purpose}` : ''}`}
                        >
                          {booking.purpose || booking.user_name}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="room-timeline-legend">
        <span><i className="legend-free" />ว่าง</span>
        <span><i className="legend-booked" />มีการจอง</span>
        <span><i className="legend-mine" />การจองของฉัน</span>
      </div>
    </div>
  );
}
