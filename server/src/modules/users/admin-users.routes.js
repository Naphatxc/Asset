// ทุก route ในไฟล์นี้สงวนให้ Admin สำหรับจัดการบัญชีผู้ใช้
import express from 'express';

import * as adminUserController from './admin-user.controller.js';
import {
  validateCreateUser,
  validateUpdateUserRole,
  validateUserId,
} from './admin-user.validator.js';
import {
  authenticate,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';

const router = express.Router();

// ใช้ middleware กับทั้ง router จึงไม่ต้องเขียนซ้ำทุก endpoint
// verifyCsrfToken ตรวจแค่ POST/PATCH/DELETE (no-op กับ GET) จึงวางไว้ก่อน requireAdmin ได้เพื่อไม่ต้อง
// query DB (findRoleById) โดยเปล่าประโยชน์เมื่อ request ติด CSRF อยู่แล้ว
router.use(authenticate, verifyCsrfToken, requireAdmin);

// GET /api/admin/users
router.get('/', adminUserController.getUsers);

// POST /api/admin/users { name, email, password, role }
router.post('/', validateCreateUser, adminUserController.createUser);

// DELETE /api/admin/users/:id
router.delete('/:id', validateUserId, adminUserController.deleteUser);

// PATCH /api/admin/users/:id/role
router.patch(
  '/:id/role',
  validateUpdateUserRole,
  adminUserController.updateUserRole,
);

export default router;
