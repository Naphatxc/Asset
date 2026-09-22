// ลืมรหัสผ่าน: ขอลิงก์ทางอีเมล -> เปิดลิงก์ -> ตั้งรหัสใหม่ (เหมือนเว็บทั่วไป)
//
// ข้อควรระวังที่ออกแบบไว้:
// - ตอบข้อความเดียวกันเสมอไม่ว่าอีเมลจะมีในระบบหรือไม่ ไม่งั้นใช้ฟอร์มนี้ไล่เช็คว่าใครมีบัญชีได้ (account enumeration)
//   และส่งอีเมลแบบไม่รอผล ให้เวลาตอบของอีเมลที่มี/ไม่มีบัญชีใกล้กัน
// - เก็บแค่ sha256 ของ token ใน DB ตัวจริงอยู่ในอีเมลอย่างเดียว ลิงก์ใช้ได้ครั้งเดียวและหมดอายุใน 30 นาที
// - ตั้งรหัสใหม่แล้ว session เดิมทุกเครื่องหลุด (password_changed_at เหมือนตอนเปลี่ยนรหัสจากเมนู)
import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';

import * as passwordResetRepository from './password-reset.repository.js';
import {
  appUrl,
  passwordResetCooldownMs,
  passwordResetTtlMs,
} from '../../config/env.js';
import { currentSecond } from '../../utils/access-token.js';
import { AppError } from '../../utils/AppError.js';
import { isMailConfigured, sendMail } from '../../utils/mailer.js';
import { runSerializableTransaction } from '../../utils/transaction.js';
import * as userRepository from '../users/user.repository.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildResetEmail(name, link) {
  const minutes = Math.round(passwordResetTtlMs / 60000);

  return {
    subject: 'ตั้งรหัสผ่านใหม่ — ระบบจัดการวัสดุและครุภัณฑ์',
    text: [
      `สวัสดีคุณ ${name}`,
      '',
      'มีการขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ เปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่:',
      link,
      '',
      `ลิงก์นี้ใช้ได้ครั้งเดียวภายใน ${minutes} นาที`,
      'ถ้าคุณไม่ได้เป็นคนขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ',
    ].join('\n'),
    html: `
      <p>สวัสดีคุณ ${escapeHtml(name)}</p>
      <p>มีการขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#ed0082;color:#ffffff;text-decoration:none;font-weight:700">ตั้งรหัสผ่านใหม่</a></p>
      <p>หรือคัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:<br>${link}</p>
      <p>ลิงก์นี้ใช้ได้ครั้งเดียวภายใน ${minutes} นาที ถ้าคุณไม่ได้เป็นคนขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ</p>
    `,
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export async function requestPasswordReset(email) {
  // production ที่ยังไม่ได้ตั้งค่าบริการส่งอีเมล: บอกตรงๆ ว่าใช้ไม่ได้ (ตอบเหมือนกันทุกอีเมล จึงไม่รั่วว่าใครมีบัญชี)
  if (!isMailConfigured()) {
    throw new AppError(503, 'ระบบส่งอีเมลยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
  }

  try {
    const user = await userRepository.findByEmail(email);
    if (!user) return;

    const latest = await passwordResetRepository.findLatestByUserId(user.user_id);
    if (latest && Date.now() - latest.created_at.getTime() < passwordResetCooldownMs) return;

    const token = crypto.randomBytes(32).toString('base64url');
    const now = new Date();

    await runSerializableTransaction(async (tx) => {
      await passwordResetRepository.markAllUsedByUserId(user.user_id, now, tx);
      await passwordResetRepository.create(
        {
          userId: user.user_id,
          tokenHash: hashToken(token),
          expiresAt: new Date(now.getTime() + passwordResetTtlMs),
        },
        tx,
      );
    });

    const link = `${appUrl}/reset-password?token=${token}`;
    const message = buildResetEmail(user.name, link);

    // ไม่ await: ส่งอีเมลใช้เวลา ถ้ารอ คนนอกจะแยกออกจากเวลาตอบว่าอีเมลไหนมีบัญชี ส่งไม่สำเร็จดูได้ใน log
    sendMail({ to: user.email, ...message }).catch((error) => {
      console.error('Failed to send password reset email', error);
    });
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถส่งลิงก์ตั้งรหัสผ่านใหม่ได้', { cause: error });
  }
}

export async function resetPasswordWithToken(token, newPassword) {
  try {
    // bcrypt ช้าโดยตั้งใจ ทำก่อนเปิด transaction จะได้ไม่ถือ lock นาน
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const now = new Date();

    // หา token ใน transaction เดียวกับที่ปิดมัน กันเปิดลิงก์เดียวกันพร้อมกันสองแท็บแล้วตั้งรหัสได้สองครั้ง
    const result = await runSerializableTransaction(async (tx) => {
      const record = await passwordResetRepository.findUsableByHash(hashToken(token), now, tx);
      if (!record) return { error: true };

      await userRepository.updatePassword(
        record.user_id,
        { passwordHash, changedAt: new Date(currentSecond(now.getTime()) * 1000) },
        tx,
      );
      await passwordResetRepository.markAllUsedByUserId(record.user_id, now, tx);

      return {};
    });

    if (result.error) {
      throw new AppError(400, 'ลิงก์ตั้งรหัสผ่านใหม่ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่');
    }
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถตั้งรหัสผ่านใหม่ได้', { cause: error });
  }
}
