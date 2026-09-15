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
