// ตรวจรูปแบบ input จาก request ก่อนถึง Controller/Service (ไม่แตะ Database)
import { AppError } from '../../utils/AppError.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegister(request, _response, next) {
  const name = String(request.body?.name ?? '').trim();
  const email = String(request.body?.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(request.body?.password ?? '');

  if (name.length < 2 || name.length > 100) {
    return next(new AppError(400, 'ชื่อต้องมีความยาว 2-100 ตัวอักษร'));
  }

  if (!emailPattern.test(email)) {
    return next(new AppError(400, 'รูปแบบอีเมลไม่ถูกต้อง'));
  }

  if (password.length < 8 || password.length > 72) {
    return next(new AppError(400, 'รหัสผ่านต้องมีความยาว 8-72 ตัวอักษร'));
  }

  request.validated = { name, email, password };
  next();
}

// ช่วงความยาวเดียวกับตอนสมัคร (bcrypt อ่านได้ไม่เกิน 72 byte)
export function validateChangePassword(request, _response, next) {
  const currentPassword = String(request.body?.current_password ?? '');
  const newPassword = String(request.body?.new_password ?? '');

  if (!currentPassword) {
    return next(new AppError(400, 'กรุณากรอกรหัสผ่านปัจจุบัน'));
  }
  if (newPassword.length < 8 || newPassword.length > 72) {
    return next(new AppError(400, 'รหัสผ่านใหม่ต้องมีความยาว 8-72 ตัวอักษร'));
  }

  request.validated = { currentPassword, newPassword };
  next();
}

export function validateForgotPassword(request, _response, next) {
  const email = String(request.body?.email ?? '')
    .trim()
    .toLowerCase();

  if (!emailPattern.test(email)) {
    return next(new AppError(400, 'รูปแบบอีเมลไม่ถูกต้อง'));
  }

  request.validated = { email };
  next();
}

export function validateResetPassword(request, _response, next) {
  const token = String(request.body?.token ?? '').trim();
  const newPassword = String(request.body?.new_password ?? '');

  if (!token) {
    return next(new AppError(400, 'ลิงก์ตั้งรหัสผ่านใหม่ไม่ถูกต้อง'));
  }
  if (newPassword.length < 8 || newPassword.length > 72) {
    return next(new AppError(400, 'รหัสผ่านใหม่ต้องมีความยาว 8-72 ตัวอักษร'));
  }

  request.validated = { token, newPassword };
  next();
}

export function validateLogin(request, _response, next) {
  const email = String(request.body?.email ?? '')
    .trim()
    .toLowerCase();
  const password = String(request.body?.password ?? '');

  if (!email || !password) {
    return next(new AppError(400, 'กรุณากรอกอีเมลและรหัสผ่าน'));
  }

  request.validated = { email, password };
  next();
}
