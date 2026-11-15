// ตรวจ input สำหรับจองห้อง และ Admin จัดการรายชื่อห้อง
import { AppError } from '../../utils/AppError.js';
import { todayInBangkok } from '../../utils/dueDate.js';

// ต้องตรงกับ @db.VarChar(100) ของ rooms.room_name ใน schema.prisma
const MAX_ROOM_NAME_LENGTH = 100;
// purpose เป็น TEXT ไม่จำกัดจาก DB จึงกันความยาวไว้ฝั่งนี้เอง (เทียบเท่า borrow.validator.js)
const MAX_PURPOSE_LENGTH = 2000;

// จองได้ตั้งแต่ 09:00 ถึง 19:00 (เวลาไทย) ทีละชั่วโมงเต็ม ขั้นต่ำ 1 ชั่วโมง และเลือกต่อเนื่องกันได้ เช่น 10:00–13:00
// ฝั่ง client (utils/roomBooking.js) ต้องตรงกัน
const OPEN_HOUR = 9;
const CLOSE_HOUR = 19;
// จองล่วงหน้าได้ไม่เกินกี่วัน
const MAX_DAYS_AHEAD = 30;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HOUR_PATTERN = /^\d{2}:00$/;

// "10:00" -> 10, ไม่ใช่ชั่วโมงเต็ม (เช่น "10:30") -> null
function parseHour(value) {
  const text = String(value ?? '');
  return HOUR_PATTERN.test(text) ? Number(text.slice(0, 2)) : null;
}

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
  const startHour = parseHour(body.start);
  const endHour = parseHour(body.end);
  const purpose = String(body.purpose ?? '').trim() || null;

  if (!Number.isInteger(roomId) || roomId <= 0) {
    return next(new AppError(400, 'กรุณาเลือกห้อง'));
  }
  if (!isValidDateString(date)) {
    return next(new AppError(400, 'กรุณาระบุวันที่จอง'));
  }
  if (startHour === null || endHour === null) {
    return next(new AppError(400, 'กรุณาเลือกเวลาเริ่มและเวลาสิ้นสุด (ชั่วโมงเต็ม)'));
  }
  if (startHour < OPEN_HOUR || endHour > CLOSE_HOUR) {
    return next(new AppError(400, `จองได้ระหว่าง ${OPEN_HOUR}:00–${CLOSE_HOUR}:00 น. เท่านั้น`));
  }
  if (endHour <= startHour) {
    return next(new AppError(400, 'เวลาสิ้นสุดต้องหลังเวลาเริ่มอย่างน้อย 1 ชั่วโมง'));
  }

  const startAt = toBangkokDateTime(date, body.start);
  const endAt = toBangkokDateTime(date, body.end);

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

// ===== จองต่อเนื่อง (Admin) — เช่น ทุกวันจันทร์ 09:00–12:00 ตั้งแต่ 1 พ.ย. ถึง 31 ม.ค. =====
// Admin จองล่วงหน้าได้ไกลกว่าคนทั่วไป (ทั้งภาคเรียน) แต่จำกัดไว้กันพิมพ์ปีผิดแล้วได้การจองหลายร้อยรายการ
const MAX_SERIES_DAYS_AHEAD = 183;
const MAX_SERIES_OCCURRENCES = 200;

// วันในสัปดาห์ของวันที่ "YYYY-MM-DD" (0 = อาทิตย์ ... 6 = เสาร์) ตามปฏิทิน ไม่ขึ้นกับเขตเวลาของ server
function weekdayOf(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`).getUTCDay();
}

// body: { room_id, start_date, end_date, weekdays: [0-6...], start: "HH:00", end: "HH:00", purpose? }
// ได้ request.validated.occurrences = ทุกวันในช่วงที่ตรงกับวันในสัปดาห์ที่เลือก พร้อมเวลาเริ่ม/จบจริง (UTC)
// วันที่ช่วงเวลาเริ่มไปแล้ว (เช่น วันนี้แต่เลยเวลาแล้ว) ไม่นับ เพราะจองย้อนหลังไม่ได้อยู่แล้ว
export function validateBookingSeries(request, _response, next) {
  const body = request.body ?? {};
  const roomId = Number(body.room_id);
  const startDate = String(body.start_date ?? '');
  const endDate = String(body.end_date ?? '');
  const startHour = parseHour(body.start);
  const endHour = parseHour(body.end);
  const purpose = String(body.purpose ?? '').trim() || null;
  const weekdays = Array.isArray(body.weekdays) ? [...new Set(body.weekdays.map(Number))] : [];
  const today = todayInBangkok();

  if (!Number.isInteger(roomId) || roomId <= 0) {
    return next(new AppError(400, 'กรุณาเลือกห้อง'));
  }
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    return next(new AppError(400, 'กรุณาระบุวันเริ่มและวันสิ้นสุด'));
  }
  if (startDate < today) {
    return next(new AppError(400, 'วันเริ่มต้องเป็นวันนี้หรือหลังจากนี้'));
  }
  if (endDate < startDate) {
    return next(new AppError(400, 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม'));
  }
  if (endDate > addDays(today, MAX_SERIES_DAYS_AHEAD)) {
    return next(new AppError(400, `จองต่อเนื่องล่วงหน้าได้ไม่เกิน ${MAX_SERIES_DAYS_AHEAD} วัน (ประมาณ 6 เดือน)`));
  }
  if (weekdays.length === 0 || weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    return next(new AppError(400, 'กรุณาเลือกวันในสัปดาห์อย่างน้อย 1 วัน'));
  }
  if (startHour === null || endHour === null) {
    return next(new AppError(400, 'กรุณาเลือกเวลาเริ่มและเวลาสิ้นสุด (ชั่วโมงเต็ม)'));
  }
  if (startHour < OPEN_HOUR || endHour > CLOSE_HOUR) {
    return next(new AppError(400, `จองได้ระหว่าง ${OPEN_HOUR}:00–${CLOSE_HOUR}:00 น. เท่านั้น`));
  }
  if (endHour <= startHour) {
    return next(new AppError(400, 'เวลาสิ้นสุดต้องหลังเวลาเริ่มอย่างน้อย 1 ชั่วโมง'));
  }
  if (purpose && purpose.length > MAX_PURPOSE_LENGTH) {
    return next(new AppError(400, `วัตถุประสงค์ต้องไม่เกิน ${MAX_PURPOSE_LENGTH} ตัวอักษร`));
  }

  const now = new Date();
  const occurrences = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    if (!weekdays.includes(weekdayOf(date))) continue;

    const startAt = toBangkokDateTime(date, body.start);
    if (startAt <= now) continue;

    occurrences.push({ date, startAt, endAt: toBangkokDateTime(date, body.end) });
  }

  if (occurrences.length === 0) {
    return next(new AppError(400, 'ไม่มีวันที่ตรงกับวันในสัปดาห์ที่เลือกในช่วงนี้'));
  }
  if (occurrences.length > MAX_SERIES_OCCURRENCES) {
    return next(new AppError(400, `จองต่อเนื่องได้ไม่เกิน ${MAX_SERIES_OCCURRENCES} ครั้งต่อชุด`));
  }

  request.validated = { roomId, purpose, occurrences };
  next();
}

// รหัสชุดเป็น UUID ที่ server สร้าง (crypto.randomUUID) รูปแบบอื่นไม่ต้องไปค้นใน DB
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function validateSeriesIdParam(request, _response, next) {
  const seriesId = String(request.params.seriesId ?? '').toLowerCase();

  if (!UUID_PATTERN.test(seriesId)) {
    return next(new AppError(400, 'รหัสชุดการจองไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, seriesId };
  next();
}
