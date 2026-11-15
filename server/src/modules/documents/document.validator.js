// ตรวจ input สำหรับการส่งเอกสาร IDP / OBE 3 / OBE 5 และการตรวจ IDP ของ Admin
import { documentUploadDir } from '../../middlewares/upload.middleware.js';
import { AppError } from '../../utils/AppError.js';
import { todayInBangkok } from '../../utils/dueDate.js';
import { removeStoredFile } from '../../utils/storedImage.js';

// ฝั่ง client (utils/documents.js) ต้องตรงกัน
const DOC_TYPES = ['idp', 'obe3', 'obe5'];
const REVIEW_DECISIONS = ['approved', 'returned'];
// note / review_note เป็น TEXT ไม่จำกัดจาก DB จึงกันความยาวไว้ฝั่งนี้เอง
const MAX_NOTE_LENGTH = 1000;
// ปีการศึกษา (พ.ศ.) ที่รับ: ย้อนหลังได้ถึงปีนี้ ล่วงหน้าได้ไม่เกินปีถัดไป กันพิมพ์ผิดเป็น ค.ศ. หรือปีที่เป็นไปไม่ได้
const MIN_ACADEMIC_YEAR = 2560;

function maxAcademicYear() {
  return Number(todayInBangkok().slice(0, 4)) + 543 + 1;
}

// validator ของ route ที่รับไฟล์ทำงานหลัง multer ซึ่งเขียนไฟล์ลง disk ไปแล้ว ถ้า input ไม่ผ่านต้องลบไฟล์นั้นทิ้ง
// ไม่งั้นเหลือไฟล์กำพร้าใน volume (ไม่ต้องรอผลการลบ removeStoredFile ไม่ throw)
function rejectUpload(request, next, message) {
  removeStoredFile(documentUploadDir, request.file?.filename);
  next(new AppError(400, message));
}

export function validateSubmitDocument(request, _response, next) {
  const body = request.body ?? {};
  const docType = String(body.doc_type ?? '');
  const academicYear = Number(body.academic_year);
  const note = String(body.note ?? '').trim() || null;

  if (!DOC_TYPES.includes(docType)) {
    return rejectUpload(request, next, 'ประเภทเอกสารไม่ถูกต้อง');
  }
  if (
    !Number.isInteger(academicYear) ||
    academicYear < MIN_ACADEMIC_YEAR ||
    academicYear > maxAcademicYear()
  ) {
    return rejectUpload(
      request,
      next,
      `ปีการศึกษาต้องเป็น พ.ศ. ระหว่าง ${MIN_ACADEMIC_YEAR}–${maxAcademicYear()}`,
    );
  }
  if (note && note.length > MAX_NOTE_LENGTH) {
    return rejectUpload(request, next, `หมายเหตุต้องไม่เกิน ${MAX_NOTE_LENGTH} ตัวอักษร`);
  }
  if (!request.file) {
    return next(new AppError(400, 'กรุณาแนบไฟล์เอกสาร'));
  }

  request.validated = { docType, academicYear, note };
  next();
}

// ?type=idp|obe3|obe5 ไม่ส่ง = ทุกประเภท
export function validateDocumentTypeQuery(request, _response, next) {
  const docType = String(request.query.type ?? '') || undefined;

  if (docType && !DOC_TYPES.includes(docType)) {
    return next(new AppError(400, 'ประเภทเอกสารไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, docType };
  next();
}

export function validateDocumentIdParam(request, _response, next) {
  const submissionId = Number(request.params.id);

  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return next(new AppError(400, 'รหัสเอกสารไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, submissionId };
  next();
}

export function validateReviewDocument(request, _response, next) {
  const body = request.body ?? {};
  const decision = String(body.decision ?? '');
  const reviewNote = String(body.review_note ?? '').trim() || null;

  if (!REVIEW_DECISIONS.includes(decision)) {
    return rejectUpload(request, next, 'กรุณาเลือกผลการตรวจ (ผ่าน หรือ ส่งกลับให้แก้ไข)');
  }
  if (reviewNote && reviewNote.length > MAX_NOTE_LENGTH) {
    return rejectUpload(request, next, `หมายเหตุต้องไม่เกิน ${MAX_NOTE_LENGTH} ตัวอักษร`);
  }
  // ส่งกลับให้แก้ต้องบอกผู้ส่งว่าให้แก้อะไร จะเป็นหมายเหตุหรือไฟล์ที่แนบกลับก็ได้
  if (decision === 'returned' && !reviewNote && !request.file) {
    return next(new AppError(400, 'ส่งกลับให้แก้ไขต้องระบุหมายเหตุ หรือแนบไฟล์กลับ'));
  }

  request.validated = { ...request.validated, decision, reviewNote };
  next();
}

// ต้องตรงกับ @db.VarChar ของ document_types ใน schema.prisma (ฝั่ง client: DocumentTypeNamesDialog.jsx)
const MAX_TYPE_LABEL_LENGTH = 50;
const MAX_TYPE_TITLE_LENGTH = 150;

// PATCH /api/admin/documents/types/:docType  body: { label, title } ต้องส่งมาทั้งสองช่อง
export function validateUpdateDocumentType(request, _response, next) {
  const docType = String(request.params.docType ?? '');
  const label = String(request.body?.label ?? '').trim();
  const title = String(request.body?.title ?? '').trim();

  if (!DOC_TYPES.includes(docType)) {
    return next(new AppError(400, 'ประเภทเอกสารไม่ถูกต้อง'));
  }
  if (!label || label.length > MAX_TYPE_LABEL_LENGTH) {
    return next(new AppError(400, `ชื่อสั้นต้องมี 1–${MAX_TYPE_LABEL_LENGTH} ตัวอักษร`));
  }
  if (!title || title.length > MAX_TYPE_TITLE_LENGTH) {
    return next(new AppError(400, `ชื่อเต็มต้องมี 1–${MAX_TYPE_TITLE_LENGTH} ตัวอักษร`));
  }

  request.validated = { ...request.validated, docType, label, title };
  next();
}
