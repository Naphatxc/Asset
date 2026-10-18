// ข้อมูลตัวเลือกสำหรับ Form ครุภัณฑ์ — อ่านได้ทุก role ที่ login แล้ว, เพิ่มใหม่ได้เฉพาะ Admin
import express from 'express';

import * as optionsController from './options.controller.js';
import {
  validateCreateCategory,
  validateCreateLocation,
} from './options.validator.js';
import {
  authenticate,
  blockStudent,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';

const router = express.Router();
const adminRouter = express.Router();

// blockStudent ใส่ทีละ route ไม่ใส่ใน router.use เพราะ router นี้ mount ที่ '/' request ทุกอันที่ผ่านมาถึงจะโดนด้วย
router.use(authenticate);
// verifyCsrfToken ก่อน requireAdmin: เป็น check ที่ถูกกว่า (ไม่ query DB) จึงคัดออกก่อน
adminRouter.use(authenticate, verifyCsrfToken, requireAdmin);

// GET /api/categories
router.get('/categories', blockStudent, optionsController.getCategories);

// GET /api/locations
router.get('/locations', blockStudent, optionsController.getLocations);

// GET /api/available-equipment - ครุภัณฑ์ที่ว่างทุกชิ้น (ไม่แบ่งหน้า) สำหรับช่องเลือกในฟอร์มยืม/แจ้งซ่อม
// แยกจาก GET /api/equipment-items ที่จำกัด limit ไว้ 500 ไม่งั้นของที่เกิน 500 ชิ้นแรกจะเลือกไม่ได้เลย
router.get('/available-equipment', blockStudent, optionsController.getAvailableEquipment);

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
