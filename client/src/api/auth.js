// รวมคำสั่งติดต่อ Auth API — access token อยู่ใน httpOnly cookie ที่ server ตั้งให้ ฝั่งนี้ไม่แตะ
// ส่วน csrf token ต้องรับมาจาก response body แล้วเก็บไว้ (setCsrfToken) เพราะ production
// client/server คนละ host กัน อ่านผ่าน document.cookie ข้าม origin ไม่ได้ (ดู http.js)
import { request, setCsrfToken } from './http.js';

export function register({ name, email, password }) {
  return request('/api/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });
}

export async function login({ email, password }) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  setCsrfToken(data.csrfToken);

  return data;
}

// เรียกตอนโหลดหน้า/Refresh เพื่อตรวจว่ายัง Login อยู่หรือไม่ cookie จะแนบไปเองถ้ามี
export async function getCurrentUser() {
  const data = await request('/api/auth/me');

  setCsrfToken(data.csrfToken);

  return data;
}

// เปลี่ยนรหัสของตัวเอง server ออก session ใหม่ให้ (session เดิมทุกเครื่องใช้ไม่ได้แล้ว) csrf token ยังเป็นค่าเดิม
export async function changePassword({ currentPassword, newPassword }) {
  const data = await request('/api/auth/change-password', {
    method: 'POST',
    body: { current_password: currentPassword, new_password: newPassword },
  });

  setCsrfToken(data.csrfToken);

  return data;
}

// ลืมรหัสผ่าน: server ตอบข้อความเดียวกันเสมอ ไม่ว่าอีเมลนี้จะมีบัญชีหรือไม่
export function forgotPassword(email) {
  return request('/api/auth/forgot-password', { method: 'POST', body: { email } });
}

// token มาจากลิงก์ในอีเมล (/reset-password?token=...)
export function resetPassword({ token, newPassword }) {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: { token, new_password: newPassword },
  });
}

export async function logout() {
  const data = await request('/api/auth/logout', { method: 'POST' });

  setCsrfToken(null);

  return data;
}
