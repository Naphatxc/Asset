// Data Access Layer สำหรับ borrows / borrow_details — ทุกฟังก์ชันรับ Prisma transaction client ได้ (default = prisma)
import { prisma } from '../../config/prisma.js';

export const borrowInclude = {
  users: true,
  borrow_details: {
    include: { equipment_items: true },
  },
};

export async function findMany(client = prisma) {
  return client.borrows.findMany({
    include: borrowInclude,
    orderBy: { borrow_id: 'desc' },
  });
}

export async function findManyByUserId(userId, client = prisma) {
  return client.borrows.findMany({
    where: { user_id: userId },
    include: borrowInclude,
    orderBy: { borrow_id: 'desc' },
  });
}

export async function findById(borrowId, client = prisma) {
  return client.borrows.findUnique({
    where: { borrow_id: borrowId },
    include: borrowInclude,
  });
}

export async function create(data, client = prisma) {
  return client.borrows.create({ data });
}

export async function createDetail(data, client = prisma) {
  return client.borrow_details.create({ data });
}

// สร้างหลายแถวรวดเดียว (ใบยืมที่มีครุภัณฑ์หลายชิ้น) แทนวน create ทีละชิ้น
export async function createManyDetails(details, client = prisma) {
  if (details.length === 0) return;

  return client.borrow_details.createMany({ data: details });
}

// include borrows ไว้เพื่อให้ service เช็ค user_id เจ้าของใบยืมได้ตอนคืนเอง (ไม่ใช่ Admin)
export async function findDetailById(borrowDetailId, client = prisma) {
  return client.borrow_details.findUnique({
    where: { borrow_detail_id: borrowDetailId },
    include: { borrows: true },
  });
}

// ผู้ยืมกดคืนเอง -> รอ Admin ยืนยันก่อนถึงจะถือว่าคืนจริง
export async function requestReturn(borrowDetailId, client = prisma) {
  return client.borrow_details.update({
    where: { borrow_detail_id: borrowDetailId },
    data: { return_requested_at: new Date() },
  });
}

// ใช้เช็คก่อนแก้ไข/ลบครุภัณฑ์โดยตรง (equipment.service.js) ว่ามีใบยืมที่ยังไม่คืนค้างอยู่ไหม
// นับเฉพาะใบยืมที่ approved แล้วเท่านั้น เพราะ pending/rejected ไม่เคยล็อกสถานะครุภัณฑ์ไว้
export async function findOpenDetailByItemId(itemId, client = prisma) {
  return client.borrow_details.findFirst({
    where: { item_id: itemId, returned_at: null, borrows: { status: 'approved' } },
  });
}

export async function markReturned(borrowDetailId, client = prisma) {
  return client.borrow_details.update({
    where: { borrow_detail_id: borrowDetailId },
    data: { returned_at: new Date() },
  });
}

export async function updateStatus(borrowId, status, client = prisma) {
  return client.borrows.update({
    where: { borrow_id: borrowId },
    data: { status },
  });
}
