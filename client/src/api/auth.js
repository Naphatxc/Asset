// รวมคำสั่งติดต่อ Auth API — token อยู่ใน httpOnly cookie ที่ server ตั้งให้ ฝั่งนี้จึงไม่แตะ token เลย
import { request } from './http.js';

export function register({ name, email, password }) {
  return request('/api/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });
}

export function login({ email, password }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

// เรียกตอนโหลดหน้า/Refresh เพื่อตรวจว่ายัง Login อยู่หรือไม่ cookie จะแนบไปเองถ้ามี
export function getCurrentUser() {
  return request('/api/auth/me');
}

export function logout() {
  return request('/api/auth/logout', { method: 'POST' });
}
