// adminRepairRouter (mount ที่ /api/admin/repairs): แจ้งซ่อม/ดูรายละเอียด/จัดการสถานะซ่อม สงวนให้ Admin เท่านั้นตาม spec
import express from 'express';

import * as repairController from './repair.controller.js';
import {
  validateCompleteRepair,
  validateFileIdParam,
  validateReportRepair,
  validateRepairIdParam,
} from './repair.validator.js';
import {
  authenticate,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';
import { uploadRepairFiles } from '../../middlewares/upload.middleware.js';

const adminRepairRouter = express.Router();

adminRepairRouter.use(authenticate, requireAdmin);

// GET /api/admin/repairs?status=&item_id= - รายการแจ้งซ่อมทั้งหมด กรองได้
adminRepairRouter.get('/', repairController.getRepairList);

// GET /api/admin/repairs/files/:fileId - ดาวน์โหลด/ดูไฟล์แนบ (ต้องมาก่อน /:id เพื่อไม่ให้ Express จับ "files" เป็น :id)
adminRepairRouter.get(
  '/files/:fileId',
  validateFileIdParam,
  repairController.downloadFile,
);

// GET /api/admin/repairs/:id - รายละเอียดรายการแจ้งซ่อมหนึ่งรายการ พร้อมไฟล์แนบ
adminRepairRouter.get(
  '/:id',
  validateRepairIdParam,
  repairController.getRepairDetail,
);

// POST /api/admin/repairs - แจ้งซ่อม (multipart: item_id, issue, files[])
adminRepairRouter.post(
  '/',
  verifyCsrfToken,
  uploadRepairFiles,
  validateReportRepair,
  repairController.reportRepair,
);

// POST /api/admin/repairs/:id/files - แนบไฟล์เพิ่มให้รายการที่มีอยู่แล้ว
adminRepairRouter.post(
  '/:id/files',
  verifyCsrfToken,
  validateRepairIdParam,
  uploadRepairFiles,
  repairController.addRepairFiles,
);

// PATCH /api/admin/repairs/:id/start - เริ่มซ่อม (pending_repair -> repairing)
adminRepairRouter.patch(
  '/:id/start',
  verifyCsrfToken,
  validateRepairIdParam,
  repairController.startRepair,
);

// PATCH /api/admin/repairs/:id/complete - บันทึกผลซ่อมเสร็จ (repairing -> completed)
adminRepairRouter.patch(
  '/:id/complete',
  verifyCsrfToken,
  validateRepairIdParam,
  validateCompleteRepair,
  repairController.completeRepair,
);

// PATCH /api/admin/repairs/:id/cancel - ยกเลิกการแจ้งซ่อม
adminRepairRouter.patch(
  '/:id/cancel',
  verifyCsrfToken,
  validateRepairIdParam,
  repairController.cancelRepair,
);

export default adminRepairRouter;
