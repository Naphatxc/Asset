// ตั้งค่า multer สำหรับอัปโหลดไฟล์แนบการแจ้งซ่อม เก็บไฟล์จริงไว้ที่ server/uploads/repairs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import multer from 'multer';

import { AppError } from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const repairUploadDir = path.join(
  __dirname,
  '..',
  '..',
  'uploads',
  'repairs',
);

// multer ไม่สร้างโฟลเดอร์ปลายทางให้เอง โฟลเดอร์ใน repo มีอยู่ก็จริง (.gitkeep) แต่ถ้าต่อ Railway Volume ไว้ที่
// server/uploads (ต้องต่อ ไม่งั้นไฟล์หายทุกครั้งที่ deploy) volume ใหม่จะว่างเปล่า อัปโหลดแรกจะพังด้วย ENOENT
fs.mkdirSync(repairUploadDir, { recursive: true });

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, repairUploadDir);
  },
  filename: (_request, file, callback) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const extension = path.extname(file.originalname).slice(0, 10);

    callback(null, `${uniqueSuffix}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        new AppError(400, 'รองรับเฉพาะไฟล์รูปภาพ (jpg, png, webp) หรือ PDF'),
      );
      return;
    }

    callback(null, true);
  },
}).array('files', 5);

// ห่อ multer เองเพื่อแปลง MulterError (เช่นไฟล์เกิน 10MB) ให้เป็น AppError 400 แทนที่จะหลุดไป 500
export function uploadRepairFiles(request, response, next) {
  upload(request, response, (error) => {
    if (!error) return next();
    if (error instanceof AppError) return next(error);

    if (error instanceof multer.MulterError) {
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'ไฟล์มีขนาดใหญ่เกิน 10MB'
          : 'อัปโหลดไฟล์ไม่สำเร็จ';
      return next(new AppError(400, message));
    }

    next(error);
  });
}
