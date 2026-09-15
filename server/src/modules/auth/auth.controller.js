import * as authService from './auth.service.js';
import {
  accessTokenCookieOptions,
  csrfCookieOptions,
} from '../../config/env.js';
import { generateCsrfToken } from '../../utils/csrf.js';

export async function register(request, response, next) {
  try {
    const user = await authService.register(request.validated);

    response.status(201).json({
      message: 'ลงทะเบียนสำเร็จ',
      user,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(request, response, next) {
  try {
    const { token, user } = await authService.login(request.validated);
    // csrf_token ต้องอ่านได้จาก JS ฝั่ง client (httpOnly: false) เพื่อแนบใน header ตอนยิง
    // request ที่เปลี่ยนแปลงข้อมูล ส่วน access_token เป็น httpOnly กัน XSS ขโมย token ไปใช้ตรง ๆ
    const csrfToken = generateCsrfToken();

    response
      .cookie('access_token', token, accessTokenCookieOptions)
      .cookie('csrf_token', csrfToken, csrfCookieOptions)
      .status(200)
      .json({
        message: 'เข้าสู่ระบบสำเร็จ',
        user,
      });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/logout — ไม่บังคับผ่าน authenticate เพราะแค่ล้าง cookie เก่าที่อาจหมดอายุไปแล้วก็ยังต้องทำได้
export function logout(_request, response) {
  response
    .clearCookie('access_token', { path: '/' })
    .clearCookie('csrf_token', { path: '/' })
    .status(200)
    .json({ message: 'ออกจากระบบสำเร็จ' });
}

export async function getCurrentUser(request, response, next) {
  try {
    const user = await authService.getCurrentUser(Number(request.user.sub));

    response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}
