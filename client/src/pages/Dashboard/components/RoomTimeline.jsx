// ตารางเวลาของทุกห้องในวันที่เลือก (ดูอย่างเดียว ไม่มีปุ่มจอง) แถว = ห้อง, คอลัมน์ = ช่วงเวลา เช้า/บ่าย/เย็น
// จองได้ทีละช่วงเต็ม ช่องหนึ่งจึงมีได้แค่ "ว่าง" หรือ "มีคนจอง" (หรือ "เลยเวลาแล้ว" สำหรับช่องว่างของวันนี้ที่เริ่มไปแล้ว)
import { SLOT_OPTIONS, formatTime, isSlotStarted } from '../../../utils/roomBooking.js';

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

// การจองที่อยู่ในช่วงนี้ของห้องนี้ เทียบเวลาแบบ "HH:MM" ตามเวลาไทย (สองหลักเสมอ เทียบแบบข้อความได้)
// ใช้เงื่อนไขทับกันแทนการเทียบเท่ากันเป๊ะ เผื่อข้อมูลเก่าที่เวลาไม่ตรงช่วงก็ยังโชว์ในช่องที่ทับ
function findBooking(bookings, roomId, slot) {
  return bookings.find(
    (booking) =>
      booking.room_id === roomId &&
      formatTime(booking.start_at) < slot.end &&
      formatTime(booking.end_at) > slot.start,
  );
}

// minDate/maxDate = ช่วงวันที่เลื่อนดูได้ (ตรงกับช่วงที่จองได้) loading/failed มาจาก query ใน RoomBooking.jsx
export default function RoomTimeline({
  rooms,
  bookings,
  date,
  minDate,
  maxDate,
  loading,
  failed,
  userId,
  onChangeDate,
}) {
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
          disabled={date >= maxDate}
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

      {loading ? (
        <p className="loading-message">กำลังโหลดตารางห้อง...</p>
      ) : failed ? (
        <p className="loading-message">โหลดตารางห้องไม่สำเร็จ</p>
      ) : rooms.length === 0 ? (
        <p className="loading-message">ยังไม่มีห้องในระบบ</p>
      ) : (
        <div className="room-timeline-scroll">
          <div className="room-timeline-grid">
            <div className="room-timeline-room" />
            {SLOT_OPTIONS.map((slot) => (
              <div className="room-timeline-slot-head" key={slot.value}>
                <strong>{slot.name}</strong>
                <span>
                  {slot.start}–{slot.end}
                </span>
              </div>
            ))}

            {rooms.map((room) => (
              <div className="room-timeline-row" key={room.room_id}>
                <div className="room-timeline-room">
                  {room.room_name}
                  {!room.is_active && ' (ปิดอยู่)'}
                </div>
                {SLOT_OPTIONS.map((slot) => {
                  const booking = findBooking(bookings, room.room_id, slot);

                  // ช่องว่างที่จองไม่ได้ (ห้องปิดอยู่ หรือช่วงของวันนี้ที่เริ่มไปแล้ว) เป็นสีเทา ไม่ขึ้นว่า "ว่าง" ให้เข้าใจผิด
                  if (!booking) {
                    const unavailable = !room.is_active
                      ? 'ปิดอยู่'
                      : isSlotStarted(date, slot.start)
                        ? 'เลยเวลาแล้ว'
                        : null;

                    return (
                      <div
                        className={`room-timeline-cell${unavailable ? ' past' : ''}`}
                        key={slot.value}
                      >
                        {unavailable ?? 'ว่าง'}
                      </div>
                    );
                  }

                  const mine = booking.user_id === userId;

                  return (
                    <div
                      className={`room-timeline-cell booked${mine ? ' mine' : ''}`}
                      key={slot.value}
                      title={`${booking.user_name}${booking.purpose ? ` · ${booking.purpose}` : ''}`}
                    >
                      {/* "ของฉัน" สั้นพอให้อยู่บรรทัดเดียวในช่องแคบบนมือถือ คำอธิบายสีด้านล่างเขียนเต็มว่า "การจองของฉัน" */}
                      <strong>{mine ? 'ของฉัน' : booking.user_name}</strong>
                      {booking.purpose && <small>{booking.purpose}</small>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="room-timeline-legend">
        <span><i className="legend-free" />ว่าง</span>
        <span><i className="legend-booked" />มีการจอง</span>
        <span><i className="legend-mine" />การจองของฉัน</span>
        <span><i className="legend-past" />จองไม่ได้ (เลยเวลา/ห้องปิด)</span>
      </div>
    </div>
  );
}
