// รวมคำสั่งติดต่อ Equipment API ไว้ที่เดียว เพื่อไม่ให้แต่ละ Component เขียน fetch ซ้ำ
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// เก็บ HTTP status ไว้กับ Error เช่น 401 เพื่อให้หน้าจอตัดสินใจ Logout ได้
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// request() เป็นตัวกลาง: ใส่ Token, แปลง JSON และจัดการ Error รูปแบบเดียวกัน
async function request(path, options = {}) {
  const token = localStorage.getItem('access_token');
  const headers = {
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data.message ?? 'ไม่สามารถดำเนินการได้',
      response.status,
    );
  }

  return data;
}

// กลุ่มอ่านข้อมูล (GET)
export function getEquipment() {
  return request('/api/equipment-items');
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
    body: JSON.stringify(equipment),
  });
}

export function updateEquipment(itemId, equipment) {
  return request(`/api/admin/equipment-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(equipment),
  });
}

export function updateEquipmentStatus(itemId, status) {
  return request(`/api/admin/equipment-items/${itemId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
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
