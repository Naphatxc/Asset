// ใช้ร่วมกันระหว่างรูปครุภัณฑ์กับรูปวัสดุ: ส่งไฟล์รูปที่เก็บไว้ใต้ server/uploads และลบไฟล์ทิ้งแบบไม่สนผล
import fs from 'node:fs/promises';
import path from 'node:path';

import { AppError } from './AppError.js';

// URL ของรูปมี ?v=<ชื่อไฟล์> ติดไปด้วย (ดู serializer ของแต่ละโมดูล) เปลี่ยนรูปแล้ว URL เปลี่ยนตาม
// จึงให้ browser cache ได้ยาวๆ ไม่ต้องโหลดรูปซ้ำทุกครั้งที่เปิดตาราง
export function sendStoredImage(response, next, directory, fileName) {
  response.sendFile(
    path.join(directory, fileName),
    {
      headers: {
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Disposition': 'inline',
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
