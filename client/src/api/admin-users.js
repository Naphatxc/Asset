// รวมคำสั่งติดต่อ Admin Users API
import { request } from './http.js';

export function getUsers() {
  return request('/api/admin/users');
}

export function updateUserRole(userId, role) {
  return request(`/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: { role },
  });
}

export function createUser({ name, email, password, role }) {
  return request('/api/admin/users', {
    method: 'POST',
    body: { name, email, password, role },
  });
}

export function deleteUser(userId) {
  return request(`/api/admin/users/${userId}`, { method: 'DELETE' });
}
