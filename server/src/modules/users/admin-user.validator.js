// ตรวจรูปแบบ input สำหรับ endpoint จัดการบัญชีผู้ใช้ของ Admin
import { AppError } from '../../utils/AppError.js';

const allowedRoles = ['admin', 'user'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

// เงื่อนไขชื่อ/อีเมล/รหัสผ่านเดียวกับตอนสมัครเอง (auth.validator.js) เพิ่มแค่ให้ Admin เลือก role ได้
export function validateCreateUser(request, _response, next) {
  const name = String(request.body?.name ?? '').trim();
  const email = String(request.body?.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(request.body?.password ?? '');
  const role = String(request.body?.role ?? 'user')
    .trim()
    .toLowerCase();

  if (name.length < 2 || name.length > 100) {
    return next(new AppError(400, 'ชื่อต้องมีความยาว 2-100 ตัวอักษร'));
  }

  if (!emailPattern.test(email)) {
    return next(new AppError(400, 'รูปแบบอีเมลไม่ถูกต้อง'));
  }

  if (password.length < 8 || password.length > 72) {
    return next(new AppError(400, 'รหัสผ่านต้องมีความยาว 8-72 ตัวอักษร'));
  }

  if (!allowedRoles.includes(role)) {
    return next(new AppError(400, 'Role ต้องเป็น admin หรือ user'));
  }

  request.validated = { name, email, password, role };
  next();
}

export function validateUserId(request, _response, next) {
  const userId = Number(request.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return next(new AppError(400, 'รหัสผู้ใช้ไม่ถูกต้อง'));
  }

  request.validated = { userId };
  next();
}
