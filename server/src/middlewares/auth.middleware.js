// Middleware ทำงานก่อน Controller เพื่อป้องกัน route ที่ต้อง Login/Admin
import {
  accessTokenCookieName,
  accessTokenCookieOptions,
  csrfCookieOptions,
  csrfTokenCookieName,
} from '../config/env.js';
import * as userRepository from '../modules/users/user.repository.js';
import { renewAccessToken, verifyAccessToken } from '../utils/access-token.js';
import { AppError } from '../utils/AppError.js';

export function authenticate(request, response, next) {
  // Token อยู่ใน httpOnly cookie (set ตอน login) ไม่ใช่ Authorization header อีกต่อไป
  const token = request.cookies?.[accessTokenCookieName];

  if (!token) {
    return next(new AppError(401, 'กรุณาเข้าสู่ระบบ'));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(new AppError(401, 'Token หมดอายุหรือไม่ถูกต้อง'));
  }

  // ใช้งานอยู่ = ต่ออายุ session ให้เงียบๆ (sliding session ดู config/env.js) csrf cookie ต้องยืดอายุตามด้วย
  // ค่าเดิม ไม่งั้น cookie นั้นหมดก่อนแล้ว request ที่เปลี่ยนข้อมูลจะโดน CSRF ปฏิเสธทั้งที่ยัง login อยู่
  const renewed = renewAccessToken(payload);
  if (renewed) {
    response.cookie(accessTokenCookieName, renewed.token, {
      ...accessTokenCookieOptions,
      maxAge: renewed.maxAgeMs,
    });

    const csrfToken = request.cookies?.[csrfTokenCookieName];
    if (csrfToken) {
      response.cookie(csrfTokenCookieName, csrfToken, {
        ...csrfCookieOptions,
        maxAge: renewed.maxAgeMs,
      });
    }
  }

  // เก็บ payload ไว้ให้ route ถัดไปใช้ request.user.sub เป็น user_id
  // เรียก next() นอก try: error ที่เกิดใน middleware ถัดไปต้องไม่ถูกแปลงเป็น 401 "Token หมดอายุ"
  request.user = payload;
  next();
}

export async function requireAdmin(request, _response, next) {
  try {
    // อ่าน role ล่าสุดจาก DB ไม่เชื่อ role ใน Token อย่างเดียว เพราะ Admin อาจเพิ่งถูกลดสิทธิ์
    const user = await userRepository.findRoleById(Number(request.user.sub));

    if (!user) {
      return next(new AppError(401, 'ไม่พบบัญชีผู้ใช้'));
    }

    if (user.role !== 'admin') {
      return next(new AppError(403, 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้'));
    }

    next();
  } catch (error) {
    next(new AppError(500, 'ไม่สามารถตรวจสอบสิทธิ์ได้', { cause: error }));
  }
}
