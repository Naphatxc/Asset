// documentRouter (mount ที่ /api/documents): ทุกคนที่ login ส่งเอกสาร IDP / OBE 3 / OBE 5 และดูประวัติการส่งของตัวเอง
//   ไฟล์ดาวน์โหลดได้เฉพาะเจ้าของเอกสารกับ Admin (เช็คสิทธิ์ใน document.service.js)
// adminDocumentRouter (mount ที่ /api/admin/documents): Admin ดูเอกสารของทุกคน และตรวจ IDP (ผ่าน / ส่งกลับให้แก้ไข)
import express from 'express';

import * as documentController from './document.controller.js';
import {
  validateDocumentIdParam,
  validateDocumentTypeQuery,
  validateReviewDocument,
  validateSubmitDocument,
} from './document.validator.js';
import {
  authenticate,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';
import { uploadDocumentFile } from '../../middlewares/upload.middleware.js';

const documentRouter = express.Router();
const adminDocumentRouter = express.Router();

documentRouter.use(authenticate);
// verifyCsrfToken ก่อน requireAdmin: เป็น check ที่ถูกกว่า (ไม่ query DB) จึงคัดออกก่อน
adminDocumentRouter.use(authenticate, verifyCsrfToken, requireAdmin);

// GET /api/documents/mine?type=idp|obe3|obe5 - ประวัติการส่งของตัวเอง ใหม่สุดก่อน (ไม่ส่ง type = ทุกประเภท)
documentRouter.get('/mine', validateDocumentTypeQuery, documentController.getMyDocuments);

// POST /api/documents - ส่งเอกสาร (multipart: doc_type, academic_year, note?, file) ผู้ส่งคือคนที่ login ไม่รับจาก body
// verifyCsrfToken ต้องมาก่อน uploadDocumentFile ไม่งั้น request ปลอมจะเขียนไฟล์ลง disk ได้ก่อนโดนปฏิเสธ
documentRouter.post(
  '/',
  verifyCsrfToken,
  uploadDocumentFile,
  validateSubmitDocument,
  documentController.submitDocument,
);

// GET /api/documents/:id/file - ดาวน์โหลดไฟล์ที่ส่ง
documentRouter.get(
  '/:id/file',
  validateDocumentIdParam,
  documentController.downloadSubmissionFile,
);

// GET /api/documents/:id/review-file - ดาวน์โหลดไฟล์ที่ Admin แนบกลับตอนตรวจ IDP
documentRouter.get(
  '/:id/review-file',
  validateDocumentIdParam,
  documentController.downloadReviewFile,
);

// GET /api/admin/documents?type=idp|obe3|obe5 - เอกสารของทุกคน ใหม่สุดก่อน
adminDocumentRouter.get('/', validateDocumentTypeQuery, documentController.getAllDocuments);

// PATCH /api/admin/documents/:id/review - ตรวจ IDP (multipart: decision=approved|returned, review_note?, file?)
// เช็ครหัสก่อนรับไฟล์ รหัสผิดจะได้ไม่ต้องเขียนไฟล์ลง disk เลย
adminDocumentRouter.patch(
  '/:id/review',
  validateDocumentIdParam,
  uploadDocumentFile,
  validateReviewDocument,
  documentController.reviewDocument,
);

export { adminDocumentRouter };
export default documentRouter;
