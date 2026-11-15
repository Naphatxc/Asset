// Business Logic สำหรับเอกสารที่ผู้ใช้ส่งให้ Admin: IDP (ส่งไป-กลับ มีการตรวจ) และ OBE 3 / OBE 5 (ส่งอย่างเดียว)
// ทุกการส่งเป็นแถวใหม่ใน document_submissions เสมอ ไม่ทับของเดิม จึงเป็น log วันเวลาที่ส่งไปในตัว
//
// Flow ของ IDP: ส่ง (submitDocument) -> status = pending + อีเมลแจ้ง Admin ทุกคน -> Admin ตรวจ (reviewSubmission)
// -> approved (ผ่าน) หรือ returned (ส่งกลับให้แก้ พร้อมหมายเหตุ/ไฟล์กลับ) + อีเมลแจ้งผู้ส่ง
// -> ถ้าถูกส่งกลับ ผู้ส่งแก้แล้วส่งใหม่ = เริ่ม flow เดิมอีกรอบเป็นแถวใหม่
import path from 'node:path';

import { notifyIdpPending, notifyIdpReviewed } from './document.mail.js';
import * as documentRepository from './document.repository.js';
import {
  documentFileType,
  documentUploadDir,
} from '../../middlewares/upload.middleware.js';
import { AppError } from '../../utils/AppError.js';
import { removeStoredFile } from '../../utils/storedImage.js';
import { runSerializableTransaction } from '../../utils/transaction.js';

// ต้องตรงกับ @db.VarChar(255) ของ file_name / review_file_name ใน schema.prisma
const MAX_FILE_NAME_LENGTH = 255;

// ไฟล์จาก multer -> ค่าที่เก็บลง DB: ชื่อที่ผู้ส่งตั้ง (ไว้ใช้ตอนดาวน์โหลด) + ชื่อที่ระบบตั้งให้ตอนเก็บ + ชนิดไฟล์
function describeFile(file) {
  return {
    name: String(file.originalname).slice(0, MAX_FILE_NAME_LENGTH),
    path: file.filename,
    type: documentFileType(file.filename),
  };
}

// ไม่ส่งชื่อไฟล์จริงบน server (file_path) ออกไป ให้ client ดาวน์โหลดผ่าน URL ที่เช็คสิทธิ์ก่อนเสมอ
function serializeSubmission(submission) {
  const id = submission.submission_id;

  return {
    submission_id: id,
    doc_type: submission.doc_type,
    academic_year: submission.academic_year,
    note: submission.note,
    user_id: submission.user_id,
    user_name: submission.users?.name ?? null,
    file_name: submission.file_name,
    file_url: `/api/documents/${id}/file`,
    submitted_at: submission.submitted_at,
    status: submission.status,
    reviewed_at: submission.reviewed_at,
    reviewer_name: submission.reviewer?.name ?? null,
    review_note: submission.review_note,
    review_file_name: submission.review_file_name,
    review_file_url: submission.review_file_path ? `/api/documents/${id}/review-file` : null,
  };
}

// userId: ส่งมา = เฉพาะของคนนั้น (หน้าของผู้ส่ง) ไม่ส่ง = ของทุกคน (หน้า Admin)
export async function getSubmissions({ userId, docType } = {}) {
  try {
    const submissions = await documentRepository.findMany({ userId, docType });
    return submissions.map(serializeSubmission);
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดรายการเอกสารได้', { cause: error });
  }
}

export async function submitDocument(userId, { docType, academicYear, note }, file) {
  try {
    const stored = describeFile(file);
    const submission = await documentRepository.create({
      user_id: userId,
      doc_type: docType,
      academic_year: academicYear,
      note,
      file_name: stored.name,
      file_path: stored.path,
      file_type: stored.type,
      // IDP ต้องผ่านการตรวจ จึงเริ่มที่รอตรวจ ส่วน OBE 3 / OBE 5 ส่งอย่างเดียว ไม่มีสถานะ
      status: docType === 'idp' ? 'pending' : null,
    });

    // ทุกครั้งที่ IDP เข้าสถานะรอตรวจ (ส่งใหม่หลังถูกส่งกลับก็นับ) แจ้ง Admin ทางอีเมล — ไม่ await ดู document.mail.js
    if (submission.status === 'pending') notifyIdpPending(submission);

    return serializeSubmission(submission);
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถส่งเอกสารได้', { cause: error });
  }
}

// ตรวจได้เฉพาะ IDP ที่ยังรอตรวจ เช็คสถานะกับบันทึกผลอยู่ใน transaction เดียวกัน กัน Admin สองคนกดตรวจรายการเดียวกันพร้อมกัน
// file = ไฟล์ที่ Admin แนบกลับ (ไม่บังคับ)
export async function reviewSubmission(submissionId, reviewerId, { decision, reviewNote }, file) {
  try {
    const stored = file ? describeFile(file) : null;

    const result = await runSerializableTransaction(async (tx) => {
      const submission = await documentRepository.findById(submissionId, tx);

      if (!submission) return { error: 'ไม่พบเอกสาร', status: 404 };
      if (submission.doc_type !== 'idp') {
        return { error: 'เอกสารประเภทนี้ไม่มีขั้นตอนตรวจ', status: 400 };
      }
      if (submission.status !== 'pending') {
        return { error: 'เอกสารนี้ถูกตรวจไปแล้ว', status: 409 };
      }

      const reviewed = await documentRepository.update(
        submissionId,
        {
          status: decision,
          reviewed_by: reviewerId,
          reviewed_at: new Date(),
          review_note: reviewNote,
          review_file_name: stored?.name ?? null,
          review_file_path: stored?.path ?? null,
          review_file_type: stored?.type ?? null,
        },
        tx,
      );

      return { submission: reviewed };
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    // แจ้งผลให้เจ้าของเอกสารทางอีเมล — ไม่ await ดู document.mail.js
    notifyIdpReviewed(result.submission);

    return serializeSubmission(result.submission);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถบันทึกผลการตรวจได้', { cause: error });
  }
}

// kind: 'submission' = ไฟล์ที่ผู้ใช้ส่ง, 'review' = ไฟล์ที่ Admin แนบกลับ
// ดาวน์โหลดได้เฉพาะเจ้าของเอกสารกับ Admin ของคนอื่นตอบ 404 เหมือนไม่มีอยู่ ไม่บอกว่ามีแต่ไม่มีสิทธิ์
export async function getDownload(submissionId, { actorId, isAdmin }, kind) {
  let submission;

  try {
    submission = await documentRepository.findById(submissionId);
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถดาวน์โหลดไฟล์ได้', { cause: error });
  }

  if (!submission || (!isAdmin && submission.user_id !== actorId)) {
    throw new AppError(404, 'ไม่พบเอกสาร');
  }

  const storedName = kind === 'review' ? submission.review_file_path : submission.file_path;
  const fileName = kind === 'review' ? submission.review_file_name : submission.file_name;

  if (!storedName) {
    throw new AppError(404, 'เอกสารนี้ไม่มีไฟล์แนบกลับ');
  }

  return {
    absolutePath: path.join(documentUploadDir, storedName),
    fileName,
    contentType: documentFileType(storedName),
  };
}

// multer เขียนไฟล์ลง disk ไปแล้วก่อนถึง service ถ้าบันทึกลง DB ไม่สำเร็จต้องลบไฟล์กำพร้าทิ้ง (ไม่มีไฟล์ก็ไม่เป็นไร)
export async function removeUploadedFile(file) {
  await removeStoredFile(documentUploadDir, file?.filename);
}
