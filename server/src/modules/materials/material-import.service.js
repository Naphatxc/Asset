// นำเข้าวัสดุทีละหลายร้อยรายการจากไฟล์ Excel (หน้าเว็บแปลงแต่ละแถวเป็น item แล้วส่งมา ดู client/src/utils/importExcel.js)
// กติกาเดียวกับ equipment-import.service.js:
// - ตรวจทุกแถวก่อน ถ้ามีแถวไหนผิด ไม่นำเข้าเลยสักแถว แล้วบอกแถวที่ผิดกลับไป
// - รหัสที่มีในระบบอยู่แล้ว (รวมที่ถูกลบ) ข้ามไป นำเข้าไฟล์เดิมซ้ำจึงไม่เกิดของซ้ำ ค้างกลางทางก็กดซ้ำเพื่อทำต่อได้
//   (ไม่ได้บวกจำนวนเข้าของเดิม ถ้าจะรับของเข้าสต๊อกให้แก้จำนวนที่รายการนั้นแทน)
// - หมวดหมู่จับคู่ด้วยชื่อ ไม่มีก็สร้างให้
import * as materialImportRepository from './material-import.repository.js';
import * as equipmentImportRepository from '../equipment/equipment-import.repository.js';
import { AppError } from '../../utils/AppError.js';
import { toDate } from '../../utils/parsing.js';
import {
  MAX_LONG_TEXT_LENGTH,
  MAX_MATERIAL_CODE_LENGTH,
  MAX_MATERIAL_NAME_LENGTH,
  MAX_UNIT_NAME_LENGTH,
} from './material.validator.js';

const CHUNK_SIZE = 500;
// ต้องตรงกับ @db.VarChar(...) ของ categories ใน schema.prisma
const MAX_CATEGORY_NAME_LENGTH = 100;

function text(value) {
  return value == null ? '' : String(value).trim();
}

function optionalNumber(value) {
  return value == null || value === '' ? null : Number(value);
}

// แปลง + ตรวจหนึ่งแถว คืน { row } หรือ { error }
function parseRow(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'ข้อมูลแถวไม่ถูกต้อง' };

  const row = {
    code: text(raw.material_code).toUpperCase(),
    name: text(raw.material_name),
    categoryName: text(raw.category_name),
    unitName: text(raw.unit_name),
    quantity: optionalNumber(raw.quantity) ?? 0,
    minimumQuantity: optionalNumber(raw.minimum_quantity) ?? 0,
    unitPrice: optionalNumber(raw.unit_price),
    expireDate: raw.expire_date ? toDate(raw.expire_date) : null,
    remark: text(raw.remark) || null,
    // หน้าเว็บแปลง ใช่/ไม่/เว้นว่าง เป็น boolean แล้ว (ดู toBoolean ใน importExcel.js) ไม่ส่งมา = ไม่ต้องคืน
    isReturnable: raw.is_returnable ?? false,
  };

  if (!row.code) return { error: 'ไม่มีรหัสวัสดุ' };
  if (row.code.length > MAX_MATERIAL_CODE_LENGTH) return { error: `รหัสยาวเกิน ${MAX_MATERIAL_CODE_LENGTH} ตัวอักษร` };
  if (!row.name) return { error: 'ไม่มีชื่อวัสดุ' };
  if (row.name.length > MAX_MATERIAL_NAME_LENGTH) return { error: `ชื่อยาวเกิน ${MAX_MATERIAL_NAME_LENGTH} ตัวอักษร` };
  if (!row.categoryName) return { error: 'ไม่มีหมวดหมู่' };
  if (row.categoryName.length > MAX_CATEGORY_NAME_LENGTH) return { error: `ชื่อหมวดหมู่ยาวเกิน ${MAX_CATEGORY_NAME_LENGTH} ตัวอักษร` };
  if (!row.unitName) return { error: 'ไม่มีหน่วยนับ' };
  if (row.unitName.length > MAX_UNIT_NAME_LENGTH) return { error: `หน่วยนับยาวเกิน ${MAX_UNIT_NAME_LENGTH} ตัวอักษร` };
  if (row.remark && row.remark.length > MAX_LONG_TEXT_LENGTH) return { error: `หมายเหตุยาวเกิน ${MAX_LONG_TEXT_LENGTH} ตัวอักษร` };
  // เพดาน 2,147,483,647 = Int ของ MySQL
  if (!Number.isInteger(row.quantity) || row.quantity < 0 || row.quantity > 2147483647) {
    return { error: 'จำนวนคงเหลือต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป' };
  }
  if (!Number.isInteger(row.minimumQuantity) || row.minimumQuantity < 0 || row.minimumQuantity > 2147483647) {
    return { error: 'จำนวนขั้นต่ำต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป' };
  }
  if (row.unitPrice !== null && (Number.isNaN(row.unitPrice) || row.unitPrice < 0 || row.unitPrice >= 1e8)) {
    return { error: 'ราคาต่อหน่วยไม่ถูกต้อง' };
  }
  if (raw.expire_date && !row.expireDate) return { error: 'วันหมดอายุไม่ถูกต้อง' };
  if (typeof row.isReturnable !== 'boolean') return { error: 'ช่อง "ต้องคืน" ต้องเป็น ใช่ ไม่ หรือเว้นว่าง' };

  return { row };
}

// คืน { rows } หรือ { errors: [{ row, code, message }] } แถวนับจาก 1 ตามลำดับ item ที่ส่งมา
export function validateImportRows(rawItems) {
  const rows = [];
  const errors = [];
  const seenCodes = new Map();

  rawItems.forEach((raw, index) => {
    const rowNumber = index + 1;
    const { row, error } = parseRow(raw);

    if (error) {
      errors.push({ row: rowNumber, code: text(raw?.material_code) || null, message: error });
      return;
    }
    if (seenCodes.has(row.code)) {
      errors.push({ row: rowNumber, code: row.code, message: `รหัสซ้ำกับแถว ${seenCodes.get(row.code)} ในไฟล์เดียวกัน` });
      return;
    }

    seenCodes.set(row.code, rowNumber);
    rows.push(row);
  });

  return errors.length > 0 ? { errors } : { rows };
}

export async function importMaterials(rows) {
  try {
    const existingCodes = new Set(
      await materialImportRepository.findExistingCodes(rows.map((row) => row.code)),
    );
    const toCreate = rows.filter((row) => !existingCodes.has(row.code));
    const skipped = rows.filter((row) => existingCodes.has(row.code)).map((row) => row.code);

    const categoryNames = [...new Set(toCreate.map((row) => row.categoryName))];
    const categoriesCreated = await equipmentImportRepository.ensureCategories(categoryNames);
    const categoryIds = await equipmentImportRepository.findCategoryIdsByName(categoryNames);

    let created = 0;
    for (let start = 0; start < toCreate.length; start += CHUNK_SIZE) {
      const chunk = toCreate
        .slice(start, start + CHUNK_SIZE)
        .map((row) => ({ ...row, categoryId: categoryIds.get(row.categoryName) }));
      created += await materialImportRepository.createMany(chunk);
    }

    return { created, skipped, categories_created: categoriesCreated };
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error.code === 'P2002') {
      throw new AppError(409, 'มีรหัสวัสดุถูกเพิ่มเข้าระบบระหว่างนำเข้า กรุณากดนำเข้าไฟล์เดิมอีกครั้ง (รายการที่เข้าไปแล้วจะถูกข้าม)');
    }

    throw new AppError(500, 'นำเข้าวัสดุไม่สำเร็จ กรุณากดนำเข้าไฟล์เดิมอีกครั้ง (รายการที่เข้าไปแล้วจะถูกข้าม)', { cause: error });
  }
}
