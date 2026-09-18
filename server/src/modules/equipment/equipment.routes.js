// โมดูลครุภัณฑ์มี Router อ่านข้อมูลสำหรับทุกคน และ Router จัดการสำหรับ Admin
import express from 'express';

import * as equipmentController from './equipment.controller.js';
import {
  validateCreateEquipment,
  validateItemIdParam,
  validateUpdateEquipment,
  validateUpdateEquipmentStatus,
} from './equipment.validator.js';
import {
  authenticate,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';

const equipmentRouter = express.Router();
const adminEquipmentRouter = express.Router();

equipmentRouter.use(authenticate);
// verifyCsrfToken ก่อน requireAdmin: เป็น check ที่ถูกกว่า (ไม่ query DB) จึงคัดออกก่อน
adminEquipmentRouter.use(authenticate, verifyCsrfToken, requireAdmin);

// GET /api/equipment-items - รายการที่ยังไม่ถูกลบ ทุก role อ่านได้
equipmentRouter.get('/', equipmentController.getEquipmentList);

// GET /api/equipment-items/:code - รายละเอียดหนึ่งชิ้น ปลายทางนี้จะใช้กับ QR
equipmentRouter.get('/:code', equipmentController.getEquipmentByCode);

// POST /api/admin/equipment-items - เพิ่มข้อมูลและ History ใน Transaction เดียว
adminEquipmentRouter.post(
  '/',
  validateCreateEquipment,
  equipmentController.createEquipment,
);

// GET /api/admin/equipment-items/deleted - รายการ Soft Delete
adminEquipmentRouter.get(
  '/deleted',
  equipmentController.getDeletedEquipmentList,
);

// GET /api/admin/equipment-items/next-code?category_id= - เดารหัสครุภัณฑ์ตัวถัดไปจาก code_prefix ของหมวดหมู่
adminEquipmentRouter.get(
  '/next-code',
  equipmentController.getNextEquipmentCode,
);

// GET /api/admin/equipment-items/:id/history - Audit Log พร้อมชื่อผู้เปลี่ยน
adminEquipmentRouter.get(
  '/:id/history',
  validateItemIdParam,
  equipmentController.getEquipmentHistory,
);

// PATCH /api/admin/equipment-items/:id/status - เปลี่ยนเฉพาะสถานะ
adminEquipmentRouter.patch(
  '/:id/status',
  validateItemIdParam,
  validateUpdateEquipmentStatus,
  equipmentController.updateEquipmentStatus,
);

// PATCH /api/admin/equipment-items/:id/restore - ทำให้ deleted_at กลับเป็น NULL
adminEquipmentRouter.patch(
  '/:id/restore',
  validateItemIdParam,
  equipmentController.restoreEquipment,
);

// DELETE /api/admin/equipment-items/:id - Soft Delete
adminEquipmentRouter.delete(
  '/:id',
  validateItemIdParam,
  equipmentController.deleteEquipment,
);

// PATCH /api/admin/equipment-items/:id - แก้ข้อมูลทั่วไป ยกเว้น code และ status
adminEquipmentRouter.patch(
  '/:id',
  validateItemIdParam,
  validateUpdateEquipment,
  equipmentController.updateEquipment,
);

export { adminEquipmentRouter };
export default equipmentRouter;
