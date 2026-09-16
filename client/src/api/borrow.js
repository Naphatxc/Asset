// รวมคำสั่งติดต่อ Borrow API — getBorrows/createBorrow/approveBorrow/rejectBorrow สงวนให้ Admin
// ส่วน getMyBorrows/requestBorrow/returnBorrowDetail ผู้ใช้ทุกคนเรียกได้ (คืนของตัวเอง หรือ Admin คืนแทนใครก็ได้ เช็คสิทธิ์ที่ server)
import { request } from './http.js';

export function getBorrows() {
  return request('/api/admin/borrows');
}

export function getMyBorrows() {
  return request('/api/borrows/mine');
}

// Admin สร้างใบยืมแทนผู้ใช้ ถือว่าอนุมัติทันที
export function createBorrow({ userId, returnDate, itemIds }) {
  return request('/api/admin/borrows', {
    method: 'POST',
    body: { user_id: userId, return_date: returnDate, item_ids: itemIds },
  });
}

export function approveBorrow(borrowId) {
  return request(`/api/admin/borrows/${borrowId}/approve`, {
    method: 'PATCH',
  });
}

export function rejectBorrow(borrowId) {
  return request(`/api/admin/borrows/${borrowId}/reject`, {
    method: 'PATCH',
  });
}

// ส่งคำขอยืมให้ตัวเอง — ไม่ส่ง user_id เพราะ server ใช้ตัวตนจาก cookie เสมอ รอ Admin อนุมัติก่อนถึงจะยืมได้จริง
export function requestBorrow({ returnDate, itemIds }) {
  return request('/api/borrows', {
    method: 'POST',
    body: { return_date: returnDate, item_ids: itemIds },
  });
}

export function returnBorrowDetail(borrowDetailId) {
  return request(`/api/borrows/details/${borrowDetailId}/return`, {
    method: 'PATCH',
  });
}
