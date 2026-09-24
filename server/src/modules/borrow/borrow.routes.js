// borrowRouter (mount ที่ /api/borrows): ผู้ใช้ทุกคนส่งคำขอยืม/ดูใบยืมของตัวเอง/คืนเองได้
// adminBorrowRouter (mount ที่ /api/admin/borrows): สงวนให้ Admin สร้างใบยืมแทนผู้ใช้ (อนุมัติทันที)/ดูรายการทั้งหมด/อนุมัติ-ปฏิเสธคำขอ
import express from 'express';

import * as borrowController from './borrow.controller.js';
import {
  validateBorrowDetailIdParam,
  validateBorrowIdParam,
  validateCreateBorrow,
  validateCreateMyBorrow,
} from './borrow.validator.js';
import {
  authenticate,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';

const borrowRouter = express.Router();
const adminBorrowRouter = express.Router();

borrowRouter.use(authenticate);
adminBorrowRouter.use(authenticate, verifyCsrfToken, requireAdmin);

// GET /api/borrows/mine - ใบยืมของตัวเอง
borrowRouter.get('/mine', borrowController.getMyBorrowList);

// POST /api/borrows - ส่งคำขอยืมให้ตัวเอง (ไม่รับ user_id จาก body) สถานะเริ่มที่ pending รอ Admin อนุมัติ
borrowRouter.post(
  '/',
  verifyCsrfToken,
  validateCreateMyBorrow,
  borrowController.requestBorrow,
);

// PATCH /api/borrows/details/:id/return - คืนของตัวเอง (Admin คืนแทนใครก็ได้ด้วย เช็คสิทธิ์ใน service)
borrowRouter.patch(
  '/details/:id/return',
  verifyCsrfToken,
  validateBorrowDetailIdParam,
  borrowController.returnBorrowDetail,
);

// GET /api/admin/borrows - รายการยืมทั้งหมด (ทุกสถานะ pending/approved/rejected) พร้อมสถานะแต่ละชิ้น
adminBorrowRouter.get('/', borrowController.getBorrowList);

// POST /api/admin/borrows - Admin สร้างใบยืมแทนผู้ใช้ ถือว่าอนุมัติทันที ข้าม pending
adminBorrowRouter.post(
  '/',
  validateCreateBorrow,
  borrowController.createBorrow,
);

// PATCH /api/admin/borrows/:id/approve - อนุมัติคำขอที่ pending อยู่
adminBorrowRouter.patch(
  '/:id/approve',
  validateBorrowIdParam,
  borrowController.approveBorrow,
);

// PATCH /api/admin/borrows/:id/reject - ปฏิเสธคำขอที่ pending อยู่
adminBorrowRouter.patch(
  '/:id/reject',
  validateBorrowIdParam,
  borrowController.rejectBorrow,
);

export { adminBorrowRouter };
export default borrowRouter;
