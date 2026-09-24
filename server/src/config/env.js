// โหลดและตรวจค่าตั้งต้นของ Server จาก server/.env เพียงจุดเดียว
import 'dotenv/config.js';

export const port = Number(process.env.PORT ?? 3000);
// รองรับหลาย Origin คั่นด้วย comma เช่น localhost และ IP สำหรับโทรศัพท์ในวง LAN
export const clientOrigins = String(
  process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
export const jwtSecret = String(process.env.JWT_SECRET ?? '');

if (jwtSecret.length < 64) {
  // หยุด Server ทันทีถ้า Secret ไม่ปลอดภัย แทนที่จะปล่อยให้ Login ทำงานผิดพลาดภายหลัง
  throw new Error('JWT_SECRET must contain at least 64 characters');
}

export const isProduction = process.env.NODE_ENV === 'production';

// URL หน้าเว็บที่ใส่ในลิงก์ของอีเมล (เช่น ลิงก์ตั้งรหัสผ่านใหม่) ห้ามเอามาจาก header ของ request (Host/Origin)
// เพราะคนยิง request ปลอม header ได้ ลิงก์ในอีเมลของเหยื่อจะชี้ไปเว็บของคนร้ายแล้ว token หลุด
export const appUrl = String(process.env.APP_URL ?? clientOrigins[0] ?? '').replace(/\/+$/, '');

// ส่งอีเมลผ่าน Brevo (HTTP API) ไม่ใช้ SMTP ตรงๆ เพราะผู้ให้บริการ hosting หลายเจ้าบล็อกพอร์ต SMTP ขาออก
// เลือก Brevo เพราะยืนยันแค่อีเมลผู้ส่งเดียว (เช่น Gmail ของภาควิชา) ก็ส่งได้ ไม่ต้องมีโดเมนของตัวเอง
// ไม่ได้ตั้งค่า: dev จะพิมพ์อีเมลลง console แทน ส่วน production ปิดฟีเจอร์ลืมรหัสผ่าน (ดู utils/mailer.js)
export const brevoApiKey = String(process.env.BREVO_API_KEY ?? '').trim();
// ต้องเป็นอีเมลที่ยืนยันใน Brevo แล้ว (Senders) ไม่งั้น Brevo ปฏิเสธการส่ง
export const mailFromEmail = String(process.env.MAIL_FROM_EMAIL ?? '').trim();
export const mailFromName = String(
  process.env.MAIL_FROM_NAME ?? 'ระบบจัดการวัสดุและครุภัณฑ์',
).trim();

// ลิงก์ตั้งรหัสผ่านใหม่ใช้ได้นานเท่านี้ และขอลิงก์ใหม่ให้บัญชีเดิมได้ไม่ถี่กว่านี้ (กันใช้ฟอร์มยิงอีเมลใส่คนอื่นรัวๆ)
export const passwordResetTtlMs = 30 * 60 * 1000;
export const passwordResetCooldownMs = 60 * 1000;

// นโยบาย session แบบเว็บทั่วไป (OWASP แนะนำ idle + absolute timeout คู่กัน): ใช้งานอยู่ = ต่ออายุไปเรื่อยๆ
// ไม่ได้แตะเลยเกิน idle timeout = หลุด และต่อได้ไม่เกิน absolute timeout นับจาก login จริง กันบัญชีค้าง
// บนเครื่องที่ใช้ร่วมกันในภาควิชาไปตลอด (ต่ออายุทำใน auth.middleware.js ผ่าน utils/access-token.js)
export const sessionIdleTimeoutMs = 2 * 60 * 60 * 1000;
export const sessionAbsoluteTimeoutMs = 12 * 60 * 60 * 1000;
// ต่ออายุเฉพาะ token ที่ออกมาเกินช่วงนี้แล้ว ไม่ต้อง sign ใหม่ทุก request
export const sessionRenewAfterMs = 5 * 60 * 1000;

// อายุ cookie ต้องตรงกับอายุ JWT ไม่งั้น cookie จะอยู่นานกว่า token ข้างใน
export const authCookieMaxAgeMs = sessionIdleTimeoutMs;

// ชื่อ cookie รวมไว้จุดเดียว ให้ทุกที่ที่ set/read/clear cookie (auth.middleware.js, csrf.middleware.js,
// auth.controller.js) อ้างอิงค่าเดียวกันเสมอ กันเหตุการณ์แบบ logout ไม่เคลียร์ cookie เพราะพิมพ์ชื่อไม่ตรงกัน
export const accessTokenCookieName = 'access_token';
export const csrfTokenCookieName = 'csrf_token';

// httpOnly ป้องกัน JS อ่าน token; secure บังคับ HTTPS เฉพาะ production เพราะ dev เป็น http://localhost
//
// sameSite: production (เช่น Railway) client/server อยู่คนละ subdomain (*.up.railway.app ถือเป็นคนละ
// site กันโดยตั้งใจ กัน cookie รั่วข้ามโปรเจกต์อื่นบน Railway) จึงเป็น cross-site request เสมอ ต้องใช้
// 'none' (บังคับคู่กับ secure: true) cookie ถึงจะแนบไปกับ fetch/XHR ข้าม origin ได้ ส่วน dev เป็น
// same-site (localhost คนละ port ยังนับ lax ได้) ใช้ 'lax' พอ และ browser ปฏิเสธ sameSite: 'none'
// ที่ไม่ใช่ https อยู่แล้ว จึงใช้ none ตอน dev (http) ไม่ได้
export const accessTokenCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: authCookieMaxAgeMs,
  path: '/',
};

// ต้อง httpOnly: false เพราะฝั่ง client ต้องอ่านค่านี้ไปแนบใน header X-CSRF-Token เอง (double-submit cookie)
export const csrfCookieOptions = {
  httpOnly: false,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  maxAge: authCookieMaxAgeMs,
  path: '/',
};
