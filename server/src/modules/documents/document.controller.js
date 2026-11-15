import * as documentService from './document.service.js';
import { AppError } from '../../utils/AppError.js';

// ประวัติการส่งของคนที่ login อยู่ (ไม่รับ user_id จาก query จึงดูของคนอื่นไม่ได้)
export async function getMyDocuments(request, response, next) {
  try {
    const submissions = await documentService.getSubmissions({
      userId: Number(request.user.sub),
      docType: request.validated.docType,
    });

    response.status(200).json({ submissions });
  } catch (error) {
    next(error);
  }
}

export async function getAllDocuments(request, response, next) {
  try {
    const submissions = await documentService.getSubmissions({
      docType: request.validated.docType,
    });

    response.status(200).json({ submissions });
  } catch (error) {
    next(error);
  }
}

export async function submitDocument(request, response, next) {
  try {
    const submission = await documentService.submitDocument(
      Number(request.user.sub),
      request.validated,
      request.file,
    );

    response.status(201).json({ message: 'ส่งเอกสารสำเร็จ', submission });
  } catch (error) {
    await documentService.removeUploadedFile(request.file);
    next(error);
  }
}

export async function reviewDocument(request, response, next) {
  try {
    const { submissionId, decision, reviewNote } = request.validated;
    const submission = await documentService.reviewSubmission(
      submissionId,
      Number(request.user.sub),
      { decision, reviewNote },
      request.file,
    );

    response.status(200).json({ message: 'บันทึกผลการตรวจแล้ว', submission });
  } catch (error) {
    await documentService.removeUploadedFile(request.file);
    next(error);
  }
}

// ส่งเป็นไฟล์ดาวน์โหลดเสมอ (Content-Disposition: attachment) ไม่เปิดในหน้าเว็บ เพราะเป็นไฟล์ที่ผู้ใช้อัปโหลดมาเอง
// response.download ตั้งชื่อไฟล์ตอนดาวน์โหลดเป็นชื่อเดิมที่ผู้ส่งตั้งให้ (รองรับชื่อภาษาไทย)
async function sendDownload(request, response, next, kind) {
  try {
    const download = await documentService.getDownload(
      request.validated.submissionId,
      {
        actorId: Number(request.user.sub),
        // authenticate โหลด role ล่าสุดจาก DB ไว้ใน request.account แล้ว ไม่ต้อง query ซ้ำ
        isAdmin: request.account?.role === 'admin',
      },
      kind,
    );

    response.download(
      download.absolutePath,
      download.fileName,
      {
        headers: {
          'Content-Type': download.contentType,
          // กันอีกชั้น: ต่อให้เนื้อไฟล์เป็น HTML ก็รัน script บน origin ของระบบไม่ได้ (เหมือนรูปใน utils/storedImage.js)
          'Content-Security-Policy': "default-src 'none'; sandbox",
        },
      },
      (sendError) => {
        // ผู้ใช้ยกเลิกดาวน์โหลดกลางทางก็เข้ามาตรงนี้ได้ ตอนนั้นส่ง header ไปแล้ว ไม่ต้องตอบอะไรอีก
        if (!sendError || response.headersSent) return;

        // ไม่ส่ง error ดิบของ send กลับไป เพราะข้อความมี path จริงบน server ติดมาด้วย
        next(
          sendError.code === 'ENOENT'
            ? new AppError(404, 'ไม่พบไฟล์บนเซิร์ฟเวอร์ ไฟล์อาจถูกลบไปแล้ว')
            : new AppError(500, 'ไม่สามารถดาวน์โหลดไฟล์ได้', { cause: sendError }),
        );
      },
    );
  } catch (error) {
    next(error);
  }
}

export function downloadSubmissionFile(request, response, next) {
  return sendDownload(request, response, next, 'submission');
}

export function downloadReviewFile(request, response, next) {
  return sendDownload(request, response, next, 'review');
}
