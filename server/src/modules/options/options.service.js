// Business Logic สำหรับข้อมูลตัวเลือก (categories/locations) ของ Form ครุภัณฑ์
import * as categoryRepository from './category.repository.js';
import * as locationRepository from './location.repository.js';
import { AppError } from '../../utils/AppError.js';

export async function getCategories() {
  try {
    return await categoryRepository.findMany();
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดหมวดหมู่ได้', { cause: error });
  }
}

export async function getLocations() {
  try {
    return await locationRepository.findMany();
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดสถานที่ได้', { cause: error });
  }
}

export async function createCategory(categoryName, codePrefix) {
  try {
    return await categoryRepository.create({ categoryName, codePrefix });
  } catch (error) {
    if (error.code === 'P2002') {
      // target มาจาก unique constraint ที่ชนกัน (ดู map: ใน schema.prisma) เพื่อบอกผู้ใช้ให้ตรงจุด
      const target = String(error.meta?.target ?? '');

      throw new AppError(
        409,
        target.includes('code_prefix')
          ? 'มีหมวดหมู่ที่ใช้รหัสย่อนี้อยู่แล้ว'
          : 'มีหมวดหมู่ชื่อนี้อยู่แล้ว',
      );
    }

    throw new AppError(500, 'ไม่สามารถเพิ่มหมวดหมู่ได้', { cause: error });
  }
}

export async function createLocation({ locationName, building, room }) {
  try {
    return await locationRepository.create({ locationName, building, room });
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถเพิ่มสถานที่ได้', { cause: error });
  }
}
