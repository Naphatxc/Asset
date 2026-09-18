// ข้อมูลตัวเลือกสำหรับ Form ครุภัณฑ์ — อ่านได้ทุก role ที่ login แล้ว, เพิ่มใหม่ได้เฉพาะ Admin
import express from 'express';

import * as optionsController from './options.controller.js';
import {
  validateCreateCategory,
  validateCreateLocation,
} from './options.validator.js';
import {
  authenticate,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';

const router = express.Router();
const adminRouter = express.Router();

router.use(authenticate);
// verifyCsrfToken ก่อน requireAdmin: เป็น check ที่ถูกกว่า (ไม่ query DB) จึงคัดออกก่อน
adminRouter.use(authenticate, verifyCsrfToken, requireAdmin);

// GET /api/categories
router.get('/categories', optionsController.getCategories);

// GET /api/locations
router.get('/locations', optionsController.getLocations);

// POST /api/admin/categories - เพิ่มหมวดหมู่ใหม่ตรงจาก Form ครุภัณฑ์ได้ทันที ไม่ต้องออกไปหน้าอื่น
adminRouter.post(
  '/categories',
  validateCreateCategory,
  optionsController.createCategory,
);

// POST /api/admin/locations
adminRouter.post(
  '/locations',
  validateCreateLocation,
  optionsController.createLocation,
);

export { adminRouter as adminOptionsRouter };
export default router;
