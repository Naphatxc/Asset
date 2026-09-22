// Routes เกี่ยวกับบัญชี: สมัครสมาชิก, Login และอ่านข้อมูลคนที่ Login อยู่
import express from 'express';

import * as authController from './auth.controller.js';
import {
  validateChangePassword,
  validateForgotPassword,
  validateLogin,
  validateRegister,
  validateResetPassword,
} from './auth.validator.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', validateRegister, authController.register);

// POST /api/auth/login
router.post('/login', validateLogin, authController.login);

// GET /api/auth/me ใช้ตรวจ Session ตอน Refresh หน้าเว็บ
router.get('/me', authenticate, authController.getCurrentUser);

// POST /api/auth/logout
router.post('/logout', authController.logout);

// POST /api/auth/forgot-password - ขอลิงก์ตั้งรหัสผ่านใหม่ทางอีเมล { email } (ไม่ต้อง login)
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);

// POST /api/auth/reset-password - ตั้งรหัสใหม่ด้วย token จากลิงก์ในอีเมล { token, new_password }
router.post('/reset-password', validateResetPassword, authController.resetPassword);

// POST /api/auth/change-password - เปลี่ยนรหัสของตัวเอง { current_password, new_password }
router.post(
  '/change-password',
  authenticate,
  verifyCsrfToken,
  validateChangePassword,
  authController.changePassword,
);

export default router;
