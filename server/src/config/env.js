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
