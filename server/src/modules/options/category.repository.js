// Data Access Layer สำหรับตาราง categories
import { prisma } from '../../config/prisma.js';

// ไม่ orderBy ที่ DB เพราะ MySQL ไม่มี collation ที่เรียงข้อความไทยแบบพจนานุกรมถูกต้อง (ดูเหตุผลเต็มๆ ใน
// options.service.js) เรียงด้วย Intl.Collator('th') ที่ชั้น service แทน ที่นี่ส่งดิบๆ ไปพอ
export async function findMany(client = prisma) {
  return client.categories.findMany({
    select: {
      category_id: true,
      category_name: true,
      description: true,
      code_prefix: true,
    },
  });
}

export async function findById(categoryId, client = prisma) {
  return client.categories.findUnique({
    where: { category_id: categoryId },
    select: {
      category_id: true,
      category_name: true,
      description: true,
      code_prefix: true,
    },
  });
}

export async function create({ categoryName, codePrefix }, client = prisma) {
  return client.categories.create({
    data: { category_name: categoryName, code_prefix: codePrefix },
    select: {
      category_id: true,
      category_name: true,
      description: true,
      code_prefix: true,
    },
  });
}
