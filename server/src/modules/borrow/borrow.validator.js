// ตรวจรูปแบบ input สำหรับ endpoint ยืม-คืนครุภัณฑ์
import { AppError } from '../../utils/AppError.js';
import { toDate } from '../../utils/parsing.js';

// เหตุผล/หมายเหตุการยืม เป็น TEXT ไม่จำกัดจาก DB จึงกันความยาวไว้ฝั่งนี้เอง (เทียบเท่า equipment.validator.js)
const MAX_REMARK_LENGTH = 2000;

// return_date/item_ids/remark ใช้ร่วมกันทั้งตอน Admin สร้างแทนคนอื่นและ user สร้างให้ตัวเอง
function parseReturnDateAndItemIds(body) {
  const returnDate = toDate(body.return_date);
  // ยืมได้หลายชิ้นในใบเดียว ตัดรหัสซ้ำออกกันพลาดกดเลือกซ้ำจาก UI
  const itemIds = Array.isArray(body.item_ids)
    ? [...new Set(body.item_ids.map(Number))]
    : [];
  // ไม่บังคับกรอก — ค่าว่างเก็บเป็น null แทน '' กันแถวเก่าที่ไม่มี remark ปนกับแถวที่ตั้งใจล้างข้อความทิ้ง
  const remark = String(body.remark ?? '').trim() || null;

  return { returnDate, itemIds, remark };
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
  const { returnDate, itemIds, remark } = parseReturnDateAndItemIds(body);

  if (!Number.isInteger(userId) || userId <= 0) {
    return next(new AppError(400, 'กรุณาระบุผู้ยืม'));
  }

  if (!validateReturnDateAndItemIds({ returnDate, itemIds }, next)) return;

  if (remark && remark.length > MAX_REMARK_LENGTH) {
    return next(new AppError(400, `หมายเหตุต้องไม่เกิน ${MAX_REMARK_LENGTH} ตัวอักษร`));
  }

  request.validated = { userId, returnDate, itemIds, remark };
  next();
}

// user ธรรมดายืมให้ตัวเองเท่านั้น ไม่รับ user_id จาก body เพื่อกันยืมแทนคนอื่น
export function validateCreateMyBorrow(request, _response, next) {
  const body = request.body ?? {};
  const { returnDate, itemIds, remark } = parseReturnDateAndItemIds(body);

  if (!validateReturnDateAndItemIds({ returnDate, itemIds }, next)) return;

  if (remark && remark.length > MAX_REMARK_LENGTH) {
    return next(new AppError(400, `หมายเหตุต้องไม่เกิน ${MAX_REMARK_LENGTH} ตัวอักษร`));
  }

  request.validated = { returnDate, itemIds, remark };
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
