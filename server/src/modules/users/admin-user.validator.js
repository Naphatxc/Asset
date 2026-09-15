// ตรวจรูปแบบ input สำหรับ endpoint จัดการบัญชีผู้ใช้ของ Admin
import { AppError } from '../../utils/AppError.js';

const allowedRoles = ['admin', 'user'];

export function validateUpdateUserRole(request, _response, next) {
  const userId = Number(request.params.id);
  const role = String(request.body?.role ?? '')
    .trim()
    .toLowerCase();

  if (!Number.isInteger(userId) || userId <= 0) {
    return next(new AppError(400, 'รหัสผู้ใช้ไม่ถูกต้อง'));
  }

  if (!allowedRoles.includes(role)) {
    return next(new AppError(400, 'Role ต้องเป็น admin หรือ user'));
  }

  request.validated = { userId, role };
  next();
}
