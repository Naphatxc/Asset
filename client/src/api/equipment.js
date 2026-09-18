// รวมคำสั่งติดต่อ Equipment API ไว้ที่เดียว เพื่อไม่ให้แต่ละ Component เขียน fetch ซ้ำ
import { request } from './http.js';

// รองรับ 3000+ รายการ: page/limit/search/status/category_id/location_id ส่งเป็น query string
// ไม่ส่ง key ที่ไม่มีค่าเพื่อให้ backend ใช้ default เอง
function toListQueryString({ page, limit, search, status, categoryId, locationId } = {}) {
  const query = new URLSearchParams();

  if (page) query.set('page', page);
  if (limit) query.set('limit', limit);
  if (search) query.set('search', search);
  if (status) query.set('status', status);
  if (categoryId) query.set('category_id', categoryId);
  if (locationId) query.set('location_id', locationId);

  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

// กลุ่มอ่านข้อมูล (GET)
export function getEquipment(params) {
  return request(`/api/equipment-items${toListQueryString(params)}`);
}

export function getEquipmentByCode(equipmentCode) {
  return request(
    `/api/equipment-items/${encodeURIComponent(equipmentCode)}`,
  );
}

export function getDeletedEquipment(params) {
  return request(`/api/admin/equipment-items/deleted${toListQueryString(params)}`);
}

export function getCategories() {
  return request('/api/categories');
}

export function getLocations() {
  return request('/api/locations');
}

export function createCategory(categoryName, codePrefix) {
  return request('/api/admin/categories', {
    method: 'POST',
    body: { category_name: categoryName, code_prefix: codePrefix || null },
  });
}

// เดารหัสครุภัณฑ์ตัวถัดไปจาก code_prefix ของหมวดหมู่ที่เลือก (code: null ถ้าหมวดหมู่นั้นยังไม่ได้ตั้ง prefix ไว้)
export function getNextEquipmentCode(categoryId) {
  return request(
    `/api/admin/equipment-items/next-code?category_id=${categoryId}`,
  );
}

export function createLocation({ locationName, building, room }) {
  return request('/api/admin/locations', {
    method: 'POST',
    body: { location_name: locationName, building, room },
  });
}

// กลุ่มคำสั่งของ Admin (Create/Update/Delete/Restore/History)
export function createEquipment(equipment) {
  return request('/api/admin/equipment-items', {
    method: 'POST',
    body: equipment,
  });
}

export function updateEquipment(itemId, equipment) {
  return request(`/api/admin/equipment-items/${itemId}`, {
    method: 'PATCH',
    body: equipment,
  });
}

export function updateEquipmentStatus(itemId, status) {
  return request(`/api/admin/equipment-items/${itemId}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function deleteEquipment(itemId) {
  return request(`/api/admin/equipment-items/${itemId}`, {
    method: 'DELETE',
  });
}

export function restoreEquipment(itemId) {
  return request(`/api/admin/equipment-items/${itemId}/restore`, {
    method: 'PATCH',
  });
}

export function getEquipmentHistory(itemId) {
  return request(`/api/admin/equipment-items/${itemId}/history`);
}
