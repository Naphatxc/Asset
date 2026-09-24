// Business Logic สำหรับข้อมูลตัวเลือก (categories/locations) ของ Form ครุภัณฑ์
import * as categoryRepository from './category.repository.js';
import * as locationRepository from './location.repository.js';
import * as equipmentRepository from '../equipment/equipment.repository.js';
import { AppError } from '../../utils/AppError.js';

// MySQL ไม่มี collation ที่เรียงข้อความไทยแบบพจนานุกรมถูกต้องสำหรับ utf8mb4 เลย (สระนำอย่าง "เ" ต้องถูก
// เรียงราวกับอยู่หลังพยัญชนะ เช่น "เครื่องใช้ไฟฟ้า" ต้องอยู่หมวด ค ไม่ใช่หมวด เ) มีแต่ tis620_thai_ci ซึ่งผูก
// กับ charset tis620 เก่าที่เก็บ Unicode เต็มรูปแบบไม่ได้ จึงเรียงด้วย Intl.Collator('th') ที่ฝั่งแอปแทน
const thaiCollator = new Intl.Collator('th');

export async function getCategories() {
  try {
    const categories = await categoryRepository.findMany();

    return categories.sort((a, b) =>
      thaiCollator.compare(a.category_name, b.category_name),
    );
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดหมวดหมู่ได้', { cause: error });
  }
}

export async function getLocations() {
  try {
    const locations = await locationRepository.findMany();

    return locations.sort((a, b) =>
      thaiCollator.compare(a.location_name, b.location_name),
    );
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดสถานที่ได้', { cause: error });
  }
}

export async function getAvailableEquipment() {
  try {
    return await equipmentRepository.findAvailableOptions();
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดรายการครุภัณฑ์ที่ว่างได้', { cause: error });
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
