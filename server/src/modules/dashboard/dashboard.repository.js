// Data Access Layer สำหรับสรุปข้อมูลหน้า Dashboard (นับ/รวมข้อมูล ไม่มี business logic)
import { prisma } from '../../config/prisma.js';

export async function countEquipmentByStatus(client = prisma) {
  return client.equipment_items.groupBy({
    by: ['status'],
    where: { deleted_at: null },
    _count: { _all: true },
  });
}

export async function countUsers(client = prisma) {
  return client.users.count();
}

// นับเฉพาะใบยืมที่อนุมัติแล้ว (สะท้อนการยืมที่เกิดขึ้นจริง) แยกตามเดือนของปีที่ระบุ
export async function countApprovedBorrowsByMonth(year, client = prisma) {
  return client.$queryRaw`
    SELECT MONTH(borrow_date) AS month, COUNT(*) AS count
    FROM borrows
    WHERE status = 'approved' AND YEAR(borrow_date) = ${year}
    GROUP BY MONTH(borrow_date)
  `;
}

export async function findTopBorrowedItems(limit, client = prisma) {
  return client.$queryRaw`
    SELECT bd.item_id AS item_id, ei.equipment_code AS equipment_code,
           ei.equipment_name AS equipment_name, COUNT(*) AS borrow_count
    FROM borrow_details bd
    JOIN borrows b ON b.borrow_id = bd.borrow_id
    JOIN equipment_items ei ON ei.item_id = bd.item_id
    WHERE b.status = 'approved'
    GROUP BY bd.item_id, ei.equipment_code, ei.equipment_name
    ORDER BY borrow_count DESC
    LIMIT ${limit}
  `;
}
