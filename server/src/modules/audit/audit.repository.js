// Data Access Layer สำหรับ audit_rounds / audit_records — ทุกฟังก์ชันรับ Prisma transaction client ได้ (default = prisma)
import { prisma } from '../../config/prisma.js';

const roundInclude = {
  opened_user: { select: { name: true } },
  closed_user: { select: { name: true } },
};

// ข้อมูลที่หน้าสแกน/สรุปต้องใช้ต่อหนึ่งแถว — status/ห้องปัจจุบันดึงสดจากครุภัณฑ์ ไม่ได้ snapshot ไว้
export const recordInclude = {
  equipment_items: {
    select: {
      equipment_code: true,
      equipment_name: true,
      status: true,
      deleted_at: true,
      equipment: {
        select: {
          location_id: true,
          categories: { select: { category_name: true } },
        },
      },
    },
  },
  repairs: { select: { status: true } },
  users: { select: { name: true } },
};

export async function findOpenRound(client = prisma) {
  return client.audit_rounds.findFirst({
    where: { status: 'open' },
    include: roundInclude,
  });
}

export async function findRounds(client = prisma) {
  return client.audit_rounds.findMany({
    include: roundInclude,
    orderBy: { round_id: 'desc' },
  });
}

export async function findRoundById(roundId, client = prisma) {
  return client.audit_rounds.findUnique({
    where: { round_id: roundId },
    include: roundInclude,
  });
}

export async function createRound(data, client = prisma) {
  return client.audit_rounds.create({ data });
}

export async function updateRound(roundId, data, client = prisma) {
  return client.audit_rounds.update({
    where: { round_id: roundId },
    data,
  });
}

// นับยอดแต่ละผลของทุกรอบในคราวเดียว ใช้ทำตัวเลขในหน้ารายการรอบ
export async function countRecordsByRound(client = prisma) {
  return client.audit_records.groupBy({
    by: ['round_id', 'result', 'closing_outcome'],
    _count: { _all: true },
  });
}

// ครุภัณฑ์ทุกชิ้นที่ยังไม่ถูกลบ ณ ตอนเปิดรอบ พร้อมห้องตอนนั้น ใช้สร้างรายการที่ต้องตรวจ
export async function findActiveItemsForSnapshot(client = prisma) {
  return client.equipment_items.findMany({
    where: { deleted_at: null },
    select: { item_id: true, equipment: { select: { location_id: true } } },
  });
}

// ตัดสินผลของชิ้นที่ไม่ได้ตรวจตอนปิดรอบ เรียงจากกรณีเฉพาะไปกรณีทั่วไป แต่ละขั้นแตะเฉพาะแถวที่ยังไม่มีผล
// ขั้นสุดท้ายจึงเหลือแต่ชิ้นที่ไม่ได้ถูกลบ/ยืม/ซ่อม ซึ่งก็คือ "ไม่พบ" จริงๆ
export async function settleUncheckedRecords(roundId, client = prisma) {
  const unsettled = { round_id: roundId, result: null, closing_outcome: null };
  const steps = [
    ['deleted', { deleted_at: { not: null } }],
    ['borrowed', { status: 'borrowed' }],
    ['in_repair', { status: { in: ['pending_repair', 'repairing'] } }],
    ['missing', null],
  ];

  for (const [outcome, itemFilter] of steps) {
    await client.audit_records.updateMany({
      where: itemFilter ? { ...unsettled, equipment_items: itemFilter } : unsettled,
      data: { closing_outcome: outcome },
    });
  }
}

// แถวที่การตรวจไปเปลี่ยนข้อมูลจริงไว้ (ย้ายห้อง/เปลี่ยนเป็นชำรุด/เปิดใบซ่อมของรอบเก่า) ใช้ย้อนคืนตอนยกเลิกทั้งรอบ
export async function findRecordsWithEffects(roundId, client = prisma) {
  return client.audit_records.findMany({
    where: {
      round_id: roundId,
      OR: [{ location_moved: true }, { marked_damaged: true }, { repair_id: { not: null } }],
    },
    select: {
      item_id: true,
      location_moved: true,
      moved_from_location_id: true,
      repair_id: true,
      marked_damaged: true,
      repairs: { select: { status: true } },
      equipment_items: {
        select: {
          status: true,
          deleted_at: true,
          equipment: { select: { equipment_id: true, location_id: true } },
        },
      },
    },
  });
}

export async function cancelRepairs(repairIds, client = prisma) {
  return client.repairs.updateMany({
    where: { repair_id: { in: repairIds } },
    data: { status: 'cancelled' },
  });
}

export async function setEquipmentLocation(equipmentIds, locationId, client = prisma) {
  return client.equipment.updateMany({
    where: { equipment_id: { in: equipmentIds } },
    data: { location_id: locationId },
  });
}

export async function deleteRound(roundId, client = prisma) {
  await client.audit_records.deleteMany({ where: { round_id: roundId } });
  return client.audit_rounds.delete({ where: { round_id: roundId } });
}

export async function createRecords(records, client = prisma) {
  if (records.length === 0) return;
  return client.audit_records.createMany({ data: records });
}

export async function findRecordsByRound(roundId, client = prisma) {
  return client.audit_records.findMany({
    where: { round_id: roundId },
    include: recordInclude,
    orderBy: { item_id: 'asc' },
  });
}

export async function findRecord(roundId, itemId, client = prisma) {
  return client.audit_records.findUnique({
    where: { round_id_item_id: { round_id: roundId, item_id: itemId } },
    include: recordInclude,
  });
}

export async function createRecord(data, client = prisma) {
  return client.audit_records.create({ data });
}

export async function updateRecord(recordId, data, client = prisma) {
  return client.audit_records.update({
    where: { record_id: recordId },
    data,
  });
}
