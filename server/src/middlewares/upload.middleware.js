// ตั้งค่า multer สำหรับอัปโหลดไฟล์ เก็บไฟล์จริงไว้ใต้ server/uploads แยกโฟลเดอร์ตามประเภท
// - repairs: ไฟล์แนบการแจ้งซ่อม (รูป/PDF หลายไฟล์)
// - equipment / materials: รูปครุภัณฑ์/วัสดุ (รูปเดียวต่อรายการ)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import multer from 'multer';

import { AppError } from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadRoot = path.join(__dirname, '..', '..', 'uploads');

export const repairUploadDir = path.join(uploadRoot, 'repairs');
export const equipmentImageDir = path.join(uploadRoot, 'equipment');
export const materialImageDir = path.join(uploadRoot, 'materials');

// multer ไม่สร้างโฟลเดอร์ปลายทางให้เอง โฟลเดอร์ใน repo มีอยู่ก็จริง (.gitkeep) แต่ถ้าต่อ Railway Volume ไว้ที่
// server/uploads (ต้องต่อ ไม่งั้นไฟล์หายทุกครั้งที่ deploy) volume ใหม่จะว่างเปล่า อัปโหลดแรกจะพังด้วย ENOENT
for (const directory of [repairUploadDir, equipmentImageDir, materialImageDir]) {
  fs.mkdirSync(directory, { recursive: true });
}

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const repairMimeTypes = new Set([...imageMimeTypes, 'application/pdf']);

function createStorage(directory) {
  return multer.diskStorage({
    destination: (_request, _file, callback) => {
      callback(null, directory);
    },
    filename: (_request, file, callback) => {
      const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      const extension = path.extname(file.originalname).slice(0, 10);

      callback(null, `${uniqueSuffix}${extension}`);
    },
  });
}

function createFileFilter(allowedMimeTypes, message) {
  return (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new AppError(400, message));
      return;
    }

    callback(null, true);
  };
}

// ห่อ multer เองเพื่อแปลง MulterError (เช่นไฟล์เกินขนาด) ให้เป็น AppError 400 แทนที่จะหลุดไป 500
function wrapMulter(upload, maxSizeLabel) {
  return (request, response, next) => {
    upload(request, response, (error) => {
      if (!error) return next();
      if (error instanceof AppError) return next(error);

      if (error instanceof multer.MulterError) {
        const message =
          error.code === 'LIMIT_FILE_SIZE'
            ? `ไฟล์มีขนาดใหญ่เกิน ${maxSizeLabel}`
            : 'อัปโหลดไฟล์ไม่สำเร็จ';
        return next(new AppError(400, message));
      }

      next(error);
    });
  };
}

export const uploadRepairFiles = wrapMulter(
  multer({
    storage: createStorage(repairUploadDir),
    limits: { fileSize: 10 * 1024 * 1024, files: 5 },
    fileFilter: createFileFilter(
      repairMimeTypes,
      'รองรับเฉพาะไฟล์รูปภาพ (jpg, png, webp) หรือ PDF',
    ),
  }).array('files', 5),
  '10MB',
);

// รับไฟล์เดียวจาก field "image" — client ย่อรูปก่อนส่งอยู่แล้ว (ดู ImageInput.jsx) เพดานนี้กันกรณีหลุดมาเท่านั้น
function createImageUpload(directory) {
  return wrapMulter(
    multer({
      storage: createStorage(directory),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      fileFilter: createFileFilter(
        imageMimeTypes,
        'รองรับเฉพาะไฟล์รูปภาพ (jpg, png, webp)',
      ),
    }).single('image'),
    '10MB',
  );
}

export const uploadEquipmentImage = createImageUpload(equipmentImageDir);
export const uploadMaterialImage = createImageUpload(materialImageDir);
