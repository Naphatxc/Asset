// รวมคำสั่งติดต่อ Equipment API ไว้ที่เดียว เพื่อไม่ให้แต่ละ Component เขียน fetch ซ้ำ
import { request } from './http.js';

// รองรับ 3000+ รายการ: page/limit/search/status/category_id/location_id/sort/dir ส่งเป็น query string
// ไม่ส่ง key ที่ไม่มีค่าเพื่อให้ backend ใช้ default เอง
function toListQueryString({ page, limit, search, status, categoryId, locationId, sort, dir } = {}) {
  const query = new URLSearchParams();

  if (page) query.set('page', page);
  if (limit) query.set('limit', limit);
  if (search) query.set('search', search);
  if (status) query.set('status', status);
  if (categoryId) query.set('category_id', categoryId);
  if (locationId) query.set('location_id', locationId);
  // เรียงที่ server เพราะแบ่งหน้าที่ server (เรียงฝั่ง client จะได้แค่ในหน้าที่เห็น)
  if (sort) query.set('sort', sort);
  if (sort && dir) query.set('dir', dir);

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

// ครุภัณฑ์ที่ว่างทุกชิ้น (ไม่แบ่งหน้า มีแค่ item_id/equipment_code/equipment_name) สำหรับช่องเลือกในฟอร์ม
// ยืม/แจ้งซ่อม ห้ามใช้ getEquipment({ limit }) แทน เพราะ server ตัด limit ไว้ที่ 500 ของที่เกินจะเลือกไม่ได้
export function getAvailableEquipment() {
  return request('/api/available-equipment');
}

// items ตามรูปแบบไฟล์ที่ server/scripts/export-equipment.js สร้าง (ไฟล์ Excel แปลงเป็นรูปแบบนี้ใน utils/importExcel.js)
export function importEquipment(items) {
  return request('/api/admin/equipment-items/import', { method: 'POST', body: { items } });
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

// file/thumbnail มาจาก ImageInput.jsx (ย่อขนาดแล้ว) ส่งเป็น multipart/form-data แทนที่รูปเดิม
// thumbnail ไม่บังคับ (browser ถอดรหัสรูปไม่ได้จะไม่มี) ไม่มีแล้วตารางจะใช้รูปเต็มแทน
export function uploadEquipmentImage(itemId, file, thumbnail) {
  const formData = new FormData();
  formData.append('image', file);
  if (thumbnail) formData.append('thumbnail', thumbnail);

  return request(`/api/admin/equipment-items/${itemId}/image`, {
    method: 'PUT',
    body: formData,
  });
}

export function deleteEquipmentImage(itemId) {
  return request(`/api/admin/equipment-items/${itemId}/image`, {
    method: 'DELETE',
  });
}

// imageChange จาก EquipmentForm: null = ไม่แตะรูป, { file, thumbnail } = อัปโหลดใหม่, { remove: true } = ลบรูป
export function applyEquipmentImageChange(itemId, imageChange) {
  if (imageChange?.file) {
    return uploadEquipmentImage(itemId, imageChange.file, imageChange.thumbnail);
  }
  if (imageChange?.remove) return deleteEquipmentImage(itemId);

  return Promise.resolve(null);
}
