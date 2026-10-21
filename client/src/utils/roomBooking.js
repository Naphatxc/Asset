// ค่าคงที่และตัวจัดรูปแบบเวลาที่หน้าจองห้อง (RoomBooking.jsx) กับการจองของฉัน (MyRoomBookings.jsx) ใช้ร่วมกัน

// ช่วงเวลาที่จองได้ value/start/end ต้องตรงกับ SLOTS ใน server (room.validator.js)
// name = ชื่อสั้นไว้เป็นหัวคอลัมน์ในตารางเวลา, label = ชื่อเต็มในดรอปดาวน์/รายการ
export const SLOT_OPTIONS = [
  { value: 'morning', name: 'ช่วงเช้า', start: '09:00', end: '12:00', label: 'ช่วงเช้า 09:00–12:00 น.' },
  { value: 'afternoon', name: 'ช่วงบ่าย', start: '13:00', end: '16:00', label: 'ช่วงบ่าย 13:00–16:00 น.' },
  { value: 'evening', name: 'ช่วงเย็น', start: '16:00', end: '18:00', label: 'ช่วงเย็น 16:00–18:00 น.' },
];

// ช่วงนี้ของวันนั้นเริ่มไปแล้วหรือยัง (เวลาไทย) server ไม่รับจองช่วงที่เริ่มไปแล้ว
// ฟอร์มใช้ปิดตัวเลือก ตารางเวลาใช้ทำช่องว่างที่เลยเวลาเป็นสีเทา
export function isSlotStarted(date, start) {
  return new Date(`${date}T${start}:00.000+07:00`) <= new Date();
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

// ชื่อช่วงของการจอง เช่น "ช่วงเช้า 09:00–12:00 น." ถ้าเวลาไม่ตรงช่วงไหน (ข้อมูลเก่า) แสดงเวลาตรงๆ แทน
export function formatSlot(startAt, endAt) {
  const start = formatTime(startAt);
  const end = formatTime(endAt);
  const slot = SLOT_OPTIONS.find((option) => option.start === start && option.end === end);

  return slot ? slot.label : `${start}–${end} น.`;
}
