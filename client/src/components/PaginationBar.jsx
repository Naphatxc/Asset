// แถบแบ่งหน้าใต้ตาราง ใช้ร่วมกันทุกแท็บให้หน้าตาเหมือนกัน รับ pagination รูปแบบเดียวกับที่ server คืน
// ({ page, limit, total, totalPages }) รายการที่แบ่งหน้าฝั่ง client ก็สร้างรูปแบบเดียวกันด้วย paginateRows
// แสดงแม้มีหน้าเดียว ผู้ใช้จะได้เห็นยอดรวมตำแหน่งเดิมทุกแท็บ ไม่ใช่โผล่บ้างหายบ้างตามจำนวนข้อมูล
import { useEffect } from 'react';

export const PAGE_SIZE = 20;

// สำหรับรายการที่แบ่งหน้าฝั่ง server ซึ่งไม่ดึง page กลับให้เอง: ถ้าหน้าที่ดูอยู่หายไป (เช่น ลบชิ้นสุดท้ายของ
// หน้าสุดท้าย) server จะคืนหน้าว่าง แล้ว UI โชว์ "ไม่มีรายการ" แบบไม่มีปุ่มเปลี่ยนหน้าให้กดกลับ จึงถอยไปหน้า
// สุดท้ายที่ยังมีข้อมูลให้เอง
export function useClampPage(pagination, setPage) {
  useEffect(() => {
    if (pagination && pagination.total > 0 && pagination.page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [pagination, setPage]);
}

// page ที่ขอเกินหน้าสุดท้ายถูกดึงกลับมา เช่น อนุมัติรายการสุดท้ายของหน้าสุดท้ายตอนกรองเฉพาะรออนุมัติอยู่
export function paginateRows(rows, page, limit = PAGE_SIZE) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return {
    rows: rows.slice((safePage - 1) * limit, safePage * limit),
    pagination: { page: safePage, limit, total, totalPages },
  };
}

export default function PaginationBar({ pagination, onPageChange }) {
  if (!pagination || pagination.total === 0) return null;

  const { page, limit, total, totalPages } = pagination;
  const rangeStart = (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);

  return (
    <div className="pagination-bar">
      <span className="pagination-summary">
        แสดง {rangeStart}-{rangeEnd} จาก {total} รายการ
      </span>
      <div className="pagination-controls">
        <button
          className="button-secondary"
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ก่อนหน้า
        </button>
        <span>
          หน้า {page} / {totalPages}
        </span>
        <button
          className="button-secondary"
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}
