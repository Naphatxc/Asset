// ออก/ตรวจ/ต่ออายุ JWT ของ session ไว้จุดเดียว ให้ login (auth.service.js) กับการต่ออายุระหว่างใช้งาน
// (auth.middleware.js) ใช้เงื่อนไขชุดเดียวกัน ดูนโยบาย session ที่ config/env.js
import jwt from 'jsonwebtoken';

import {
  jwtSecret,
  sessionAbsoluteTimeoutMs,
  sessionIdleTimeoutMs,
  sessionRenewAfterMs,
} from '../config/env.js';

const tokenOptions = {
  issuer: 'asset-management-api',
  audience: 'asset-management-client',
};

// login_at = เวลาที่ login จริง (วินาที) ติดไปกับทุก token ที่ต่ออายุออกมา ใช้เช็คเพดาน absolute timeout
// อายุ token = idle timeout แต่ไม่เกินเวลาที่เหลือก่อนชนเพดาน คืน maxAgeMs ไว้ตั้งอายุ cookie ให้ตรงกัน
export function signAccessToken({ userId, role, loginAt, now = Date.now() }) {
  const loginAtSeconds = loginAt ?? Math.floor(now / 1000);
  const remainingMs = loginAtSeconds * 1000 + sessionAbsoluteTimeoutMs - now;
  const lifetimeSeconds = Math.floor(Math.min(sessionIdleTimeoutMs, remainingMs) / 1000);

  const token = jwt.sign({ role, login_at: loginAtSeconds }, jwtSecret, {
    ...tokenOptions,
    subject: String(userId),
    expiresIn: lifetimeSeconds,
  });

  return { token, maxAgeMs: lifetimeSeconds * 1000 };
}

// กติกา: session ใช้ได้ก็ต่อเมื่อ login_at > วินาทีที่เปลี่ยนรหัสล่าสุด (ดู auth.middleware.js)
// password_changed_at เก็บเป็น DATETIME(0) ระดับวินาที ถ้าส่ง Date ที่มีเศษ ms ไป MySQL จะ "ปัดขึ้น" (.900 -> วินาทีถัดไป)
// จึงต้องปัดลงเองก่อนเขียน และทุก token ที่ออกหลังเปลี่ยนรหัสต้องมี login_at เลยวินาทีนั้นไปอย่างน้อย 1 วินาที
// ไม่งั้นเครื่องที่เพิ่ง login/เปลี่ยนรหัสในวินาทีเดียวกันจะถูกมองว่าเป็น session เก่าแล้วหลุดทันที
export function currentSecond(now = Date.now()) {
  return Math.floor(now / 1000);
}

export function loginAtAfterPasswordChange(passwordChangedAt, now = Date.now()) {
  if (!passwordChangedAt) return currentSecond(now);
  return Math.max(currentSecond(now), currentSecond(passwordChangedAt.getTime()) + 1);
}

export function verifyAccessToken(token) {
  return jwt.verify(token, jwtSecret, { ...tokenOptions, algorithms: ['HS256'] });
}

// ต่ออายุเมื่อ token ออกมานานเกิน sessionRenewAfterMs แล้ว (ไม่ sign ใหม่ทุก request) คืน null ถ้ายังไม่ถึงเวลา
// หรือเหลือไม่ถึง 1 นาทีก่อนชนเพดาน (ต่อไปก็ได้ token อายุสั้นจนไม่มีประโยชน์ ปล่อยให้หมดอายุเอง)
// token เก่าก่อนมี login_at ใช้ iat แทน เท่ากับนับเพดานจากตอนออก token ใบนั้น
export function renewAccessToken(payload, now = Date.now()) {
  const loginAt = payload.login_at ?? payload.iat;
  const issuedAgoMs = now - payload.iat * 1000;
  const untilCapMs = loginAt * 1000 + sessionAbsoluteTimeoutMs - now;

  if (issuedAgoMs < sessionRenewAfterMs || untilCapMs < 60 * 1000) return null;

  return signAccessToken({ userId: payload.sub, role: payload.role, loginAt, now });
}
