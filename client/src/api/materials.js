// รวมคำสั่งติดต่อ Materials API ไว้ที่เดียว (เหมือน equipment.js) — หมวดหมู่ใช้ getCategories ร่วมกับ
// equipment.js เพราะ categories table ใช้ร่วมกันทั้งครุภัณฑ์และวัสดุ ไม่ต้องมี endpoint แยก
import { request } from './http.js';

function toListQueryString({ page, limit, search, categoryId, outstanding, sort, dir } = {}) {
  const query = new URLSearchParams();

  if (page) query.set('page', page);
  if (limit) query.set('limit', limit);
  if (search) query.set('search', search);
  if (categoryId) query.set('category_id', categoryId);
  // ประวัติการเบิก: เฉพาะใบที่ต้องคืนและยังคืนไม่ครบ
  if (outstanding) query.set('outstanding', '1');
  // เรียงที่ server เพราะแบ่งหน้าที่ server (เรียงฝั่ง client จะได้แค่ในหน้าที่เห็น)
  if (sort) query.set('sort', sort);
  if (sort && dir) query.set('dir', dir);

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

// ประวัติการเบิกของตัวเอง — ทุก role
export function getMyMaterialWithdrawals(params) {
  return request(`/api/materials/my-withdrawals${toListQueryString(params)}`);
}

// เบิกวัสดุ — ทุก role ที่ login แล้วเรียกได้ ตัดยอดทันที ไม่ต้องรอ Admin อนุมัติ
// dueDate (YYYY-MM-DD) บังคับเฉพาะวัสดุที่ต้องคืน
export function withdrawMaterial(materialId, { quantity, remark, dueDate }) {
  return request(`/api/materials/${materialId}/withdraw`, {
    method: 'POST',
    body: { quantity, remark, due_date: dueDate || null },
  });
}

// Admin รับคืนวัสดุ คืนทีละส่วนได้
export function returnMaterialWithdrawal(withdrawalId, { quantity, remark }) {
  return request(`/api/admin/materials/withdrawals/${withdrawalId}/return`, {
    method: 'POST',
    body: { quantity, remark },
  });
}

// กลุ่มคำสั่งของ Admin (Create/Update/Delete/Restore)
// items = แถวจากไฟล์ Excel ที่แปลงแล้วใน utils/importExcel.js (ดู MATERIAL_IMPORT)
export function importMaterials(items) {
  return request('/api/admin/materials/import', { method: 'POST', body: { items } });
}

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

// เหมือนรูปครุภัณฑ์ (ดู equipment.js) field "image" แทนที่รูปเดิม
export function uploadMaterialImage(materialId, file, thumbnail) {
  const formData = new FormData();
  formData.append('image', file);
  if (thumbnail) formData.append('thumbnail', thumbnail);

  return request(`/api/admin/materials/${materialId}/image`, {
    method: 'PUT',
    body: formData,
  });
}

export function deleteMaterialImage(materialId) {
  return request(`/api/admin/materials/${materialId}/image`, {
    method: 'DELETE',
  });
}

// imageChange จาก MaterialForm: null = ไม่แตะรูป, { file, thumbnail } = อัปโหลดใหม่, { remove: true } = ลบรูป
export function applyMaterialImageChange(materialId, imageChange) {
  if (imageChange?.file) {
    return uploadMaterialImage(materialId, imageChange.file, imageChange.thumbnail);
  }
  if (imageChange?.remove) return deleteMaterialImage(materialId);

  return Promise.resolve(null);
}
