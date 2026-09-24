// นำเข้าครุภัณฑ์ทีละหลายร้อยชิ้นจากไฟล์ (ไฟล์ที่ได้จาก scripts/export-equipment.js หรือสร้างเองตามรูปแบบเดียวกัน)
// ใช้ย้ายข้อมูลจากเครื่อง dev ขึ้น production และนำเข้าครุภัณฑ์ชุดใหม่ภายหลัง
//
// - ตรวจทุกแถวก่อน ถ้ามีแถวไหนผิด ไม่นำเข้าเลยสักแถว แล้วบอกแถวที่ผิดกลับไป (แก้ไฟล์แล้วนำเข้าใหม่ได้)
// - รหัสที่มีในระบบอยู่แล้ว (รวมที่ถูกลบ เพราะรหัส unique ทั้งตาราง) ข้ามไป นำเข้าไฟล์เดิมซ้ำจึงไม่เกิดของซ้ำ
//   และถ้านำเข้าค้างกลางทางก็กดนำเข้าไฟล์เดิมซ้ำเพื่อทำต่อได้
// - หมวดหมู่/สถานที่จับคู่ด้วยชื่อ ไม่มีก็สร้างให้ (id ในไฟล์ไม่มีความหมายข้ามฐานข้อมูล)
// - ของที่นำเข้าเป็น "พร้อมใช้งาน" เสมอ สถานะยืม/ซ่อมผูกกับใบยืม/ใบซ่อมที่ไม่ได้ย้ายมาด้วย
import * as importRepository from './equipment-import.repository.js';
import * as equipmentHistoryRepository from './equipment-history.repository.js';
import { AppError } from '../../utils/AppError.js';
import { toDate } from '../../utils/parsing.js';
import { runSerializableTransaction } from '../../utils/transaction.js';
import {
  MAX_EQUIPMENT_CODE_LENGTH,
  MAX_EQUIPMENT_NAME_LENGTH,
  MAX_LONG_TEXT_LENGTH,
} from './equipment.validator.js';

const CHUNK_SIZE = 100;
// ต้องตรงกับ @db.VarChar(...) ของ categories/locations ใน schema.prisma
const MAX_CATEGORY_NAME_LENGTH = 100;
const MAX_LOCATION_NAME_LENGTH = 100;
const MAX_BUILDING_LENGTH = 100;
const MAX_ROOM_LENGTH = 30;

function text(value) {
  return value == null ? '' : String(value).trim();
}

function optionalText(value) {
  return text(value) || null;
}

// แปลง + ตรวจหนึ่งแถว คืน { row } หรือ { error } (ข้อความเดียวต่อแถว พอให้แก้ไฟล์ได้ถูกจุด)
function parseRow(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'ข้อมูลแถวไม่ถูกต้อง' };

  const row = {
    code: text(raw.equipment_code).toUpperCase(),
    name: text(raw.equipment_name),
    categoryName: text(raw.category_name),
    locationName: optionalText(raw.location_name),
    building: optionalText(raw.location_building),
    room: optionalText(raw.location_room),
    fiscalYear: raw.fiscal_year == null || raw.fiscal_year === '' ? null : Number(raw.fiscal_year),
    description: optionalText(raw.description),
    receiveDate: raw.receive_date ? toDate(raw.receive_date) : null,
    remark: optionalText(raw.remark),
    price: raw.price == null || raw.price === '' ? null : Number(raw.price),
    warrantyExpire: raw.warranty_expire ? toDate(raw.warranty_expire) : null,
  };

  if (!row.code) return { error: 'ไม่มีรหัสครุภัณฑ์' };
  if (row.code.length > MAX_EQUIPMENT_CODE_LENGTH) return { error: `รหัสยาวเกิน ${MAX_EQUIPMENT_CODE_LENGTH} ตัวอักษร` };
  if (!row.name) return { error: 'ไม่มีชื่อครุภัณฑ์' };
  if (row.name.length > MAX_EQUIPMENT_NAME_LENGTH) return { error: `ชื่อยาวเกิน ${MAX_EQUIPMENT_NAME_LENGTH} ตัวอักษร` };
  if (!row.categoryName) return { error: 'ไม่มีหมวดหมู่' };
  if (row.categoryName.length > MAX_CATEGORY_NAME_LENGTH) return { error: `ชื่อหมวดหมู่ยาวเกิน ${MAX_CATEGORY_NAME_LENGTH} ตัวอักษร` };
  if (!row.description) return { error: 'ไม่มีรายละเอียด' };
  if (row.description.length > MAX_LONG_TEXT_LENGTH) return { error: `รายละเอียดยาวเกิน ${MAX_LONG_TEXT_LENGTH} ตัวอักษร` };
  if (row.remark && row.remark.length > MAX_LONG_TEXT_LENGTH) return { error: `คุณสมบัติยาวเกิน ${MAX_LONG_TEXT_LENGTH} ตัวอักษร` };
  if (!row.locationName && (row.building || row.room)) return { error: 'มีอาคาร/ห้อง แต่ไม่มีชื่อสถานที่' };
  if (row.locationName && row.locationName.length > MAX_LOCATION_NAME_LENGTH) return { error: `ชื่อสถานที่ยาวเกิน ${MAX_LOCATION_NAME_LENGTH} ตัวอักษร` };
  if (row.building && row.building.length > MAX_BUILDING_LENGTH) return { error: `ชื่ออาคารยาวเกิน ${MAX_BUILDING_LENGTH} ตัวอักษร` };
  if (row.room && row.room.length > MAX_ROOM_LENGTH) return { error: `เลขห้องยาวเกิน ${MAX_ROOM_LENGTH} ตัวอักษร` };
  if (row.fiscalYear !== null && (!Number.isInteger(row.fiscalYear) || row.fiscalYear < 1901 || row.fiscalYear > 2155)) {
    return { error: 'ปีงบประมาณไม่ถูกต้อง (ต้องเป็น ค.ศ. 1901–2155)' };
  }
  if (row.price !== null && (Number.isNaN(row.price) || row.price < 0 || row.price >= 1e8)) {
    return { error: 'ราคาไม่ถูกต้อง' };
  }
  if (raw.receive_date && !row.receiveDate) return { error: 'วันที่รับไม่ถูกต้อง' };
  if (raw.warranty_expire && !row.warrantyExpire) return { error: 'วันหมดประกันไม่ถูกต้อง' };

  return { row };
}

// คืน { rows } หรือ { errors: [{ row, code, message }] } แถวนับจาก 1 ให้ตรงกับที่คนเปิดดูไฟล์
export function validateImportRows(rawItems) {
  const rows = [];
  const errors = [];
  const seenCodes = new Map();

  rawItems.forEach((raw, index) => {
    const rowNumber = index + 1;
    const { row, error } = parseRow(raw);

    if (error) {
      errors.push({ row: rowNumber, code: text(raw?.equipment_code) || null, message: error });
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

function locationKey(name, room) {
  return `${name}|${room ?? ''}`;
}

export async function importEquipment(rows, actorId) {
  try {
    const existingCodes = new Set(await importRepository.findExistingCodes(rows.map((row) => row.code)));
    const toCreate = rows.filter((row) => !existingCodes.has(row.code));
    const skipped = rows.filter((row) => existingCodes.has(row.code)).map((row) => row.code);

    const categoryNames = [...new Set(toCreate.map((row) => row.categoryName))];
    const categoriesCreated = await importRepository.ensureCategories(categoryNames);
    const categoryIds = await importRepository.findCategoryIdsByName(categoryNames);

    // สถานที่จับคู่ด้วยชื่อ + เลขห้อง (ชื่อเดียวกันคนละห้องถือเป็นคนละสถานที่ เหมือนที่ dropdown แสดง)
    const locationSpecs = new Map();
    for (const row of toCreate) {
      if (row.locationName) {
        locationSpecs.set(locationKey(row.locationName, row.room), {
          name: row.locationName,
          building: row.building,
          room: row.room,
        });
      }
    }
    const { idsByKey: locationIds, created: locationsCreated } =
      await importRepository.ensureLocations([...locationSpecs.values()], locationKey);

    let created = 0;
    for (let start = 0; start < toCreate.length; start += CHUNK_SIZE) {
      const chunk = toCreate.slice(start, start + CHUNK_SIZE);

      await runSerializableTransaction(async (tx) => {
        const history = [];

        for (const row of chunk) {
          const item = await importRepository.createItem(
            {
              ...row,
              categoryId: categoryIds.get(row.categoryName),
              locationId: row.locationName ? locationIds.get(locationKey(row.locationName, row.room)) : null,
            },
            tx,
          );

          history.push({
            itemId: item.item_id,
            action: 'created',
            newData: { source: 'import', equipment_code: row.code, equipment_name: row.name },
            changedBy: actorId,
          });
        }

        await equipmentHistoryRepository.createMany(history, tx);
      });

      created += chunk.length;
    }

    return {
      created,
      skipped,
      categories_created: categoriesCreated,
      locations_created: locationsCreated,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error.code === 'P2002') {
      throw new AppError(409, 'มีรหัสครุภัณฑ์ถูกเพิ่มเข้าระบบระหว่างนำเข้า กรุณากดนำเข้าไฟล์เดิมอีกครั้ง (รายการที่เข้าไปแล้วจะถูกข้าม)');
    }

    throw new AppError(500, 'นำเข้าครุภัณฑ์ไม่สำเร็จ กรุณากดนำเข้าไฟล์เดิมอีกครั้ง (รายการที่เข้าไปแล้วจะถูกข้าม)', { cause: error });
  }
}
