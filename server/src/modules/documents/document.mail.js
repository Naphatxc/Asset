// อีเมลแจ้งเตือนของเอกสาร IDP (OBE 3 / OBE 5 ส่งอย่างเดียว ไม่มีอีเมล)
// - IDP เข้าสถานะรอตรวจ (ส่งครั้งแรก หรือแก้แล้วส่งใหม่) -> แจ้ง Admin ทุกคน
// - Admin ตรวจเสร็จ (ผ่าน / ส่งกลับให้แก้ไข) -> แจ้งเจ้าของเอกสาร
// ส่งแบบไม่รอผล: ผู้เรียกไม่ต้อง await อีเมลส่งไม่สำเร็จดูได้ใน log แต่ไม่ทำให้การส่ง/ตรวจเอกสารล้มตามไปด้วย
import { appUrl } from '../../config/env.js';
import { escapeHtml, isMailConfigured, sendMail } from '../../utils/mailer.js';
import * as userRepository from '../users/user.repository.js';

const buttonStyle =
  'display:inline-block;padding:12px 20px;border-radius:8px;background:#ed0082;color:#ffffff;text-decoration:none;font-weight:700';

// "14 พ.ย. 2569 15:36" ตามเวลาไทย (server รันเป็น UTC จึงต้องระบุ timeZone เอง)
function formatDateTime(date) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

// rows = [[หัวข้อ, ค่า], ...] ใช้สร้างทั้งอีเมลแบบข้อความล้วนและแบบ HTML จากข้อมูลชุดเดียวกัน
function buildEmail({ subject, intro, rows, closing, link, linkLabel }) {
  return {
    subject,
    text: [
      intro,
      '',
      ...rows.map(([label, value]) => `${label}: ${value}`),
      '',
      ...(closing ? [closing, ''] : []),
      `${linkLabel}:`,
      link,
    ].join('\n'),
    html: `
      <p>${escapeHtml(intro)}</p>
      <p>${rows
        .map(([label, value]) => `${escapeHtml(label)}: <strong>${escapeHtml(value)}</strong>`)
        .join('<br>')}</p>
      ${closing ? `<p>${escapeHtml(closing)}</p>` : ''}
      <p><a href="${link}" style="${buttonStyle}">${escapeHtml(linkLabel)}</a></p>
    `,
  };
}

function buildPendingEmail(submission) {
  return buildEmail({
    subject: `IDP รอตรวจ: ${submission.users.name} (ปีการศึกษา ${submission.academic_year})`,
    intro: 'มีแผนพัฒนาบุคลากรรายบุคคล (IDP) ส่งเข้ามารอตรวจ',
    rows: [
      ['ผู้ส่ง', `${submission.users.name} (${submission.users.email})`],
      ['ปีการศึกษา', submission.academic_year],
      ['ไฟล์', submission.file_name],
      ['ส่งเมื่อ', `${formatDateTime(submission.submitted_at)} น.`],
      ...(submission.note ? [['หมายเหตุ', submission.note]] : []),
    ],
    link: `${appUrl}/?tab=documents`,
    linkLabel: 'เปิดระบบเพื่อตรวจ',
  });
}

function buildReviewedEmail(submission) {
  const approved = submission.status === 'approved';
  const result = approved ? 'ผ่าน' : 'ส่งกลับให้แก้ไข';

  return buildEmail({
    subject: `ผลการตรวจ IDP: ${result} (ปีการศึกษา ${submission.academic_year})`,
    intro: `สวัสดีคุณ ${submission.users.name} แผนพัฒนาบุคลากรรายบุคคล (IDP) ที่คุณส่งไว้ตรวจเสร็จแล้ว`,
    rows: [
      ['ผลการตรวจ', result],
      ['ปีการศึกษา', submission.academic_year],
      ['ไฟล์ที่ส่ง', submission.file_name],
      ['ส่งเมื่อ', `${formatDateTime(submission.submitted_at)} น.`],
      ['ตรวจเมื่อ', `${formatDateTime(submission.reviewed_at)} น.`],
      ...(submission.review_note ? [['หมายเหตุจากผู้ตรวจ', submission.review_note]] : []),
      ...(submission.review_file_name
        ? [['ไฟล์ที่แนบกลับ', `${submission.review_file_name} (ดาวน์โหลดได้ในระบบ)`]]
        : []),
    ],
    closing: approved ? null : 'กรุณาแก้ไขตามหมายเหตุ แล้วส่ง IDP ใหม่ในระบบ',
    link: `${appUrl}/?tab=idp`,
    linkLabel: 'เปิดระบบเพื่อดูรายละเอียด',
  });
}

// ส่งแยกทีละคน Admin จะไม่เห็นอีเมลของกันและกัน และอีเมลของคนหนึ่งส่งไม่ผ่านก็ไม่กระทบคนอื่น
async function sendPendingEmails(submission) {
  const message = buildPendingEmail(submission);
  const admins = await userRepository.findAdmins();
  const results = await Promise.allSettled(
    admins.map((admin) => sendMail({ to: admin.email, ...message })),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Failed to send IDP pending email', result.reason);
    }
  }
}

async function sendReviewedEmail(submission) {
  await sendMail({ to: submission.users.email, ...buildReviewedEmail(submission) });
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
