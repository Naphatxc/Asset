// Business Logic สำหรับสมัครสมาชิก / เข้าสู่ระบบ / อ่านข้อมูลผู้ใช้ปัจจุบัน
import bcrypt from 'bcryptjs';

import * as userRepository from '../users/user.repository.js';
import { signAccessToken } from '../../utils/access-token.js';
import { AppError } from '../../utils/AppError.js';

export async function register({ name, email, password }) {
  try {
    const existingUser = await userRepository.findByEmail(email);

    if (existingUser) {
      throw new AppError(409, 'อีเมลนี้ถูกใช้งานแล้ว');
    }

    // ฐานข้อมูลเก็บ hash เท่านั้น ไม่เก็บรหัสผ่านจริง
    const passwordHash = await bcrypt.hash(password, 12);

    return await userRepository.create({
      name,
      email,
      password_hash: passwordHash,
    });
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error.code === 'P2002') {
      throw new AppError(409, 'อีเมลนี้ถูกใช้งานแล้ว');
    }

    throw new AppError(500, 'ไม่สามารถสมัครสมาชิกได้', { cause: error });
  }
}

export async function login({ email, password }) {
  try {
    const user = await userRepository.findByEmail(email);

    if (!user) {
      throw new AppError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      throw new AppError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    // subject (sub) คือ user_id อายุตาม idle timeout และต่ออายุเองระหว่างใช้งาน (ดู config/env.js)
    const { token } = signAccessToken({ userId: user.user_id, role: user.role });

    return {
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถเข้าสู่ระบบได้', { cause: error });
  }
}

export async function getCurrentUser(userId) {
  try {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new AppError(401, 'ไม่พบบัญชีผู้ใช้');
    }

    return user;
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้', { cause: error });
  }
}
