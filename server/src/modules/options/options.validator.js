// ตรวจ input สำหรับเพิ่มหมวดหมู่/สถานที่ใหม่ (Admin เท่านั้น)
import { AppError } from '../../utils/AppError.js';

// A-Z/0-9 เท่านั้น (พิมพ์เล็กแปลงเป็นใหญ่ให้) ใช้ต่อท้ายด้วย "-" ในรหัสครุภัณฑ์ที่ออกอัตโนมัติ เช่น PC-0005
const CODE_PREFIX_PATTERN = /^[A-Z0-9]+$/;

// ต้องตรงกับ @db.VarChar(...) ใน schema.prisma ของ categories/locations เป๊ะๆ กันข้อความยาวเกินไปโดน DB ตัด/ปฏิเสธ
const MAX_NAME_LENGTH = 100;
const MAX_CODE_PREFIX_LENGTH = 20;
const MAX_ROOM_LENGTH = 30;

export function validateCreateCategory(request, _response, next) {
  const body = request.body ?? {};
  const categoryName = String(body.category_name ?? '').trim();

  if (!categoryName) {
    return next(new AppError(400, 'กรุณากรอกชื่อหมวดหมู่'));
  }
  if (categoryName.length > MAX_NAME_LENGTH) {
    return next(
      new AppError(400, `ชื่อหมวดหมู่ต้องไม่เกิน ${MAX_NAME_LENGTH} ตัวอักษร`),
    );
  }

  const rawCodePrefix = String(body.code_prefix ?? '').trim().toUpperCase();
  const codePrefix = rawCodePrefix || null;

  if (codePrefix) {
    if (!CODE_PREFIX_PATTERN.test(codePrefix)) {
      return next(
        new AppError(400, 'รหัสย่อหมวดหมู่ใช้ได้เฉพาะตัวอักษร A-Z และตัวเลขเท่านั้น'),
      );
    }
    if (codePrefix.length > MAX_CODE_PREFIX_LENGTH) {
      return next(
        new AppError(400, `รหัสย่อหมวดหมู่ต้องไม่เกิน ${MAX_CODE_PREFIX_LENGTH} ตัวอักษร`),
      );
    }
  }

  request.validated = { categoryName, codePrefix };
  next();
}

export function validateCreateLocation(request, _response, next) {
  const body = request.body ?? {};
  const locationName = String(body.location_name ?? '').trim();

  if (!locationName) {
    return next(new AppError(400, 'กรุณากรอกชื่อสถานที่'));
  }
  if (locationName.length > MAX_NAME_LENGTH) {
    return next(
      new AppError(400, `ชื่อสถานที่ต้องไม่เกิน ${MAX_NAME_LENGTH} ตัวอักษร`),
    );
  }

  const building = String(body.building ?? '').trim() || null;
  if (building && building.length > MAX_NAME_LENGTH) {
    return next(
      new AppError(400, `ชื่ออาคารต้องไม่เกิน ${MAX_NAME_LENGTH} ตัวอักษร`),
    );
  }

  const room = String(body.room ?? '').trim() || null;
  if (room && room.length > MAX_ROOM_LENGTH) {
    return next(
      new AppError(400, `เลขห้องต้องไม่เกิน ${MAX_ROOM_LENGTH} ตัวอักษร`),
    );
  }

  request.validated = { locationName, building, room };
  next();
}
