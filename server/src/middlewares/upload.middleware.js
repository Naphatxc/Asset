// ตั้งค่า multer สำหรับอัปโหลดไฟล์ เก็บไฟล์จริงไว้ใต้ server/uploads แยกโฟลเดอร์ตามประเภท
// - repairs: ไฟล์แนบการแจ้งซ่อม (รูป/PDF หลายไฟล์)
// - equipment / materials: รูปครุภัณฑ์/วัสดุ (รูปเดียวต่อรายการ)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import multer from 'multer';

import { AppError } from '../utils/AppError.js';
import { thumbnailNameFor } from '../utils/storedImage.js';

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

// นามสกุลไฟล์ที่เก็บจริงมาจากชนิดไฟล์ที่ผ่าน fileFilter แล้วเท่านั้น ห้ามเอามาจากชื่อไฟล์ที่ client ส่งมา ไม่งั้น
// อัปโหลด "x.html" แต่อ้างว่าเป็น image/png ได้ แล้วตอนเสิร์ฟ Express เดา Content-Type จากนามสกุลเป็น text/html (XSS)
const extensionByMimeType = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};
const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const repairMimeTypes = new Set([...imageMimeTypes, 'application/pdf']);

function uniqueName() {
  return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

// multer เรียก fileFilter ก่อน filename เสมอ mimetype ตรงนี้จึงอยู่ใน extensionByMimeType แน่นอน
function uniqueFileName(_request, file) {
  return `${uniqueName()}${extensionByMimeType[file.mimetype] ?? ''}`;
}

// รูปกับรูปจิ๋วใน request เดียวกันใช้ชื่อฐานเดียวกัน หารูปจิ๋วของรูปไหนก็ได้จากชื่อรูปเลย (thumbnailNameFor)
// ไม่ต้องมีคอลัมน์เก็บชื่อรูปจิ๋วแยก ใช้ได้ไม่ว่า field ไหนจะมาถึงก่อน
function imageFileName(request, file) {
  request.uploadBaseName ??= uniqueName();
  const imageName = `${request.uploadBaseName}${extensionByMimeType[file.mimetype] ?? ''}`;

  return file.fieldname === 'thumbnail' ? thumbnailNameFor(imageName) : imageName;
}

function createStorage(directory, nameFor = uniqueFileName) {
  return multer.diskStorage({
    destination: (_request, _file, callback) => {
      callback(null, directory);
    },
    filename: (request, file, callback) => {
      callback(null, nameFor(request, file));
    },
  });
}

function createFileFilter(allowedMimeTypes, message) {
  return (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new AppError(400, message));
      return;
    }
    // รูปจิ๋วต้องเป็น JPEG เท่านั้น ชื่อไฟล์รูปจิ๋วตายตัวเป็น .thumb.jpg (ดู thumbnailNameFor)
    if (file.fieldname === 'thumbnail' && file.mimetype !== 'image/jpeg') {
      callback(new AppError(400, 'รูปจิ๋วต้องเป็นไฟล์ JPEG'));
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

// field "image" (บังคับ ตรวจที่ controller) + "thumbnail" (ไม่บังคับ รูปจิ๋ว JPEG สำหรับตาราง) อย่างละไฟล์
// client ย่อรูปก่อนส่งอยู่แล้ว (ดู ImageInput.jsx) เพดานขนาดนี้กันกรณีหลุดมาเท่านั้น
function createImageUpload(directory) {
  return wrapMulter(
    multer({
      storage: createStorage(directory, imageFileName),
      limits: { fileSize: 10 * 1024 * 1024, files: 2 },
      fileFilter: createFileFilter(
        imageMimeTypes,
        'รองรับเฉพาะไฟล์รูปภาพ (jpg, png, webp)',
      ),
    }).fields([
      { name: 'image', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ]),
    '10MB',
  );
}

// ไฟล์ที่ multer เขียนลง disk แล้วของ request รูปนี้ ไว้ให้ controller ลบทิ้งถ้าบันทึกไม่สำเร็จ
export function uploadedImageFiles(request) {
  return {
    image: request.files?.image?.[0] ?? null,
    thumbnail: request.files?.thumbnail?.[0] ?? null,
  };
}

export const uploadEquipmentImage = createImageUpload(equipmentImageDir);
export const uploadMaterialImage = createImageUpload(materialImageDir);
