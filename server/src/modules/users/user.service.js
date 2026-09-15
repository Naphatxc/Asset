// Business Logic สำหรับ Admin จัดการบัญชีผู้ใช้
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
