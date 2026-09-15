// ทุก route ในไฟล์นี้สงวนให้ Admin สำหรับจัดการบัญชีผู้ใช้
import express from 'express';

import * as adminUserController from './admin-user.controller.js';
import { validateUpdateUserRole } from './admin-user.validator.js';
import {
  authenticate,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';

const router = express.Router();

// ใช้ middleware กับทั้ง router จึงไม่ต้องเขียนซ้ำทุก endpoint
router.use(authenticate, requireAdmin);

// GET /api/admin/users
router.get('/', adminUserController.getUsers);

// PATCH /api/admin/users/:id/role
router.patch(
  '/:id/role',
  validateUpdateUserRole,
  adminUserController.updateUserRole,
);

export default router;
