// adminAuditRouter (mount ที่ /api/admin/audits): ตรวจนับครุภัณฑ์ประจำปี สงวนให้ Admin เท่านั้น
import express from 'express';

import * as auditController from './audit.controller.js';
import {
  validateCheckItem,
  validateItemIdParam,
  validateOpenRound,
  validateRoundIdParam,
} from './audit.validator.js';
import {
  authenticate,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';

const adminAuditRouter = express.Router();

// verifyCsrfToken ข้าม GET ให้เองอยู่แล้ว จึงใส่รวมไว้ที่ระดับ router ได้
adminAuditRouter.use(authenticate, verifyCsrfToken, requireAdmin);

// GET /api/admin/audits - รายการรอบตรวจนับทั้งหมด พร้อมยอดสรุปแต่ละรอบ
adminAuditRouter.get('/', auditController.getRounds);

// POST /api/admin/audits - เปิดรอบใหม่ (เปิดได้ทีละรอบ) { title }
adminAuditRouter.post('/', validateOpenRound, auditController.openRound);

// GET /api/admin/audits/:id - รายละเอียดรอบ พร้อมผลตรวจของครุภัณฑ์ทุกชิ้นในรอบ
adminAuditRouter.get('/:id', validateRoundIdParam, auditController.getRound);

// PATCH /api/admin/audits/:id/close - ปิดรอบ ชิ้นที่ยังไม่ตรวจนับเป็น "ไม่พบ"
adminAuditRouter.patch(
  '/:id/close',
  validateRoundIdParam,
  auditController.closeRound,
);

// DELETE /api/admin/audits/:id - ลบรอบ ถ้ายังเปิดอยู่จะย้อนห้อง/สถานะชำรุด/ใบซ่อมที่รอบนี้เปลี่ยนไว้ก่อนลบ
adminAuditRouter.delete('/:id', validateRoundIdParam, auditController.deleteRound);

// PUT /api/admin/audits/:id/records/:itemId - บันทึก/แก้ผลตรวจหนึ่งชิ้น
// { result: normal|damaged, note?, location_id?, move_location? }
adminAuditRouter.put(
  '/:id/records/:itemId',
  validateRoundIdParam,
  validateItemIdParam,
  validateCheckItem,
  auditController.checkItem,
);

// DELETE /api/admin/audits/:id/records/:itemId - ล้างผลกลับเป็นยังไม่ตรวจ (ย้ายห้องคืน/เปลี่ยนสถานะชำรุดกลับให้)
adminAuditRouter.delete(
  '/:id/records/:itemId',
  validateRoundIdParam,
  validateItemIdParam,
  auditController.resetRecord,
);

export default adminAuditRouter;
