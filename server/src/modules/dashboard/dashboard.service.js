// Business Logic สำหรับหน้า Dashboard — รวมข้อมูลจากหลายตารางให้เป็นรูปแบบเดียวที่ UI ใช้ต่อได้ทันที
import * as dashboardRepository from './dashboard.repository.js';
import { AppError } from '../../utils/AppError.js';

const EMPTY_STATUS_COUNTS = {
  available: 0,
  borrowed: 0,
  pending_repair: 0,
  repairing: 0,
};

export async function getDashboardSummary(year) {
  try {
    const [statusRows, userCount, monthlyRows, topItemsRows] = await Promise.all([
      dashboardRepository.countEquipmentByStatus(),
      dashboardRepository.countUsers(),
      dashboardRepository.countApprovedBorrowsByMonth(year),
      dashboardRepository.findTopBorrowedItems(5),
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

    const topBorrowedItems = topItemsRows.map((row) => ({
      item_id: Number(row.item_id),
      equipment_code: row.equipment_code,
      equipment_name: row.equipment_name,
      borrow_count: Number(row.borrow_count),
    }));

    return {
      year,
      totalEquipment,
      statusCounts,
      userCount,
      monthlyBorrows,
      topBorrowedItems,
    };
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดข้อมูลสรุป Dashboard ได้', {
      cause: error,
    });
  }
}
