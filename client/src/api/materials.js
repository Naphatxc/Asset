// รวมคำสั่งติดต่อ Materials API ไว้ที่เดียว (เหมือน equipment.js) — หมวดหมู่ใช้ getCategories ร่วมกับ
// equipment.js เพราะ categories table ใช้ร่วมกันทั้งครุภัณฑ์และวัสดุ ไม่ต้องมี endpoint แยก
import { request } from './http.js';

function toListQueryString({ page, limit, search, categoryId } = {}) {
  const query = new URLSearchParams();

  if (page) query.set('page', page);
  if (limit) query.set('limit', limit);
  if (search) query.set('search', search);
  if (categoryId) query.set('category_id', categoryId);

  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

// กลุ่มอ่านข้อมูล (GET) — ทุก role เรียกได้
export function getMaterials(params) {
  return request(`/api/materials${toListQueryString(params)}`);
}

export function getDeletedMaterials(params) {
  return request(`/api/admin/materials/deleted${toListQueryString(params)}`);
}

export function getMaterialWithdrawals(params) {
  return request(`/api/admin/materials/withdrawals${toListQueryString(params)}`);
}

// เบิกวัสดุ — ทุก role ที่ login แล้วเรียกได้ ตัดยอดทันที ไม่ต้องรอ Admin อนุมัติ
export function withdrawMaterial(materialId, { quantity, remark }) {
  return request(`/api/materials/${materialId}/withdraw`, {
    method: 'POST',
    body: { quantity, remark },
  });
}

// กลุ่มคำสั่งของ Admin (Create/Update/Delete/Restore)
export function createMaterial(material) {
  return request('/api/admin/materials', {
    method: 'POST',
    body: material,
  });
}

export function updateMaterial(materialId, material) {
  return request(`/api/admin/materials/${materialId}`, {
    method: 'PATCH',
    body: material,
  });
}

export function deleteMaterial(materialId) {
  return request(`/api/admin/materials/${materialId}`, {
    method: 'DELETE',
  });
}

export function restoreMaterial(materialId) {
  return request(`/api/admin/materials/${materialId}/restore`, {
    method: 'PATCH',
  });
}
