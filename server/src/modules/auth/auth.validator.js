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
