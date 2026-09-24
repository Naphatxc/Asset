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

// นับเฉพาะใบยืมที่อนุมัติแล้ว (สะท้อนการยืมที่เกิดขึ้นจริง) แยกตามเดือน รวมทุกปี
export async function countApprovedBorrowsByMonth(client = prisma) {
  return client.$queryRaw`
    SELECT MONTH(borrow_date) AS month, COUNT(*) AS count
    FROM borrows
    WHERE status = 'approved'
    GROUP BY MONTH(borrow_date)
  `;
}

export async function countPendingBorrows(client = prisma) {
  return client.borrows.count({ where: { status: 'pending' } });
}

export async function countPendingRepairs(client = prisma) {
  return client.repairs.count({ where: { status: 'pending_repair' } });
}

// เกณฑ์ "เลยกำหนดคืน" ต้องตรงกับ utils/dueDate.js (isPastDueDate): return_date เก็บเป็นเที่ยงคืน UTC ของ
// วันครบกำหนด แต่ผู้ใช้อยู่ไทย (UTC+7) จึงยังไม่เกินกำหนดจนกว่าจะถึงเที่ยงคืนไทย = return_date + 17 ชม. UTC
export async function countOverdueBorrows(client = prisma) {
  const rows = await client.$queryRaw`
    SELECT COUNT(*) AS count
    FROM borrow_details bd
    JOIN borrows b ON b.borrow_id = bd.borrow_id
    WHERE b.status = 'approved'
      AND bd.returned_at IS NULL
      AND bd.return_requested_at IS NULL
      AND bd.return_date < DATE_SUB(NOW(), INTERVAL 17 HOUR)
  `;

  return Number(rows[0]?.count ?? 0);
}

export async function findOverdueBorrows(limit, client = prisma) {
  return client.$queryRaw`
    SELECT bd.borrow_detail_id AS borrow_detail_id, bd.return_date AS return_date,
           ei.equipment_code AS equipment_code, ei.equipment_name AS equipment_name,
           u.name AS borrower_name
    FROM borrow_details bd
    JOIN borrows b ON b.borrow_id = bd.borrow_id
    JOIN equipment_items ei ON ei.item_id = bd.item_id
    JOIN users u ON u.user_id = b.user_id
    WHERE b.status = 'approved'
      AND bd.returned_at IS NULL
      AND bd.return_requested_at IS NULL
      AND bd.return_date < DATE_SUB(NOW(), INTERVAL 17 HOUR)
    ORDER BY bd.return_date ASC
    LIMIT ${limit}
  `;
}

// วัสดุที่ต้องคืนแต่เลยกำหนด (เกณฑ์เดียวกับครุภัณฑ์ด้านบน) นับเป็นใบเบิก ไม่ใช่จำนวนชิ้น
export async function countOverdueMaterialWithdrawals(client = prisma) {
  const rows = await client.$queryRaw`
    SELECT COUNT(*) AS count
    FROM material_withdrawals mw
    WHERE mw.due_date IS NOT NULL
      AND mw.returned_at IS NULL
      AND mw.due_date < DATE_SUB(NOW(), INTERVAL 17 HOUR)
  `;

  return Number(rows[0]?.count ?? 0);
}

export async function findOverdueMaterialWithdrawals(limit, client = prisma) {
  return client.$queryRaw`
    SELECT mw.withdrawal_id AS withdrawal_id, mw.due_date AS due_date,
           mw.quantity - mw.returned_quantity AS outstanding_quantity,
           m.material_code AS material_code, m.material_name AS material_name,
           m.unit_name AS unit_name, u.name AS borrower_name
    FROM material_withdrawals mw
    JOIN materials m ON m.material_id = mw.material_id
    JOIN users u ON u.user_id = mw.user_id
    WHERE mw.due_date IS NOT NULL
      AND mw.returned_at IS NULL
      AND mw.due_date < DATE_SUB(NOW(), INTERVAL 17 HOUR)
    ORDER BY mw.due_date ASC
    LIMIT ${limit}
  `;
}

// สามแหล่งด้านล่างรวมกันเป็น Feed "กิจกรรมล่าสุด" ที่ service.js เอาไปเรียงตามเวลาอีกที (แต่ละ query จำกัด
// จำนวนไว้ก่อน กัน query หนักตอนข้อมูลเยอะ แทนที่จะดึงมาทั้งหมดแล้วมาเรียง/ตัดทีหลัง)
export async function findRecentBorrows(limit, client = prisma) {
  return client.$queryRaw`
    SELECT b.borrow_date AS occurred_at, b.status AS status, u.name AS actor_name,
           (SELECT ei.equipment_name FROM borrow_details bd2
              JOIN equipment_items ei ON ei.item_id = bd2.item_id
              WHERE bd2.borrow_id = b.borrow_id
              ORDER BY bd2.borrow_detail_id ASC LIMIT 1) AS equipment_name,
           (SELECT COUNT(*) FROM borrow_details bd3 WHERE bd3.borrow_id = b.borrow_id) AS item_count
    FROM borrows b
    JOIN users u ON u.user_id = b.user_id
    ORDER BY b.borrow_date DESC
    LIMIT ${limit}
  `;
}

export async function findRecentReturns(limit, client = prisma) {
  return client.$queryRaw`
    SELECT bd.returned_at AS occurred_at, ei.equipment_name AS equipment_name, u.name AS actor_name
    FROM borrow_details bd
    JOIN borrows b ON b.borrow_id = bd.borrow_id
    JOIN equipment_items ei ON ei.item_id = bd.item_id
    JOIN users u ON u.user_id = b.user_id
    WHERE bd.returned_at IS NOT NULL
    ORDER BY bd.returned_at DESC
    LIMIT ${limit}
  `;
}

export async function findRecentRepairs(limit, client = prisma) {
  return client.$queryRaw`
    SELECT r.repair_date AS occurred_at, r.status AS status,
           ei.equipment_name AS equipment_name, u.name AS actor_name
    FROM repairs r
    JOIN equipment_items ei ON ei.item_id = r.item_id
    JOIN users u ON u.user_id = r.reported_by
    ORDER BY r.repair_date DESC
    LIMIT ${limit}
  `;
}
