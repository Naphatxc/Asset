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
