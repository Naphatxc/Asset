// Routes เกี่ยวกับบัญชี: สมัครสมาชิก, Login และอ่านข้อมูลคนที่ Login อยู่
import express from 'express';

import * as authController from './auth.controller.js';
import { validateLogin, validateRegister } from './auth.validator.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', validateRegister, authController.register);

// POST /api/auth/login
router.post('/login', validateLogin, authController.login);

// GET /api/auth/me ใช้ตรวจ Session ตอน Refresh หน้าเว็บ
router.get('/me', authenticate, authController.getCurrentUser);

export default router;
