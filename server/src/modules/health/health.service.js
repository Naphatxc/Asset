// ตรวจว่า Server เชื่อมฐานข้อมูลตัวที่ตั้งค่าไว้ได้จริง
import * as userRepository from '../users/user.repository.js';
import { AppError } from '../../utils/AppError.js';

export async function checkDatabase() {
  try {
    // Query ผ่าน Prisma เพื่อยืนยันว่า connection และ schema ใช้งานได้จริง
    await userRepository.count();
  } catch (error) {
    throw new AppError(500, 'Database connection failed', { cause: error });
  }

  return {
    database_name: process.env.DB_NAME ?? 'asset_management',
    orm: 'Prisma',
  };
}
