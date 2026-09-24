// ตรวจรูปแบบ input สำหรับ endpoint ตรวจนับครุภัณฑ์ประจำปี
import { AppError } from '../../utils/AppError.js';
import { MAX_LONG_TEXT_LENGTH } from '../equipment/equipment.validator.js';

// ต้องตรงกับ @db.VarChar(100) ของ audit_rounds.title ใน schema.prisma
export const MAX_ROUND_TITLE_LENGTH = 100;

const results = new Set(['normal', 'damaged']);

function parsePositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function validateRoundIdParam(request, _response, next) {
  const roundId = parsePositiveInt(request.params.id);

  if (!roundId) {
    return next(new AppError(400, 'รหัสรอบตรวจนับไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, roundId };
  next();
}

export function validateItemIdParam(request, _response, next) {
  const itemId = parsePositiveInt(request.params.itemId);

  if (!itemId) {
    return next(new AppError(400, 'รหัสครุภัณฑ์ไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, itemId };
  next();
}

export function validateOpenRound(request, _response, next) {
  const title = String(request.body?.title ?? '').trim();

  if (!title) {
    return next(new AppError(400, 'กรุณาตั้งชื่อรอบตรวจนับ'));
  }
  if (title.length > MAX_ROUND_TITLE_LENGTH) {
    return next(
      new AppError(400, `ชื่อรอบต้องไม่เกิน ${MAX_ROUND_TITLE_LENGTH} ตัวอักษร`),
    );
  }

  request.validated = { ...request.validated, title };
  next();
}

export function validateCheckItem(request, _response, next) {
  const body = request.body ?? {};
  const result = String(body.result ?? '');
  const note = String(body.note ?? '').trim() || null;
  const locationId =
    body.location_id == null || body.location_id === ''
      ? null
      : parsePositiveInt(body.location_id);

  if (!results.has(result)) {
    return next(new AppError(400, 'ผลการตรวจไม่ถูกต้อง'));
  }
  if (note && note.length > MAX_LONG_TEXT_LENGTH) {
    return next(
      new AppError(400, `หมายเหตุต้องไม่เกิน ${MAX_LONG_TEXT_LENGTH} ตัวอักษร`),
    );
  }
  if (body.location_id != null && body.location_id !== '' && !locationId) {
    return next(new AppError(400, 'ห้องไม่ถูกต้อง'));
  }

  request.validated = {
    ...request.validated,
    result,
    note,
    locationId,
    moveLocation: body.move_location === true,
  };
  next();
}
