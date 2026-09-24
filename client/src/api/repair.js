// รวมคำสั่งติดต่อ Repair API — แจ้งซ่อม/ดูของตัวเองผ่าน /api/repairs (ทุก role) ส่วนจัดการสถานะอยู่ใต้ /api/admin/repairs
import { apiUrl, request } from './http.js';

export function getRepairs({ status, itemId } = {}) {
  const query = new URLSearchParams();
  if (status) query.set('status', status);
  if (itemId) query.set('item_id', itemId);

  const qs = query.toString();
  return request(`/api/admin/repairs${qs ? `?${qs}` : ''}`);
}

export function getMyRepairs() {
  return request('/api/repairs/mine');
}

// mine: ดูผ่าน route ฝั่ง User ซึ่ง server จำกัดให้เห็นเฉพาะรายการที่ตัวเองแจ้ง
export function getRepairDetail(repairId, { mine = false } = {}) {
  return request(`/api${mine ? '' : '/admin'}/repairs/${repairId}`);
}

// files มาจาก <input type="file" multiple> ส่งเป็น multipart/form-data
export function reportRepair({ itemId, issue, files = [] }) {
  const formData = new FormData();
  formData.append('item_id', itemId);
  formData.append('issue', issue);
  files.forEach((file) => formData.append('files', file));

  return request('/api/repairs', { method: 'POST', body: formData });
}

export function addRepairFiles(repairId, files) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  return request(`/api/admin/repairs/${repairId}/files`, {
    method: 'POST',
    body: formData,
  });
}

export function startRepair(repairId) {
  return request(`/api/admin/repairs/${repairId}/start`, { method: 'PATCH' });
}

export function completeRepair(repairId, { repairDetail, repairCost }) {
  return request(`/api/admin/repairs/${repairId}/complete`, {
    method: 'PATCH',
    body: { repair_detail: repairDetail, repair_cost: repairCost },
  });
}

export function cancelRepair(repairId) {
  return request(`/api/admin/repairs/${repairId}/cancel`, { method: 'PATCH' });
}

// ลิงก์ตรงไปที่ server (ไม่ผ่าน axios) เปิดแท็บใหม่ได้เลย เพราะ cookie เป็น SameSite=Lax
// จึงแนบไปกับ top-level navigation แบบนี้โดยอัตโนมัติ
export function getRepairFileUrl(fileId, { mine = false } = {}) {
  return `${apiUrl}/api${mine ? '' : '/admin'}/repairs/files/${fileId}`;
}
