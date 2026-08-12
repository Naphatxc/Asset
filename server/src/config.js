// โหลดและตรวจค่าตั้งต้นของ Server จาก server/.env เพียงจุดเดียว
import 'dotenv/config.js';

export const port = Number(process.env.PORT ?? 3000);
export const clientOrigin =
  process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
export const jwtSecret = String(process.env.JWT_SECRET ?? '');

if (jwtSecret.length < 64) {
  // หยุด Server ทันทีถ้า Secret ไม่ปลอดภัย แทนที่จะปล่อยให้ Login ทำงานผิดพลาดภายหลัง
  throw new Error('JWT_SECRET must contain at least 64 characters');
}
