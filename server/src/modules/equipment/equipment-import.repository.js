// Data Access Layer ของการนำเข้าครุภัณฑ์จากไฟล์ (equipment-import.service.js)
import { prisma } from '../../config/prisma.js';

// รวมรหัสที่ถูก soft-delete ด้วย เพราะ equipment_code unique ทั้งตาราง สร้างซ้ำไม่ได้อยู่ดี
export async function findExistingCodes(codes, client = prisma) {
  const rows = await client.equipment_items.findMany({
    where: { equipment_code: { in: codes } },
    select: { equipment_code: true },
  });
  return rows.map((row) => row.equipment_code.toUpperCase());
}

// สร้างหมวดหมู่ที่ยังไม่มี คืนรายชื่อที่สร้างใหม่ (category_name unique จึงใช้ skipDuplicates ได้)
export async function ensureCategories(names, client = prisma) {
  if (names.length === 0) return [];

  const existing = await client.categories.findMany({
    where: { category_name: { in: names } },
    select: { category_name: true },
  });
  const existingNames = new Set(existing.map((row) => row.category_name));
  const missing = names.filter((name) => !existingNames.has(name));

  if (missing.length > 0) {
    await client.categories.createMany({
      data: missing.map((name) => ({ category_name: name })),
      skipDuplicates: true,
    });
  }

  return missing;
}

export async function findCategoryIdsByName(names, client = prisma) {
  const rows = await client.categories.findMany({
    where: { category_name: { in: names } },
    select: { category_id: true, category_name: true },
  });
  return new Map(rows.map((row) => [row.category_name, row.category_id]));
}

// locations ไม่มี unique constraint จึงหา-หรือ-สร้างทีละรายการ (จำนวนสถานที่มีหลักสิบ ไม่ใช่หลักร้อย)
export async function ensureLocations(specs, keyOf, client = prisma) {
  const idsByKey = new Map();
  const created = [];

  for (const spec of specs) {
    const found = await client.locations.findFirst({
      where: { location_name: spec.name, room: spec.room },
      select: { location_id: true },
    });

    if (found) {
      idsByKey.set(keyOf(spec.name, spec.room), found.location_id);
      continue;
    }

    const location = await client.locations.create({
      data: { location_name: spec.name, building: spec.building, room: spec.room },
      select: { location_id: true },
    });
    idsByKey.set(keyOf(spec.name, spec.room), location.location_id);
    created.push(spec.room ? `${spec.name} · ห้อง ${spec.room}` : spec.name);
  }

  return { idsByKey, created };
}

// equipment 1 แถวคู่กับ equipment_items 1 แถวเสมอ (เหมือน createEquipment ใน equipment.service.js)
export async function createItem(row, client = prisma) {
  return client.equipment_items.create({
    data: {
      equipment_name: row.name,
      equipment_code: row.code,
      status: 'available',
      price: row.price,
      warranty_expire: row.warrantyExpire,
      equipment: {
        create: {
          equipment_name: row.name,
          category_id: row.categoryId,
          location_id: row.locationId,
          fiscal_year: row.fiscalYear,
          description: row.description,
          receive_date: row.receiveDate,
          remark: row.remark,
        },
      },
    },
    select: { item_id: true },
  });
}
