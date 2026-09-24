// ตรวจรูปแบบ input สำหรับ endpoint วัสดุ — แนวเดียวกับ equipment.validator.js
import { AppError } from '../../utils/AppError.js';
import { hasOwn, toDate } from '../../utils/parsing.js';

// ตัวเลขต้องตรงกับ @db.VarChar(...)/@db.Text ใน schema.prisma ของ materials เป๊ะๆ
export const MAX_MATERIAL_NAME_LENGTH = 150;
export const MAX_MATERIAL_CODE_LENGTH = 50;
export const MAX_UNIT_NAME_LENGTH = 50;
export const MAX_LONG_TEXT_LENGTH = 2000; // remark เป็น TEXT ไม่จำกัดจาก DB

function exceedsLength(value, max) {
  return typeof value === 'string' && value.length > max;
}

// รายชื่อ field ที่ API แก้ไขทั่วไปยอมรับ (ไม่รวม material_code — รหัสคงที่หลังสร้างแล้ว เหมือน equipment_code)
export const editableFields = [
  'material_name',
  'category_id',
  'quantity',
  'minimum_quantity',
  'expire_date',
  'unit_name',
  'unit_price',
  'remark',
];

export function validateMaterialIdParam(request, _response, next) {
  const materialId = Number(request.params.id);

  if (!Number.isInteger(materialId) || materialId <= 0) {
    return next(new AppError(400, 'รหัสวัสดุไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, materialId };
  next();
}

export function validateCreateMaterial(request, _response, next) {
  const body = request.body ?? {};
  const materialName = String(body.material_name ?? '').trim();
  const materialCode = String(body.material_code ?? '')
    .trim()
    .toUpperCase();
  const categoryId = Number(body.category_id);
  const quantityValue = body.quantity;
  const quantity =
    quantityValue == null || quantityValue === '' ? 0 : Number(quantityValue);
  const minimumQuantityValue = body.minimum_quantity;
  const minimumQuantity =
    minimumQuantityValue == null || minimumQuantityValue === ''
      ? 0
      : Number(minimumQuantityValue);
  const expireDate = toDate(body.expire_date);
  const unitName = String(body.unit_name ?? '').trim();
  const unitPriceValue = body.unit_price;
  const unitPrice =
    unitPriceValue == null || unitPriceValue === ''
      ? null
      : Number(unitPriceValue);
  const remark = String(body.remark ?? '').trim() || null;

  if (!materialName || !materialCode || !categoryId || !unitName) {
    return next(
      new AppError(400, 'กรุณากรอกชื่อ รหัส หมวดหมู่ และหน่วยนับของวัสดุ'),
    );
  }

  if (exceedsLength(materialName, MAX_MATERIAL_NAME_LENGTH)) {
    return next(
      new AppError(400, `ชื่อวัสดุต้องไม่เกิน ${MAX_MATERIAL_NAME_LENGTH} ตัวอักษร`),
    );
  }
  if (exceedsLength(materialCode, MAX_MATERIAL_CODE_LENGTH)) {
    return next(
      new AppError(400, `รหัสวัสดุต้องไม่เกิน ${MAX_MATERIAL_CODE_LENGTH} ตัวอักษร`),
    );
  }
  if (exceedsLength(unitName, MAX_UNIT_NAME_LENGTH)) {
    return next(
      new AppError(400, `หน่วยนับต้องไม่เกิน ${MAX_UNIT_NAME_LENGTH} ตัวอักษร`),
    );
  }
  if (exceedsLength(remark, MAX_LONG_TEXT_LENGTH)) {
    return next(
      new AppError(400, `หมายเหตุต้องไม่เกิน ${MAX_LONG_TEXT_LENGTH} ตัวอักษร`),
    );
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    return next(new AppError(400, 'จำนวนคงเหลือไม่ถูกต้อง'));
  }
  if (!Number.isInteger(minimumQuantity) || minimumQuantity < 0) {
    return next(new AppError(400, 'จำนวนขั้นต่ำไม่ถูกต้อง'));
  }
  if (unitPrice !== null && (Number.isNaN(unitPrice) || unitPrice < 0)) {
    return next(new AppError(400, 'ราคาต่อหน่วยไม่ถูกต้อง'));
  }

  request.validated = {
    materialName,
    materialCode,
    categoryId,
    quantity,
    minimumQuantity,
    expireDate,
    unitName,
    unitPrice,
    remark,
  };
  next();
}

export function validateUpdateMaterial(request, _response, next) {
  const body = request.body ?? {};

  if (!editableFields.some((field) => hasOwn(body, field))) {
    return next(new AppError(400, 'กรุณาระบุข้อมูลที่ต้องการแก้ไข'));
  }

  request.validated = { ...request.validated, body };
  next();
}

// เบิกวัสดุ (ตัดยอดทันที ไม่มีขั้นตอนรออนุมัติ) — ทุก role ที่ login แล้วเรียกได้
export function validateWithdrawMaterial(request, _response, next) {
  const quantity = Number(request.body?.quantity);
  const remark = String(request.body?.remark ?? '').trim() || null;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return next(new AppError(400, 'กรุณาระบุจำนวนที่จะเบิกให้ถูกต้อง'));
  }
  if (exceedsLength(remark, MAX_LONG_TEXT_LENGTH)) {
    return next(
      new AppError(400, `หมายเหตุต้องไม่เกิน ${MAX_LONG_TEXT_LENGTH} ตัวอักษร`),
    );
  }

  request.validated = { ...request.validated, quantity, remark };
  next();
}
