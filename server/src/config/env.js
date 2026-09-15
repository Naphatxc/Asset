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

// อายุ cookie ต้องตรงกับอายุ JWT (1h) ไม่งั้น cookie จะอยู่นานกว่า token ข้างใน
export const authCookieMaxAgeMs = 60 * 60 * 1000;

// httpOnly ป้องกัน JS อ่าน token; secure บังคับ HTTPS เฉพาะ production เพราะ dev เป็น http://localhost
export const accessTokenCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  maxAge: authCookieMaxAgeMs,
  path: '/',
};

// ต้อง httpOnly: false เพราะฝั่ง client ต้องอ่านค่านี้ไปแนบใน header X-CSRF-Token เอง (double-submit cookie)
export const csrfCookieOptions = {
  httpOnly: false,
  secure: isProduction,
  sameSite: 'lax',
  maxAge: authCookieMaxAgeMs,
  path: '/',
};
