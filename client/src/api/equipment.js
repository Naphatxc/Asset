// รวมคำสั่งติดต่อ Equipment API ไว้ที่เดียว เพื่อไม่ให้แต่ละ Component เขียน fetch ซ้ำ
import { request } from './http.js';

// กลุ่มอ่านข้อมูล (GET)
export function getEquipment() {
  return request('/api/equipment-items');
}

export function getEquipmentByCode(equipmentCode) {
  return request(
    `/api/equipment-items/${encodeURIComponent(equipmentCode)}`,
  );
}

export function getDeletedEquipment() {
  return request('/api/admin/equipment-items/deleted');
}

export function getCategories() {
  return request('/api/categories');
}

export function getLocations() {
  return request('/api/locations');
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
