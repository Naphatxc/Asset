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
    // csrf_token ส่งทั้งเป็น cookie (server ใช้เทียบตอน verify) และใน response body ด้านล่าง
    // (client เก็บจาก body ไปแนบ header เอง) ส่วน access_token เป็น httpOnly กัน XSS ขโมย token ไปใช้ตรง ๆ
    const csrfToken = generateCsrfToken();

    response
      .cookie('access_token', token, accessTokenCookieOptions)
      .cookie('csrf_token', csrfToken, csrfCookieOptions)
      .status(200)
      .json({
        message: 'เข้าสู่ระบบสำเร็จ',
        user,
        // client ต้องได้ค่านี้ผ่าน body เพราะ production client/server คนละ host กัน
        // อ่าน csrf_token cookie ผ่าน document.cookie ข้าม origin ไม่ได้ (ดู client/src/api/http.js)
        csrfToken,
      });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/logout — ไม่บังคับผ่าน authenticate เพราะแค่ล้าง cookie เก่าที่อาจหมดอายุไปแล้วก็ยังต้องทำได้
// clearCookie ต้องส่ง secure/sameSite ให้ตรงกับตอน set (accessTokenCookieOptions/csrfCookieOptions) เป๊ะๆ
// ไม่งั้นตอน production (cross-site) browser จะเมิน Set-Cookie ที่ขาด SameSite=None; Secure แล้ว cookie เดิมไม่ถูกล้างจริง
export function logout(_request, response) {
  response
    .clearCookie('access_token', {
      path: accessTokenCookieOptions.path,
      secure: accessTokenCookieOptions.secure,
      sameSite: accessTokenCookieOptions.sameSite,
    })
    .clearCookie('csrf_token', {
      path: csrfCookieOptions.path,
      secure: csrfCookieOptions.secure,
      sameSite: csrfCookieOptions.sameSite,
    })
    .status(200)
    .json({ message: 'ออกจากระบบสำเร็จ' });
}

export async function getCurrentUser(request, response, next) {
  try {
    const user = await authService.getCurrentUser(Number(request.user.sub));

    // ส่ง csrf_token กลับไปด้วยทุกครั้งที่เช็ค session (เช่น ตอน refresh หน้า) เพื่อให้ client
    // sync ค่าที่เก็บไว้ในหน่วยความจำใหม่ได้ โดยไม่ต้องอ่าน cookie นี้ผ่าน document.cookie เอง
    response
      .status(200)
      .json({ user, csrfToken: request.cookies?.csrf_token ?? null });
  } catch (error) {
    next(error);
  }
}
