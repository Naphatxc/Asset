// ใช้ร่วมกันระหว่างรูปครุภัณฑ์กับรูปวัสดุ: ส่งไฟล์รูปที่เก็บไว้ใต้ server/uploads และลบไฟล์ทิ้งแบบไม่สนผล
// แต่ละรูปอาจมีรูปจิ๋วคู่กัน ชื่อ <ชื่อรูปไม่รวมนามสกุล>.thumb.jpg (สร้างตอนอัปโหลด ดู upload.middleware.js)
import fs from 'node:fs/promises';
import path from 'node:path';

import { AppError } from './AppError.js';

export function thumbnailNameFor(fileName) {
  return `${path.parse(fileName).name}.thumb.jpg`;
}

const imageTypeByExtension = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// URL ของรูปมี ?v=<ชื่อไฟล์> ติดไปด้วย (ดู serializer ของแต่ละโมดูล) เปลี่ยนรูปแล้ว URL เปลี่ยนตาม
// จึงให้ browser cache ได้ยาวๆ ไม่ต้องโหลดรูปซ้ำทุกครั้งที่เปิดตาราง
//
// กำหนด Content-Type เองจาก whitelist ไม่ให้ Express เดาจากนามสกุล เพราะไฟล์ที่อัปโหลดก่อนแก้ upload.middleware.js
// อาจมีนามสกุลตามชื่อที่ client ตั้งมา (เช่น .html) นามสกุลนอก whitelist ส่งเป็นไฟล์ดาวน์โหลดแทนการเปิดในหน้าเว็บ
// CSP sandbox กันอีกชั้น ต่อให้เนื้อไฟล์เป็น HTML ก็รัน script บน origin ของระบบไม่ได้
//
// thumbnail: true = ขอรูปจิ๋ว (?size=thumb) ถ้ารูปนี้ไม่มีรูปจิ๋ว (อัปโหลดก่อนมีระบบรูปจิ๋ว) ส่งรูปเต็มแทน
export async function sendStoredImage(response, next, directory, fileName, { thumbnail = false } = {}) {
  let servedName = fileName;
  if (thumbnail) {
    const thumbName = thumbnailNameFor(fileName);
    const hasThumbnail = await fs
      .access(path.join(directory, thumbName))
      .then(() => true, () => false);
    if (hasThumbnail) servedName = thumbName;
  }

  const imageType = imageTypeByExtension[path.extname(servedName).toLowerCase()];

  response.sendFile(
    path.join(directory, servedName),
    {
      headers: {
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Type': imageType ?? 'application/octet-stream',
        'Content-Disposition': imageType ? 'inline' : 'attachment',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    },
    (sendError) => {
      if (!sendError || response.headersSent) return;

      // ไม่ส่ง error ดิบของ send กลับไป เพราะข้อความมี path จริงบน server ติดมาด้วย
      next(
        sendError.code === 'ENOENT'
          ? new AppError(404, 'ไม่พบไฟล์รูปบนเซิร์ฟเวอร์')
          : new AppError(500, 'ไม่สามารถเปิดรูปได้', { cause: sendError }),
      );
    },
  );
}

// ไฟล์หายไปแล้วก็ไม่เป็นไร เป้าหมายคือไม่ให้เหลือไฟล์กำพร้าใน volume เท่านั้น
export async function removeStoredFile(directory, fileName) {
  if (!fileName) return;
  await fs.unlink(path.join(directory, fileName)).catch(() => {});
}

// ลบรูปพร้อมรูปจิ๋วของมัน (รูปจิ๋วอาจไม่มีก็ได้)
export async function removeStoredImage(directory, fileName) {
  if (!fileName) return;
  await Promise.all([
    removeStoredFile(directory, fileName),
    removeStoredFile(directory, thumbnailNameFor(fileName)),
  ]);
}
