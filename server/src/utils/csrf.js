// สุ่มค่า CSRF token สำหรับ pattern double-submit cookie (ดู middlewares/csrf.middleware.js)
import { randomBytes } from 'node:crypto';

export function generateCsrfToken() {
  return randomBytes(32).toString('hex');
}
