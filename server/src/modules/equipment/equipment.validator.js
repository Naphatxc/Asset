// ตรวจรูปแบบ input สำหรับ endpoint ครุภัณฑ์ — การ validate ที่ต้องพึ่งข้อมูลเดิมใน DB (เช่น merge กับ current
// ตอน PATCH ทั่วไป) ยังอยู่ใน equipment.service.js เพราะ validator ชั้นนี้ไม่ควรรู้จัก Database
import { AppError } from '../../utils/AppError.js';
import { hasOwn, toDate } from '../../utils/parsing.js';

export const allowedStatuses = [
  'available',
  'borrowed',
  'pending_repair',
  'repairing',
];

// รายชื่อ field ที่ API แก้ไขทั่วไปยอมรับ (ไม่รวม code และ status)
export const editableFields = [
  'equipment_name',
  'category_id',
  'location_id',
  'fiscal_year',
  'description',
  'receive_date',
  'remark',
  'price',
  'warranty_expire',
];

export function validateItemIdParam(request, _response, next) {
  const itemId = Number(request.params.id);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return next(new AppError(400, 'รหัสครุภัณฑ์ไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, itemId };
  next();
}

export function validateCreateEquipment(request, _response, next) {
  const body = request.body ?? {};
  const equipmentName = String(body.equipment_name ?? '').trim();
  const equipmentCode = String(body.equipment_code ?? '')
    .trim()
    .toUpperCase();
  const categoryId = Number(body.category_id);
  const locationValue = body.location_id;
  const locationId =
    locationValue == null || locationValue === ''
      ? null
      : Number(locationValue);
  const fiscalYear = body.fiscal_year ? Number(body.fiscal_year) : null;
  const description = String(body.description ?? '').trim() || null;
  const receiveDate = toDate(body.receive_date);
  const remark = String(body.remark ?? '').trim() || null;
  const status = String(body.status ?? 'available')
    .trim()
    .toLowerCase();
  const priceValue = body.price;
  const price =
    priceValue == null || priceValue === '' ? null : Number(priceValue);
  const warrantyExpire = toDate(body.warranty_expire);

  if (!equipmentName || !equipmentCode || !categoryId) {
    return next(
      new AppError(400, 'กรุณากรอกชื่อ รหัส และหมวดหมู่ของครุภัณฑ์'),
    );
  }

  if (!allowedStatuses.includes(status)) {
    return next(new AppError(400, 'สถานะครุภัณฑ์ไม่ถูกต้อง'));
  }

  if (price !== null && (Number.isNaN(price) || price < 0)) {
    return next(new AppError(400, 'ราคาครุภัณฑ์ไม่ถูกต้อง'));
  }

  request.validated = {
    equipmentName,
    equipmentCode,
    categoryId,
    locationId,
    fiscalYear,
    description,
    receiveDate,
    remark,
    status,
    price,
    warrantyExpire,
  };
  next();
}

export function validateUpdateEquipmentStatus(request, _response, next) {
  const status = String(request.body?.status ?? '')
    .trim()
    .toLowerCase();

  if (!allowedStatuses.includes(status)) {
    return next(new AppError(400, 'สถานะครุภัณฑ์ไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, status };
  next();
}

export function validateUpdateEquipment(request, _response, next) {
  const body = request.body ?? {};

  if (!editableFields.some((field) => hasOwn(body, field))) {
    return next(new AppError(400, 'กรุณาระบุข้อมูลที่ต้องการแก้ไข'));
  }

  request.validated = { ...request.validated, body };
  next();
}
