// materialRouter (mount ที่ /api/materials): ผู้ใช้ทุกคนดูรายการ/เบิกวัสดุได้ (ตัดยอดทันที ไม่ต้องรออนุมัติ)
// adminMaterialRouter (mount ที่ /api/admin/materials): สงวนให้ Admin เพิ่ม/แก้ไข/ลบ/กู้คืน/ดูประวัติการเบิกทั้งหมด
import express from 'express';

import * as materialController from './material.controller.js';
import {
  validateCreateMaterial,
  validateImportMaterials,
  validateMaterialIdParam,
  validateReturnWithdrawal,
  validateUpdateMaterial,
  validateWithdrawMaterial,
  validateWithdrawalIdParam,
} from './material.validator.js';
import {
  authenticate,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';
import { uploadMaterialImage } from '../../middlewares/upload.middleware.js';

const materialRouter = express.Router();
const adminMaterialRouter = express.Router();

materialRouter.use(authenticate);
// verifyCsrfToken ก่อน requireAdmin: เป็น check ที่ถูกกว่า (ไม่ query DB) จึงคัดออกก่อน
adminMaterialRouter.use(authenticate, verifyCsrfToken, requireAdmin);

// GET /api/materials - รายการวัสดุที่ยังไม่ถูกลบ ทุก role อ่านได้
materialRouter.get('/', materialController.getMaterialList);

// GET /api/materials/my-withdrawals - ประวัติการเบิกของตัวเอง (?outstanding=1 = เฉพาะที่ยังค้างคืน)
materialRouter.get('/my-withdrawals', materialController.getMyWithdrawals);

// GET /api/materials/:id/image - รูปวัสดุ ทุก role เห็น
materialRouter.get('/:id/image', validateMaterialIdParam, materialController.getMaterialImage);

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

// GET /api/admin/materials/withdrawals - ประวัติการเบิกทั้งหมด (ทุกวัสดุ ทุกคน, ?outstanding=1 = เฉพาะที่ยังค้างคืน)
adminMaterialRouter.get('/withdrawals', materialController.getWithdrawals);

// POST /api/admin/materials/withdrawals/:withdrawalId/return - รับคืนวัสดุ { quantity, remark } คืนทีละส่วนได้
adminMaterialRouter.post(
  '/withdrawals/:withdrawalId/return',
  validateWithdrawalIdParam,
  validateReturnWithdrawal,
  materialController.returnWithdrawal,
);

// POST /api/admin/materials - เพิ่มวัสดุใหม่
adminMaterialRouter.post(
  '/',
  validateCreateMaterial,
  materialController.createMaterial,
);

// POST /api/admin/materials/import - นำเข้าวัสดุหลายรายการจากไฟล์ Excel { items: [...] }
// (body ใหญ่กว่าปกติ จึงมี parser แยกที่ app.js)
adminMaterialRouter.post(
  '/import',
  validateImportMaterials,
  materialController.importMaterials,
);

// PATCH /api/admin/materials/:id/restore - ทำให้ deleted_at กลับเป็น NULL
adminMaterialRouter.patch(
  '/:id/restore',
  validateMaterialIdParam,
  materialController.restoreMaterial,
);

// PUT /api/admin/materials/:id/image - อัปโหลดรูป (multipart field "image") แทนที่รูปเดิม
adminMaterialRouter.put(
  '/:id/image',
  validateMaterialIdParam,
  uploadMaterialImage,
  materialController.uploadMaterialImage,
);

// DELETE /api/admin/materials/:id/image - ลบรูป
adminMaterialRouter.delete(
  '/:id/image',
  validateMaterialIdParam,
  materialController.deleteMaterialImage,
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
