// Business Logic สำหรับหน้า Dashboard — รวมข้อมูลจากหลายตารางให้เป็นรูปแบบเดียวที่ UI ใช้ต่อได้ทันที
import * as dashboardRepository from './dashboard.repository.js';
import { AppError } from '../../utils/AppError.js';

const EMPTY_STATUS_COUNTS = {
  available: 0,
  borrowed: 0,
  pending_repair: 0,
  repairing: 0,
  damaged: 0,
};

// รวม 3 แหล่ง (ยืมใหม่/คืนแล้ว/แจ้งซ่อม) เป็น Feed เดียว เรียงตามเวลาล่าสุดก่อน — แต่ละ query ดึงมาเกินจำนวน
// ที่จะโชว์จริงเล็กน้อยอยู่แล้ว (ดู dashboard.repository.js) พอผสมกันแล้วค่อยตัดเหลือ limit สุดท้ายอีกที
function buildRecentActivity({ recentBorrows, recentReturns, recentRepairs }, limit) {
  const combined = [
    ...recentBorrows.map((row) => ({
      type: 'borrow',
      occurred_at: row.occurred_at,
      actor_name: row.actor_name,
      equipment_name: row.equipment_name,
      item_count: Number(row.item_count),
      status: row.status,
    })),
    ...recentReturns.map((row) => ({
      type: 'return',
      occurred_at: row.occurred_at,
      actor_name: row.actor_name,
      equipment_name: row.equipment_name,
    })),
    ...recentRepairs.map((row) => ({
      type: 'repair',
      occurred_at: row.occurred_at,
      actor_name: row.actor_name,
      equipment_name: row.equipment_name,
      status: row.status,
    })),
  ];

  combined.sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  return combined.slice(0, limit);
}

export async function getDashboardSummary() {
  try {
    const [
      statusRows,
      userCount,
      monthlyRows,
      pendingBorrowCount,
      pendingRepairCount,
      overdueCount,
      overdueRows,
      recentBorrows,
      recentReturns,
      recentRepairs,
    ] = await Promise.all([
      dashboardRepository.countEquipmentByStatus(),
      dashboardRepository.countUsers(),
      dashboardRepository.countApprovedBorrowsByMonth(),
      dashboardRepository.countPendingBorrows(),
      dashboardRepository.countPendingRepairs(),
      dashboardRepository.countOverdueBorrows(),
      dashboardRepository.findOverdueBorrows(5),
      dashboardRepository.findRecentBorrows(5),
      dashboardRepository.findRecentReturns(5),
      dashboardRepository.findRecentRepairs(5),
    ]);

    const statusCounts = { ...EMPTY_STATUS_COUNTS };
    let totalEquipment = 0;

    for (const row of statusRows) {
      statusCounts[row.status] = row._count._all;
      totalEquipment += row._count._all;
    }

    // เติม 0 ให้ครบ 12 เดือนแม้เดือนไหนไม่มีข้อมูล เพื่อให้กราฟวาดง่ายฝั่ง client
    const monthlyBorrows = Array.from({ length: 12 }, (_, index) => {
      const found = monthlyRows.find((row) => Number(row.month) === index + 1);
      return found ? Number(found.count) : 0;
    });

    const overdueBorrows = overdueRows.map((row) => ({
      borrow_detail_id: Number(row.borrow_detail_id),
      equipment_code: row.equipment_code,
      equipment_name: row.equipment_name,
      borrower_name: row.borrower_name,
      return_date: row.return_date,
    }));

    const recentActivity = buildRecentActivity(
      { recentBorrows, recentReturns, recentRepairs },
      8,
    );

    return {
      totalEquipment,
      statusCounts,
      userCount,
      monthlyBorrows,
      pendingBorrowCount,
      pendingRepairCount,
      overdueCount,
      overdueBorrows,
      recentActivity,
    };
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดข้อมูลสรุป Dashboard ได้', {
      cause: error,
    });
  }
}
