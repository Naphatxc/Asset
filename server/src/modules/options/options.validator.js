// ตรวจ input สำหรับเพิ่มหมวดหมู่/สถานที่ใหม่ (Admin เท่านั้น)
import { AppError } from '../../utils/AppError.js';

export function validateCreateCategory(request, _response, next) {
  const body = request.body ?? {};
  const categoryName = String(body.category_name ?? '').trim();

  if (!categoryName) {
    return next(new AppError(400, 'กรุณากรอกชื่อหมวดหมู่'));
  }

  request.validated = { categoryName };
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
