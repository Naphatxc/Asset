// Middleware ทำงานก่อน Controller เพื่อป้องกัน route ที่ต้อง Login/Admin
import jwt from 'jsonwebtoken';

import { jwtSecret } from '../config/env.js';
import * as userRepository from '../modules/users/user.repository.js';
import { AppError } from '../utils/AppError.js';

export function authenticate(request, _response, next) {
  // รูปแบบ Header ที่รับคือ Authorization: Bearer <token>
  const authorization = String(request.headers.authorization ?? '');
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(401, 'กรุณาเข้าสู่ระบบ'));
  }

  try {
    const payload = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'asset-management-api',
      audience: 'asset-management-client',
    });

    // เก็บ payload ไว้ให้ route ถัดไปใช้ request.user.sub เป็น user_id
    request.user = payload;
    next();
  } catch {
    next(new AppError(401, 'Token หมดอายุหรือไม่ถูกต้อง'));
  }
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
