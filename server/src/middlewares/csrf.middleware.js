// Double-submit cookie: เทียบค่า csrf_token cookie (set ตอน login) กับ header X-CSRF-Token
// ที่ client ต้องแนบเอง ป้องกัน CSRF เพราะเว็บอื่นสั่งให้ browser แนบ cookie ได้ แต่อ่าน cookie
// เพื่อเอาไปใส่ header ข้าม origin ไม่ได้ (ติด Same-Origin Policy)
import { AppError } from '../utils/AppError.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export function verifyCsrfToken(request, _response, next) {
  if (safeMethods.has(request.method)) {
    return next();
  }

  const cookieToken = request.cookies?.csrf_token;
  const headerToken = request.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new AppError(403, 'CSRF token ไม่ถูกต้องหรือหมดอายุ'));
  }

  next();
}
