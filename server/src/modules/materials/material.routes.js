// materialRouter (mount ที่ /api/materials): ผู้ใช้ทุกคนดูรายการ/เบิกวัสดุได้ (ตัดยอดทันที ไม่ต้องรออนุมัติ)
// adminMaterialRouter (mount ที่ /api/admin/materials): สงวนให้ Admin เพิ่ม/แก้ไข/ลบ/กู้คืน/ดูประวัติการเบิกทั้งหมด
import express from 'express';

import * as materialController from './material.controller.js';
import {
  validateCreateMaterial,
  validateMaterialIdParam,
  validateUpdateMaterial,
  validateWithdrawMaterial,
} from './material.validator.js';
import {
  authenticate,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';

const materialRouter = express.Router();
const adminMaterialRouter = express.Router();

materialRouter.use(authenticate);
// verifyCsrfToken ก่อน requireAdmin: เป็น check ที่ถูกกว่า (ไม่ query DB) จึงคัดออกก่อน
adminMaterialRouter.use(authenticate, verifyCsrfToken, requireAdmin);

// GET /api/materials - รายการวัสดุที่ยังไม่ถูกลบ ทุก role อ่านได้
materialRouter.get('/', materialController.getMaterialList);

// POST /api/materials/:id/withdraw - เบิกวัสดุ ตัดยอดทันที ไม่มีขั้นตอนรออนุมัติ (ต่างจากยืมครุภัณฑ์)
materialRouter.post(
  '/:id/withdraw',
  verifyCsrfToken,
  validateMaterialIdParam,
  validateWithdrawMaterial,
  materialController.withdrawMaterial,
);

// GET /api/admin/materials/deleted - รายการ Soft Delete (ต้องอยู่ก่อน /:id กันชนกัน)
adminMaterialRouter.get('/deleted', materialController.getDeletedMaterialList);

// GET /api/admin/materials/withdrawals - ประวัติการเบิกทั้งหมด (ทุกวัสดุ ทุกคน)
adminMaterialRouter.get('/withdrawals', materialController.getWithdrawals);

// POST /api/admin/materials - เพิ่มวัสดุใหม่
adminMaterialRouter.post(
  '/',
  validateCreateMaterial,
  materialController.createMaterial,
);

// PATCH /api/admin/materials/:id/restore - ทำให้ deleted_at กลับเป็น NULL
adminMaterialRouter.patch(
  '/:id/restore',
  validateMaterialIdParam,
  materialController.restoreMaterial,
);

// DELETE /api/admin/materials/:id - Soft Delete
adminMaterialRouter.delete(
  '/:id',
  validateMaterialIdParam,
  materialController.deleteMaterial,
);

// PATCH /api/admin/materials/:id - แก้ข้อมูลทั่วไป (รวมถึงปรับจำนวนคงเหลือตรงๆ เช่น ตอนรับของเข้าสต๊อก)
adminMaterialRouter.patch(
  '/:id',
  validateMaterialIdParam,
  validateUpdateMaterial,
  materialController.updateMaterial,
);

export { adminMaterialRouter };
export default materialRouter;
