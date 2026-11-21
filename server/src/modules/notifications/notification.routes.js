// /api/admin/notifications: Admin ตั้งค่าอีเมลแจ้งเตือนของระบบ (เปิด/ปิด ผู้รับ ข้อความ) ดู notification.catalog.js สำหรับเหตุการณ์ทั้งหมด
import express from 'express';

import * as notificationController from './notification.controller.js';
import {
  validateEventKeyParam,
  validateTemplateBody,
  validateUpdateNotification,
} from './notification.validator.js';
import { authenticate, requireAdmin } from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';

const adminNotificationRouter = express.Router();

adminNotificationRouter.use(authenticate, verifyCsrfToken, requireAdmin);

// GET /api/admin/notifications - เหตุการณ์ทั้งหมดพร้อมค่าที่ตั้งไว้ ตัวแปรที่ใช้ได้ ค่าเริ่มต้น และรายชื่อ Admin
adminNotificationRouter.get('/', notificationController.getSettings);

// PUT /api/admin/notifications/:eventKey - บันทึกทั้งชุด { enabled, recipient_mode, admin_ids, extra_emails, subject, body }
adminNotificationRouter.put(
  '/:eventKey',
  validateUpdateNotification,
  notificationController.updateSetting,
);

// DELETE /api/admin/notifications/:eventKey - คืนค่าเริ่มต้นของเหตุการณ์นี้
adminNotificationRouter.delete(
  '/:eventKey',
  validateEventKeyParam,
  notificationController.resetSetting,
);

// POST /api/admin/notifications/:eventKey/preview { subject, body } - ตัวอย่างอีเมล (ยังไม่บันทึก ไม่ส่งจริง)
adminNotificationRouter.post(
  '/:eventKey/preview',
  validateTemplateBody,
  notificationController.previewTemplate,
);

// POST /api/admin/notifications/:eventKey/test { subject, body } - ส่งตัวอย่างถึงอีเมลของ Admin ที่กดเอง
adminNotificationRouter.post(
  '/:eventKey/test',
  validateTemplateBody,
  notificationController.sendTestEmail,
);

export default adminNotificationRouter;
