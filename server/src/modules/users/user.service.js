// Business Logic สำหรับ Admin จัดการบัญชีผู้ใช้
import bcrypt from 'bcryptjs';

import * as userRepository from './user.repository.js';
import { AppError } from '../../utils/AppError.js';

export async function getUsers() {
  try {
    return await userRepository.findMany();
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้', { cause: error });
  }
}

export async function updateUserRole(userId, role, requestingUserId) {
  if (String(requestingUserId) === String(userId) && role !== 'admin') {
    // ป้องกัน Admin ลดสิทธิ์บัญชีตัวเองจนจัดการระบบต่อไม่ได้
    throw new AppError(400, 'ไม่สามารถลดสิทธิ์บัญชีที่กำลังใช้งานได้');
  }

  try {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new AppError(404, 'ไม่พบผู้ใช้');
    }

    return await userRepository.updateRole(userId, role);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถอัปเดตสิทธิ์ได้', { cause: error });
  }
}

// Admin สร้างบัญชีให้คนอื่นโดยตรง (ไม่ต้องให้เจ้าของบัญชีสมัครเอง) แจ้งรหัสให้เจ้าของแล้วให้ไปเปลี่ยนเองภายหลัง
export async function createUser({ name, email, password, role }) {
  try {
    const existingUser = await userRepository.findByEmail(email);

    if (existingUser) {
      throw new AppError(409, 'อีเมลนี้ถูกใช้งานแล้ว');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    return await userRepository.create({
      name,
      email,
      password_hash: passwordHash,
      role,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error.code === 'P2002') {
      throw new AppError(409, 'อีเมลนี้ถูกใช้งานแล้ว');
    }

    throw new AppError(500, 'ไม่สามารถเพิ่มผู้ใช้ได้', { cause: error });
  }
}

// ลบได้เฉพาะบัญชีที่ยังไม่มีประวัติในระบบ (ยืม/เบิก/แจ้งซ่อม/ตรวจนับ ฯลฯ) — FK เป็น NoAction ประวัติจึงไม่หายตาม
// ห้ามลบบัญชีตัวเอง จึงเหลือ Admin อย่างน้อยหนึ่งคนเสมอ; session ของบัญชีที่ถูกลบใช้ไม่ได้ทันที (authenticate หา user ไม่เจอ)
export async function deleteUser(userId, requestingUserId) {
  if (String(requestingUserId) === String(userId)) {
    throw new AppError(400, 'ไม่สามารถลบบัญชีที่กำลังใช้งานได้');
  }

  try {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new AppError(404, 'ไม่พบผู้ใช้');
    }

    await userRepository.remove(userId);
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error.code === 'P2003') {
      throw new AppError(409, 'ผู้ใช้นี้มีประวัติการใช้งานในระบบแล้ว จึงลบไม่ได้');
    }

    throw new AppError(500, 'ไม่สามารถลบผู้ใช้ได้', { cause: error });
  }
}
