// repairRouter (mount ที่ /api/repairs): ผู้ใช้ทุกคนแจ้งซ่อมได้ และดูรายการ/ไฟล์แนบได้เฉพาะที่ตัวเองแจ้ง
// adminRepairRouter (mount ที่ /api/admin/repairs): ดูทุกรายการ/แนบไฟล์เพิ่ม/จัดการสถานะซ่อม สงวนให้ Admin
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

const repairRouter = express.Router();
const adminRepairRouter = express.Router();

// Admin เรียก route ฝั่ง User ได้ด้วย (เช่น หน้าแจ้งซ่อมของตัวเอง) จึงจำกัดเจ้าของเฉพาะคนที่ไม่ใช่ Admin
function limitToOwnRepairs(request, _response, next) {
  if (request.account?.role !== 'admin') request.repairOwnerId = Number(request.user.sub);
  next();
}

repairRouter.use(authenticate, limitToOwnRepairs);

// GET /api/repairs/mine - รายการแจ้งซ่อมที่ตัวเองแจ้ง
repairRouter.get('/mine', repairController.getMyRepairList);

// GET /api/repairs/files/:fileId - เปิดไฟล์แนบของรายการที่ตัวเองแจ้ง (ต้องมาก่อน /:id)
repairRouter.get('/files/:fileId', validateFileIdParam, repairController.downloadFile);

// GET /api/repairs/:id - รายละเอียดรายการที่ตัวเองแจ้ง
repairRouter.get('/:id', validateRepairIdParam, repairController.getRepairDetail);

// POST /api/repairs - แจ้งซ่อม (multipart: item_id, issue, files[]) ผู้แจ้งคือคนที่ login ไม่รับจาก body
repairRouter.post(
  '/',
  verifyCsrfToken,
  uploadRepairFiles,
  validateReportRepair,
  repairController.reportRepair,
);

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

export { repairRouter };
export default adminRepairRouter;
