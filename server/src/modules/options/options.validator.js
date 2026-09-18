// ตรวจ input สำหรับเพิ่มหมวดหมู่/สถานที่ใหม่ (Admin เท่านั้น)
import { AppError } from '../../utils/AppError.js';

// A-Z/0-9 เท่านั้น (พิมพ์เล็กแปลงเป็นใหญ่ให้) ใช้ต่อท้ายด้วย "-" ในรหัสครุภัณฑ์ที่ออกอัตโนมัติ เช่น PC-0005
const CODE_PREFIX_PATTERN = /^[A-Z0-9]+$/;

export function validateCreateCategory(request, _response, next) {
  const body = request.body ?? {};
  const categoryName = String(body.category_name ?? '').trim();

  if (!categoryName) {
    return next(new AppError(400, 'กรุณากรอกชื่อหมวดหมู่'));
  }

  const rawCodePrefix = String(body.code_prefix ?? '').trim().toUpperCase();
  const codePrefix = rawCodePrefix || null;

  if (codePrefix && !CODE_PREFIX_PATTERN.test(codePrefix)) {
    return next(
      new AppError(400, 'รหัสย่อหมวดหมู่ใช้ได้เฉพาะตัวอักษร A-Z และตัวเลขเท่านั้น'),
    );
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

  const building = String(body.building ?? '').trim() || null;
  const room = String(body.room ?? '').trim() || null;

  request.validated = { locationName, building, room };
  next();
}
