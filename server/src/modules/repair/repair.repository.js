// Data Access Layer สำหรับ repairs / repair_files — ทุกฟังก์ชันรับ Prisma transaction client ได้ (default = prisma)
import { prisma } from '../../config/prisma.js';

export const repairInclude = {
  users: true,
  equipment_items: true,
  repair_files: true,
};

export async function findMany({ status, itemId, reportedBy } = {}, client = prisma) {
  return client.repairs.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(itemId ? { item_id: itemId } : {}),
      ...(reportedBy ? { reported_by: reportedBy } : {}),
    },
    include: repairInclude,
    orderBy: { repair_id: 'desc' },
  });
}

export async function findById(repairId, client = prisma) {
  return client.repairs.findUnique({
    where: { repair_id: repairId },
    include: repairInclude,
  });
}

export async function create(data, client = prisma) {
  return client.repairs.create({ data });
}

// ใช้เช็คก่อนแก้ไข/ลบครุภัณฑ์โดยตรง (equipment.service.js) ว่ามีใบซ่อมที่ยังไม่ปิดงานค้างอยู่ไหม
export async function findActiveByItemId(itemId, client = prisma) {
  return client.repairs.findFirst({
    where: { item_id: itemId, status: { in: ['pending_repair', 'repairing'] } },
  });
}

export async function update(repairId, data, client = prisma) {
  return client.repairs.update({
    where: { repair_id: repairId },
    data,
  });
}

export async function createFiles(files, client = prisma) {
  if (files.length === 0) return;
  return client.repair_files.createMany({ data: files });
}

export async function findFileById(fileId, client = prisma) {
  return client.repair_files.findUnique({
    where: { file_id: fileId },
    include: { repairs: { select: { reported_by: true } } },
  });
}
