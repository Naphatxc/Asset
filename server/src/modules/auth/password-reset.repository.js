// Data Access Layer สำหรับ password_reset_tokens (ลิงก์ลืมรหัสผ่านทางอีเมล) เก็บแค่ hash ของ token
import { prisma } from '../../config/prisma.js';

export async function create({ userId, tokenHash, expiresAt }, client = prisma) {
  return client.password_reset_tokens.create({
    data: { user_id: userId, token_hash: tokenHash, expires_at: expiresAt },
  });
}

// ลิงก์ล่าสุดของบัญชีนี้ ใช้เช็คว่าเพิ่งขอไปเมื่อกี้หรือยัง (กันกดขอลิงก์ถี่ๆ)
export async function findLatestByUserId(userId, client = prisma) {
  return client.password_reset_tokens.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    select: { created_at: true },
  });
}

// ใช้ได้ต้องยังไม่เคยถูกใช้และยังไม่หมดอายุเท่านั้น
export async function findUsableByHash(tokenHash, now = new Date(), client = prisma) {
  return client.password_reset_tokens.findFirst({
    where: { token_hash: tokenHash, used_at: null, expires_at: { gt: now } },
    select: { token_id: true, user_id: true },
  });
}

// ตั้งรหัสใหม่สำเร็จแล้ว ลิงก์ทุกอันของบัญชีนี้ที่ยังไม่ได้ใช้ต้องใช้ไม่ได้อีก (รวมถึงลิงก์ที่ขอซ้ำไว้ก่อนหน้า)
// ขอลิงก์ใหม่ก็ปิดลิงก์เก่าด้วยวิธีเดียวกัน เหลือลิงก์ที่ใช้ได้แค่อันล่าสุดอันเดียว
export async function markAllUsedByUserId(userId, now = new Date(), client = prisma) {
  return client.password_reset_tokens.updateMany({
    where: { user_id: userId, used_at: null },
    data: { used_at: now },
  });
}
