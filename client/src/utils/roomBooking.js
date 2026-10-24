// ค่าคงที่และตัวจัดรูปแบบเวลาที่หน้าจองห้อง (RoomBooking.jsx) ตารางเวลา (RoomTimeline.jsx) และการจองของฉัน (MyRoomBookings.jsx) ใช้ร่วมกัน

// จองได้ 09:00–19:00 ทีละชั่วโมงเต็ม ต้องตรงกับ OPEN_HOUR/CLOSE_HOUR ใน server (room.validator.js)
export const OPEN_HOUR = 9;
export const CLOSE_HOUR = 19;

// ชั่วโมงเริ่มที่จองได้ 9..18 (ชั่วโมงสุดท้าย 18:00–19:00)
export const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, index) => OPEN_HOUR + index);

// 9 -> "09:00" (รูปแบบเดียวกับที่ส่งให้ server)
export function hourLabel(hour) {
  return `${String(hour).padStart(2, '0')}:00`;
}

// ชั่วโมงนี้ของวันนั้นเริ่มไปแล้วหรือยัง (เวลาไทย) server ไม่รับจองช่วงที่เริ่มไปแล้ว
// ฟอร์มใช้ปิดตัวเลือก ตารางเวลาใช้ทำช่องที่เลยเวลาเป็นสีเทา
export function isHourStarted(date, hour) {
  return new Date(`${date}T${hourLabel(hour)}:00.000+07:00`) <= new Date();
}

// เวลาจาก server เป็น UTC เช่น "2026-10-18T03:00:00.000Z" -> "10:00" ตามเวลาไทย
export function formatTime(value) {
  return new Date(value).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

// "22 ต.ค. 2569" ตามเวลาไทย
export function formatDate(value) {
  return new Date(value).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
}

// "10:00–13:00 น." ตามเวลาไทย (การจองเก่าแบบเช้า/บ่าย/เย็นก็แสดงเป็นเวลาตรงๆ แบบเดียวกัน)
export function formatSlot(startAt, endAt) {
  return `${formatTime(startAt)}–${formatTime(endAt)} น.`;
}

// เวลาของ server (UTC) -> จำนวนนาทีนับจาก 00:00 ตามเวลาไทย ไว้เทียบทับกับชั่วโมงในตาราง
function bangkokMinutes(value) {
  const date = new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

// การจองของห้องนี้ที่ทับชั่วโมง hour (hour..hour+1) ใช้เงื่อนไขทับกันแทนการเทียบเท่ากันเป๊ะ
// เพื่อให้การจองเก่าที่เวลาไม่ตรงชั่วโมงเต็มก็ยังโชว์ในช่องที่ทับ
export function findBookingAt(bookings, roomId, hour) {
  return bookings.find(
    (booking) =>
      booking.room_id === roomId &&
      bangkokMinutes(booking.start_at) < (hour + 1) * 60 &&
      bangkokMinutes(booking.end_at) > hour * 60,
  );
}

// จองล่วงหน้าได้ไม่เกิน 30 วัน (ต้องตรงกับ server: room.validator.js)
export const MAX_DAYS_AHEAD = 30;

// วันนี้แบบ YYYY-MM-DD (ใช้เป็นค่าเริ่มต้นและวันแรกที่เลือกได้ในช่องวันที่)
export function todayDateInput() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

// "2026-10-21" + 30 วัน -> "2026-11-20" (คำนวณแบบ UTC กันวันเพี้ยนตามเขตเวลาของเครื่อง)
export function addDays(date, days) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
