// ตัวกลางเดียวที่ทุกไฟล์ใน src/api ใช้ยิง request — ใส่ withCredentials (เพื่อแนบ/รับ httpOnly cookie),
// แนบ CSRF header ให้ request ที่เปลี่ยนแปลงข้อมูล และโยน ApiError รูปแบบเดียวกันทุกที่
import axios from 'axios';

export const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const mutatingMethods = new Set(['post', 'put', 'patch', 'delete']);

// เก็บ HTTP status ไว้กับ Error เช่น 401 เพื่อให้หน้าจอตัดสินใจ Logout ได้
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// csrf_token cookie ตั้งเป็น httpOnly: false ตอน login ไว้แล้ว (ดู server/src/config/env.js)
// จึงอ่านผ่าน document.cookie ได้ตรงๆ ไม่ต้องยิง request แยก
function readCookie(name) {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );

  return match ? decodeURIComponent(match[1]) : null;
}

const client = axios.create({
  baseURL: apiUrl,
  // แนบ cookie (access_token/csrf_token) ไปกับทุก request แม้ client/server จะคนละ port กันตอน dev
  withCredentials: true,
});

// แนบ CSRF header อัตโนมัติเฉพาะ method ที่เปลี่ยนแปลงข้อมูล (double-submit cookie pattern)
client.interceptors.request.use((config) => {
  if (mutatingMethods.has((config.method ?? 'get').toLowerCase())) {
    const csrfToken = readCookie('csrf_token');

    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return config;
});

export async function request(path, options = {}) {
  try {
    const response = await client.request({
      url: path,
      method: options.method ?? 'GET',
      data: options.body,
      headers: options.headers,
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new ApiError(
        error.response.data?.message ?? 'ไม่สามารถดำเนินการได้',
        error.response.status,
      );
    }

    // ไม่มี response เลย เช่น server ล่มหรือไม่มีการเชื่อมต่อ
    throw new ApiError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 0);
  }
}
