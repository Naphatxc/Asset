// Serializable ทดแทน SELECT ... FOR UPDATE เดิม และ retry เมื่อชนกัน (P2034) ใช้ร่วมกันทุก service
// ที่ต้องเขียนข้อมูลแบบ atomic (equipment/borrow/repair) รวมไว้จุดเดียวกันโค้ดสามไฟล์เพี้ยนไปคนละแบบ
import { prisma } from '../config/prisma.js';

export async function runSerializableTransaction(callback) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: 'Serializable',
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (error.code !== 'P2034' || attempt === 3) throw error;
    }
  }

  throw new Error(
    'Transaction failed after 3 attempts due to serialization conflicts (P2034)',
  );
}
