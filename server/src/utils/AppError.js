// Error ที่มี statusCode ชัดเจน ใช้ throw จาก Service เพื่อให้ error middleware ส่ง response ที่ถูกต้อง
export class AppError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.statusCode = statusCode;
  }
}
