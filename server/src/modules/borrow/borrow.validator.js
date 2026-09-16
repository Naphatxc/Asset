// ตรวจรูปแบบ input สำหรับ endpoint ยืม-คืนครุภัณฑ์
import { AppError } from '../../utils/AppError.js';
import { toDate } from '../../utils/parsing.js';

// return_date/item_ids ใช้ร่วมกันทั้งตอน Admin สร้างแทนคนอื่นและ user สร้างให้ตัวเอง
function parseReturnDateAndItemIds(body) {
  const returnDate = toDate(body.return_date);
  // ยืมได้หลายชิ้นในใบเดียว ตัดรหัสซ้ำออกกันพลาดกดเลือกซ้ำจาก UI
  const itemIds = Array.isArray(body.item_ids)
    ? [...new Set(body.item_ids.map(Number))]
    : [];

  return { returnDate, itemIds };
}

function validateReturnDateAndItemIds({ returnDate, itemIds }, next) {
  if (!returnDate) {
    next(new AppError(400, 'กรุณาระบุวันครบกำหนดคืน'));
    return false;
  }

  if (
    itemIds.length === 0 ||
    itemIds.some((itemId) => !Number.isInteger(itemId) || itemId <= 0)
  ) {
    next(new AppError(400, 'กรุณาเลือกครุภัณฑ์ที่จะยืมอย่างน้อย 1 ชิ้น'));
    return false;
  }

  return true;
}

export function validateCreateBorrow(request, _response, next) {
  const body = request.body ?? {};
  const userId = Number(body.user_id);
  const { returnDate, itemIds } = parseReturnDateAndItemIds(body);

  if (!Number.isInteger(userId) || userId <= 0) {
    return next(new AppError(400, 'กรุณาระบุผู้ยืม'));
  }

  if (!validateReturnDateAndItemIds({ returnDate, itemIds }, next)) return;

  request.validated = { userId, returnDate, itemIds };
  next();
}

// user ธรรมดายืมให้ตัวเองเท่านั้น ไม่รับ user_id จาก body เพื่อกันยืมแทนคนอื่น
export function validateCreateMyBorrow(request, _response, next) {
  const body = request.body ?? {};
  const { returnDate, itemIds } = parseReturnDateAndItemIds(body);

  if (!validateReturnDateAndItemIds({ returnDate, itemIds }, next)) return;

  request.validated = { returnDate, itemIds };
  next();
}

export function validateBorrowDetailIdParam(request, _response, next) {
  const borrowDetailId = Number(request.params.id);

  if (!Number.isInteger(borrowDetailId) || borrowDetailId <= 0) {
    return next(new AppError(400, 'รหัสรายการยืมไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, borrowDetailId };
  next();
}

export function validateBorrowIdParam(request, _response, next) {
  const borrowId = Number(request.params.id);

  if (!Number.isInteger(borrowId) || borrowId <= 0) {
    return next(new AppError(400, 'รหัสคำขอยืมไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, borrowId };
  next();
}
