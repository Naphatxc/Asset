// Middleware ทำงานก่อน Controller เพื่อป้องกัน route ที่ต้อง Login/Admin
import jwt from 'jsonwebtoken';

import { jwtSecret } from '../config.js';
import { pool } from '../db.js';

export function authenticate(request, response, next) {
  // รูปแบบ Header ที่รับคือ Authorization: Bearer <token>
  const authorization = String(request.headers.authorization ?? '');
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({
      message: 'กรุณาเข้าสู่ระบบ',
    });
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
    return response.status(401).json({
      message: 'Token หมดอายุหรือไม่ถูกต้อง',
    });
  }
}

export async function requireAdmin(request, response, next) {
  try {
    // อ่าน role ล่าสุดจาก DB ไม่เชื่อ role ใน Token อย่างเดียว เพราะ Admin อาจเพิ่งถูกลดสิทธิ์
    const [users] = await pool.execute(
      `SELECT role
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [request.user.sub],
    );

    const user = users[0];

    if (!user) {
      return response.status(401).json({
        message: 'ไม่พบบัญชีผู้ใช้',
      });
    }

    if (user.role !== 'admin') {
      return response.status(403).json({
        message: 'คุณไม่มีสิทธิ์ใช้งานส่วนนี้',
      });
    }

    next();
  } catch (error) {
    console.error('Authorization error:', error);

    response.status(500).json({
      message: 'ไม่สามารถตรวจสอบสิทธิ์ได้',
    });
  }
}
