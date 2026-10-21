// ตรวจ input สำหรับจองห้อง และ Admin จัดการรายชื่อห้อง
import { AppError } from '../../utils/AppError.js';
import { todayInBangkok } from '../../utils/dueDate.js';

// ต้องตรงกับ @db.VarChar(100) ของ rooms.room_name ใน schema.prisma
const MAX_ROOM_NAME_LENGTH = 100;
// purpose เป็น TEXT ไม่จำกัดจาก DB จึงกันความยาวไว้ฝั่งนี้เอง (เทียบเท่า borrow.validator.js)
const MAX_PURPOSE_LENGTH = 2000;

// ช่วงเวลาที่จองได้ (เวลาไทย) จองทีละช่วงเต็ม ไม่เลือกเวลาเองแล้ว — ฝั่ง client (RoomBooking.jsx, RoomTimeline.jsx) ต้องตรงกัน
// ช่วงเช้ากับบ่ายเว้น 12:00–13:00 พัก ส่วนบ่ายกับเย็นต่อกันพอดีที่ 16:00
const SLOTS = {
  morning: { start: '09:00', end: '12:00' },
  afternoon: { start: '13:00', end: '16:00' },
  evening: { start: '16:00', end: '18:00' },
};
// จองล่วงหน้าได้ไม่เกินกี่วัน
const MAX_DAYS_AHEAD = 30;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// "YYYY-MM-DD" ที่เป็นวันจริง (กัน 2026-02-30 ที่ new Date เลื่อนไปเป็นวันที่ 2 มี.ค. ให้เงียบๆ)
function isValidDateString(value) {
  if (!DATE_PATTERN.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// วันที่ + เวลาที่ผู้ใช้เลือก (เวลาไทย) -> เวลาจริงแบบ UTC ที่เก็บลง DB เช่น 2026-10-20 13:00 -> 06:00Z
export function toBangkokDateTime(dateString, timeString) {
  return new Date(`${dateString}T${timeString}:00.000+07:00`);
}

export function validateCreateBooking(request, _response, next) {
  const body = request.body ?? {};
  const roomId = Number(body.room_id);
  const date = String(body.date ?? '');
  const slot = SLOTS[String(body.slot ?? '')];
  const purpose = String(body.purpose ?? '').trim() || null;

  if (!Number.isInteger(roomId) || roomId <= 0) {
    return next(new AppError(400, 'กรุณาเลือกห้อง'));
  }
  if (!isValidDateString(date)) {
    return next(new AppError(400, 'กรุณาระบุวันที่จอง'));
  }
  if (!slot) {
    return next(new AppError(400, 'กรุณาเลือกช่วงเวลา (เช้า บ่าย หรือเย็น)'));
  }

  const startAt = toBangkokDateTime(date, slot.start);
  const endAt = toBangkokDateTime(date, slot.end);

  if (startAt <= new Date()) {
    return next(new AppError(400, 'จองย้อนหลังหรือช่วงเวลาที่เริ่มไปแล้วไม่ได้'));
  }
  if (date > addDays(todayInBangkok(), MAX_DAYS_AHEAD)) {
    return next(new AppError(400, `จองล่วงหน้าได้ไม่เกิน ${MAX_DAYS_AHEAD} วัน`));
  }
  if (purpose && purpose.length > MAX_PURPOSE_LENGTH) {
    return next(new AppError(400, `วัตถุประสงค์ต้องไม่เกิน ${MAX_PURPOSE_LENGTH} ตัวอักษร`));
  }

  request.validated = { roomId, startAt, endAt, purpose };
  next();
}

// GET /api/room-bookings?date=YYYY-MM-DD ไม่ส่ง date มา = วันนี้ (เวลาไทย)
export function validateBookingDateQuery(request, _response, next) {
  const date = String(request.query.date ?? '') || todayInBangkok();

  if (!isValidDateString(date)) {
    return next(new AppError(400, 'รูปแบบวันที่ไม่ถูกต้อง'));
  }

  request.validated = { date };
  next();
}

export function validateBookingIdParam(request, _response, next) {
  const bookingId = Number(request.params.id);

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return next(new AppError(400, 'รหัสการจองไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, bookingId };
  next();
}

function parseRoomName(value, next) {
  const roomName = String(value ?? '').trim();

  if (!roomName) {
    next(new AppError(400, 'กรุณากรอกชื่อห้อง'));
    return null;
  }
  if (roomName.length > MAX_ROOM_NAME_LENGTH) {
    next(new AppError(400, `ชื่อห้องต้องไม่เกิน ${MAX_ROOM_NAME_LENGTH} ตัวอักษร`));
    return null;
  }

  return roomName;
}

export function validateCreateRoom(request, _response, next) {
  const roomName = parseRoomName(request.body?.room_name, next);
  if (!roomName) return;

  request.validated = { roomName };
  next();
}

export function validateRoomIdParam(request, _response, next) {
  const roomId = Number(request.params.id);

  if (!Number.isInteger(roomId) || roomId <= 0) {
    return next(new AppError(400, 'รหัสห้องไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, roomId };
  next();
}

// แก้ได้ทีละอย่างหรือพร้อมกันก็ได้ ส่งมาเฉพาะช่องที่จะเปลี่ยน
export function validateUpdateRoom(request, _response, next) {
  const body = request.body ?? {};
  const roomId = Number(request.params.id);
  const changes = {};

  if (!Number.isInteger(roomId) || roomId <= 0) {
    return next(new AppError(400, 'รหัสห้องไม่ถูกต้อง'));
  }

  if (body.room_name !== undefined) {
    const roomName = parseRoomName(body.room_name, next);
    if (!roomName) return;
    changes.room_name = roomName;
  }

  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') {
      return next(new AppError(400, 'สถานะเปิด/ปิดห้องไม่ถูกต้อง'));
    }
    changes.is_active = body.is_active;
  }

  if (Object.keys(changes).length === 0) {
    return next(new AppError(400, 'ไม่มีข้อมูลที่จะแก้ไข'));
  }

  request.validated = { roomId, changes };
  next();
}
