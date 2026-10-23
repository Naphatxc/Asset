// ตารางเวลาของทุกห้องในวันที่เลือก (ดูภาพรวมอย่างเดียว) แถว = ห้อง, คอลัมน์ = ชั่วโมง 09:00–19:00
// ช่องหนึ่งคือ 1 ชั่วโมง มีได้ "ว่าง" "มีคนจอง" หรือ "เลยเวลา/ห้องปิด" ส่วนการเลือกเวลาจองทำที่ปุ่มชั่วโมงในฟอร์ม (RoomBooking.jsx)
import { HOURS, findBookingAt, hourLabel, isHourStarted } from '../../../utils/roomBooking.js';

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

// minDate/maxDate = ช่วงวันที่เลื่อนดูได้ (ตรงกับช่วงที่จองได้) loading/failed มาจาก query ใน RoomBooking.jsx
// selection = { roomId, startHour, endHour } ช่วงที่กำลังเลือกในฟอร์ม ไฮไลต์ให้เห็นในตาราง
export default function RoomTimeline({
  rooms,
  bookings,
  date,
  minDate,
  maxDate,
  loading,
  failed,
  userId,
  selection,
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
            {HOURS.map((hour) => (
              <div className="room-timeline-slot-head" key={hour}>
                <strong>{hourLabel(hour)}</strong>
              </div>
            ))}

            {rooms.map((room) => (
              <div className="room-timeline-row" key={room.room_id}>
                <div className="room-timeline-room">
                  {room.room_name}
                  {!room.is_active && ' (ปิดอยู่)'}
                </div>
                {HOURS.map((hour) => {
                  const booking = findBookingAt(bookings, room.room_id, hour);

                  // ช่องว่างที่จองไม่ได้ (ห้องปิดอยู่ หรือชั่วโมงของวันนี้ที่เริ่มไปแล้ว) เป็นสีเทา ไม่ขึ้นว่า "ว่าง" ให้เข้าใจผิด
                  if (!booking) {
                    const unavailable = !room.is_active || isHourStarted(date, hour);
                    const selected =
                      selection?.roomId === room.room_id &&
                      hour >= selection.startHour &&
                      hour < selection.endHour;

                    if (unavailable) {
                      return (
                        <div
                          className="room-timeline-cell past"
                          key={hour}
                          title={room.is_active ? 'เลยเวลาแล้ว' : 'ห้องปิดอยู่'}
                        />
                      );
                    }

                    return (
                      <div
                        className={`room-timeline-cell free${selected ? ' selected' : ''}`}
                        key={hour}
                        title={`${room.room_name} ${hourLabel(hour)}–${hourLabel(hour + 1)} ว่าง`}
                      />
                    );
                  }

                  const mine = booking.user_id === userId;
                  // การจองหลายชั่วโมงติดกัน เขียนชื่อแค่ช่องแรกของการจอง ช่องที่เหลือเป็นสีเดียวกันเฉยๆ
                  const previous = findBookingAt(bookings, room.room_id, hour - 1);
                  const isFirstCell = previous?.booking_id !== booking.booking_id;

                  return (
                    <div
                      className={`room-timeline-cell booked${mine ? ' mine' : ''}`}
                      key={hour}
                      title={`${booking.user_name}${booking.purpose ? ` · ${booking.purpose}` : ''}`}
                    >
                      {/* "ของฉัน" สั้นพอให้อยู่ในช่องแคบ คำอธิบายสีด้านล่างเขียนเต็มว่า "การจองของฉัน" */}
                      {isFirstCell && <strong>{mine ? 'ของฉัน' : booking.user_name}</strong>}
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
        <span><i className="legend-selected" />ช่วงที่เลือก</span>
        <span><i className="legend-booked" />มีการจอง</span>
        <span><i className="legend-mine" />การจองของฉัน</span>
        <span><i className="legend-past" />จองไม่ได้ (เลยเวลา/ห้องปิด)</span>
      </div>
    </div>
  );
}
