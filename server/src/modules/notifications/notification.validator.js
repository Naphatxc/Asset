// ตรวจรูปแบบ request ของหน้าตั้งค่าแจ้งเตือน (กฎเนื้อหา เช่น ตัวแปรที่ใช้ได้ ผู้รับต้องเป็น Admin อยู่ใน notification.service.js
// เพราะต้องรู้ข้อมูลของเหตุการณ์นั้นๆ ที่นี่ตรวจแค่ชนิดและความยาว)
import { AppError } from '../../utils/AppError.js';
import { RECIPIENT_MODES } from './notification.catalog.js';
import { MAX_BODY_LENGTH, MAX_SUBJECT_LENGTH } from './notification.template.js';

function readTemplate(body) {
  const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
  const text = typeof body?.body === 'string' ? body.body.trim() : '';

  if (!subject || subject.length > MAX_SUBJECT_LENGTH) {
    throw new AppError(400, `หัวเรื่องต้องมี 1–${MAX_SUBJECT_LENGTH} ตัวอักษร`);
  }
  if (!text || text.length > MAX_BODY_LENGTH) {
    throw new AppError(400, `เนื้อความต้องมี 1–${MAX_BODY_LENGTH} ตัวอักษร`);
  }

  return { subject, body: text };
}

// :eventKey ไม่ต้องเช็คที่นี่ service ตอบ 404 เองถ้าไม่มีเหตุการณ์นั้น
function readEventKey(request) {
  return String(request.params.eventKey ?? '');
}

// PUT /api/admin/notifications/:eventKey
// body: { enabled, recipient_mode, admin_ids, extra_emails, subject, body } ต้องส่งมาครบ (แทนที่ทั้งชุด)
export function validateUpdateNotification(request, _response, next) {
  try {
    const { enabled, recipient_mode: recipientMode, admin_ids: adminIds } = request.body ?? {};
    const extraEmails = request.body?.extra_emails ?? '';

    if (typeof enabled !== 'boolean') throw new AppError(400, 'สถานะเปิด/ปิดไม่ถูกต้อง');
    if (!RECIPIENT_MODES.includes(recipientMode)) throw new AppError(400, 'ผู้รับไม่ถูกต้อง');
    if (!Array.isArray(adminIds) || !adminIds.every((id) => Number.isInteger(id) && id > 0)) {
      throw new AppError(400, 'รายชื่อ Admin ไม่ถูกต้อง');
    }
    if (typeof extraEmails !== 'string' && !Array.isArray(extraEmails)) {
      throw new AppError(400, 'อีเมลผู้รับพิเศษไม่ถูกต้อง');
    }

    // รับได้ทั้งข้อความคั่นด้วยจุลภาค/เว้นวรรค/ขึ้นบรรทัดใหม่ และ array
    const emailList = (Array.isArray(extraEmails) ? extraEmails.join(',') : extraEmails)
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    request.validated = {
      eventKey: readEventKey(request),
      enabled,
      recipientMode,
      adminIds,
      extraEmails: emailList,
      ...readTemplate(request.body),
    };
    next();
  } catch (error) {
    next(error);
  }
}

// POST /api/admin/notifications/:eventKey/preview และ /test  body: { subject, body } (ข้อความในฟอร์มตอนนั้น)
export function validateTemplateBody(request, _response, next) {
  try {
    request.validated = { eventKey: readEventKey(request), ...readTemplate(request.body) };
    next();
  } catch (error) {
    next(error);
  }
}

export function validateEventKeyParam(request, _response, next) {
  request.validated = { eventKey: readEventKey(request) };
  next();
}
