// อีเมลแจ้งเตือนของเอกสาร IDP (OBE 3 / OBE 5 ส่งอย่างเดียว ไม่มีอีเมล)
// - IDP เข้าสถานะรอตรวจ (ส่งครั้งแรก หรือแก้แล้วส่งใหม่) -> แจ้ง Admin ทุกคน
// - Admin ตรวจเสร็จ (ผ่าน / ส่งกลับให้แก้ไข) -> แจ้งเจ้าของเอกสาร
// ไฟล์นี้แค่เตรียมข้อมูลของอีเมล ส่วนผู้รับ เปิด/ปิด และข้อความ Admin ปรับได้จากแท็บ "แจ้งเตือนอีเมล"
// (modules/notifications) ถ้าไม่เคยตั้งค่าจะส่งตามค่าเริ่มต้นเหมือนเดิมทุกอย่าง
// ส่งแบบไม่รอผล: ผู้เรียกไม่ต้อง await อีเมลส่งไม่สำเร็จดูได้ใน log แต่ไม่ทำให้การส่ง/ตรวจเอกสารล้มตามไปด้วย
import { appUrl } from '../../config/env.js';
import { isMailConfigured } from '../../utils/mailer.js';
import { sendNotification } from '../notifications/notification.service.js';
import * as documentRepository from './document.repository.js';

// "14 พ.ย. 2569 15:36" ตามเวลาไทย (server รันเป็น UTC จึงต้องระบุ timeZone เอง)
function formatDateTime(date) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

// ชื่อที่ Admin ตั้งไว้ของประเภทนี้ (document_types) ถ้าอ่านไม่ได้ใช้ชื่อเดิมแทน อีเมลจะได้ยังส่งได้
async function typeNames(docType) {
  const type = await documentRepository.findType(docType).catch(() => null);
  return type ?? { label: 'IDP', title: 'แผนพัฒนาบุคลากรรายบุคคล (IDP)' };
}

// rows = [[หัวข้อ, ค่า], ...] คือตัวแปร {{details}} ของแม่แบบ ส่วน values คือตัวแปรเดี่ยว (ชื่อตรงกับ notification.catalog.js)
async function sendPendingEmails(submission) {
  const names = await typeNames(submission.doc_type);
  const submittedAt = `${formatDateTime(submission.submitted_at)} น.`;

  await sendNotification('idp_pending', {
    requester: { name: submission.users.name, email: submission.users.email },
    values: {
      doc_label: names.label,
      doc_title: names.title,
      sender_name: submission.users.name,
      sender_email: submission.users.email,
      academic_year: submission.academic_year,
      file_name: submission.file_name,
      submitted_at: submittedAt,
      note: submission.note ?? '',
    },
    rows: [
      ['ผู้ส่ง', `${submission.users.name} (${submission.users.email})`],
      ['ปีการศึกษา', submission.academic_year],
      ['ไฟล์', submission.file_name],
      ['ส่งเมื่อ', submittedAt],
      ...(submission.note ? [['หมายเหตุ', submission.note]] : []),
    ],
    link: `${appUrl}/?tab=documents`,
  });
}

async function sendReviewedEmail(submission) {
  const names = await typeNames(submission.doc_type);
  const approved = submission.status === 'approved';
  const result = approved ? 'ผ่าน' : 'ส่งกลับให้แก้ไข';
  const submittedAt = `${formatDateTime(submission.submitted_at)} น.`;
  const reviewedAt = `${formatDateTime(submission.reviewed_at)} น.`;

  await sendNotification('idp_reviewed', {
    requester: { name: submission.users.name, email: submission.users.email },
    values: {
      doc_label: names.label,
      doc_title: names.title,
      owner_name: submission.users.name,
      result,
      academic_year: submission.academic_year,
      file_name: submission.file_name,
      submitted_at: submittedAt,
      reviewed_at: reviewedAt,
      review_note: submission.review_note ?? '',
      // ว่างเมื่อผ่าน ย่อหน้าที่มีแต่ตัวแปรนี้จะถูกตัดทิ้งจากอีเมลเอง
      closing: approved ? '' : `กรุณาแก้ไขตามหมายเหตุ แล้วส่ง ${names.label} ใหม่ในระบบ`,
    },
    rows: [
      ['ผลการตรวจ', result],
      ['ปีการศึกษา', submission.academic_year],
      ['ไฟล์ที่ส่ง', submission.file_name],
      ['ส่งเมื่อ', submittedAt],
      ['ตรวจเมื่อ', reviewedAt],
      ...(submission.review_note ? [['หมายเหตุจากผู้ตรวจ', submission.review_note]] : []),
      ...(submission.review_file_name
        ? [['ไฟล์ที่แนบกลับ', `${submission.review_file_name} (ดาวน์โหลดได้ในระบบ)`]]
        : []),
    ],
    link: `${appUrl}/?tab=idp`,
  });
}

// สองฟังก์ชันด้านล่างคืนค่าทันทีโดยไม่รอผลส่ง และไม่ throw ออกไปหาผู้เรียกเลย (งานจริงอยู่ใน async function ข้างบน
// error ทุกแบบจึงมาลงที่ .catch) เอกสารที่บันทึกลง DB ไปแล้วต้องไม่ถูกตอบว่าล้มเหลวเพียงเพราะอีเมลมีปัญหา
export function notifyIdpPending(submission) {
  // production ที่ยังไม่ได้ตั้งค่าบริการส่งอีเมล: ข้ามไปเฉยๆ การส่งเอกสารยังใช้ได้ตามปกติ
  if (!isMailConfigured()) return;

  sendPendingEmails(submission).catch((error) => {
    console.error('Failed to send IDP pending email', error);
  });
}

export function notifyIdpReviewed(submission) {
  if (!isMailConfigured()) return;

  sendReviewedEmail(submission).catch((error) => {
    console.error('Failed to send IDP review email', error);
  });
}
