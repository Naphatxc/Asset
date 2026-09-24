// ส่งอีเมลผ่าน Brevo transactional API (https://developers.brevo.com/reference/sendtransacemail)
// ตั้งค่าด้วย BREVO_API_KEY + MAIL_FROM_EMAIL (+ MAIL_FROM_NAME ไม่บังคับ) ดู config/env.js ถ้ายังไม่ได้ตั้ง:
//   - dev: พิมพ์อีเมลลง console แทน ทดสอบ flow ลืมรหัสผ่านในเครื่องได้โดยไม่ต้องมีบัญชี Brevo
//   - production: isMailConfigured() เป็น false ให้ผู้เรียกปิดฟีเจอร์ไปเลย ไม่แกล้งตอบว่าส่งแล้วทั้งที่ไม่ได้ส่ง
import { brevoApiKey, isProduction, mailFromEmail, mailFromName } from '../config/env.js';

function hasCredentials() {
  return Boolean(brevoApiKey && mailFromEmail);
}

export function isMailConfigured() {
  return hasCredentials() || !isProduction;
}

export async function sendMail({ to, subject, html, text }) {
  if (!hasCredentials()) {
    if (isProduction) throw new Error('Mail is not configured (BREVO_API_KEY / MAIL_FROM_EMAIL)');

    console.info(`[mail:dev] to=${to} subject=${subject}\n${text}`);
    return;
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': brevoApiKey,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: mailFromEmail, name: mailFromName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  // Brevo ตอบ 201 เมื่อรับเข้าคิวส่งแล้ว ที่เหลือถือว่าส่งไม่สำเร็จ (เช่น key ผิด ผู้ส่งยังไม่ยืนยัน)
  if (!response.ok) {
    throw new Error(`Brevo responded ${response.status}: ${await response.text()}`);
  }
}
