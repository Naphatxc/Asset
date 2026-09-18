// Data Access Layer สำหรับ equipment / equipment_items — ทุกฟังก์ชันรับ Prisma transaction client ได้ (default = prisma)
import { prisma } from '../../config/prisma.js';

export const equipmentInclude = {
  equipment: {
    include: {
      categories: true,
      locations: true,
    },
  },
};

//แบ่งหน้า (page/limit) + ค้นหารหัส/ชื่อ + กรองสถานะ แทนที่จะดึงมาทั้งหมดทีเดียว
function buildListWhere({ deleted, search, status }) {
  return {
    deleted_at: deleted ? { not: null } : null,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { equipment_code: { contains: search } },
            { equipment_name: { contains: search } },
          ],
        }
      : {}),
  };
}

export async function findManyActive(
  { page = 1, limit = 20, search, status } = {},
  client = prisma,
) {
  const where = buildListWhere({ deleted: false, search, status });
  const [items, total] = await Promise.all([
    client.equipment_items.findMany({
      where,
      include: equipmentInclude,
      orderBy: { item_id: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    client.equipment_items.count({ where }),
  ]);

  return { items, total };
}

export async function findManyDeleted(
  { page = 1, limit = 20, search, status } = {},
  client = prisma,
) {
  const where = buildListWhere({ deleted: true, search, status });
  const [items, total] = await Promise.all([
    client.equipment_items.findMany({
      where,
      include: equipmentInclude,
      orderBy: { deleted_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    client.equipment_items.count({ where }),
  ]);

  return { items, total };
}

// หาตัวเลขสูงสุดที่เคยใช้กับ prefix นี้ (นับรวมของที่ถูก soft-delete ไปแล้วด้วย เพราะ equipment_code unique
// ทั้งตาราง ไม่ได้ยกเว้นแถวที่ลบ) ใช้ออกรหัสตัวถัดไปเป็น prefix-เลข+1 ตอนสร้างครุภัณฑ์ใหม่
export async function findMaxCodeNumberByPrefix(prefix, client = prisma) {
  const rows = await client.equipment_items.findMany({
    where: { equipment_code: { startsWith: `${prefix}-` } },
    select: { equipment_code: true },
  });

  return rows.reduce((max, row) => {
    const suffix = row.equipment_code.slice(prefix.length + 1);
    const number = Number(suffix);

    return Number.isInteger(number) && number > max ? number : max;
  }, 0);
}

export async function findByCode(equipmentCode, client = prisma) {
  return client.equipment_items.findFirst({
    where: {
      equipment_code: equipmentCode,
      deleted_at: null,
    },
    include: equipmentInclude,
  });
}

export async function findByItemId(
  itemId,
  { includeDeleted = false, client = prisma } = {},
) {
  return client.equipment_items.findFirst({
    where: {
      item_id: itemId,
      ...(includeDeleted ? {} : { deleted_at: null }),
    },
    include: equipmentInclude,
  });
}

// ใช้ตอนเช็คความพร้อม/ล็อกครุภัณฑ์หลายชิ้นพร้อมกัน (borrow.service.js) เอาแบบ query เดียวแทนวนลูปทีละชิ้น
export async function findManyByItemIds(itemIds, client = prisma) {
  return client.equipment_items.findMany({
    where: { item_id: { in: itemIds } },
    select: { item_id: true, status: true, equipment_name: true },
  });
}

export async function updateManyStatus(itemIds, status, client = prisma) {
  return client.equipment_items.updateMany({
    where: { item_id: { in: itemIds } },
    data: { status },
  });
}

export async function existsById(itemId, client = prisma) {
  return client.equipment_items.findUnique({
    where: { item_id: itemId },
    select: { item_id: true },
  });
}

export async function createEquipmentDetails(data, client = prisma) {
  return client.equipment.create({ data });
}

export async function createEquipmentItem(data, client = prisma) {
  return client.equipment_items.create({ data });
}

export async function updateEquipmentDetails(
  equipmentId,
  data,
  client = prisma,
) {
  return client.equipment.update({
    where: { equipment_id: equipmentId },
    data,
  });
}

export async function updateEquipmentItem(itemId, data, client = prisma) {
  return client.equipment_items.update({
    where: { item_id: itemId },
    data,
  });
}

export async function softDelete(itemId, client = prisma) {
  return client.equipment_items.update({
    where: { item_id: itemId },
    data: { deleted_at: new Date() },
  });
}

export async function restore(itemId, client = prisma) {
  return client.equipment_items.update({
    where: { item_id: itemId },
    data: { deleted_at: null },
  });
}
