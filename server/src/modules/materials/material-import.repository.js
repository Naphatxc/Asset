// Data Access Layer ของการนำเข้าวัสดุจากไฟล์ (material-import.service.js)
// หมวดหมู่ใช้ ensureCategories/findCategoryIdsByName ของ equipment-import.repository.js ร่วมกัน (ตาราง categories เดียวกัน)
import { prisma } from '../../config/prisma.js';

// รวมรหัสที่ถูก soft-delete ด้วย เพราะ material_code unique ทั้งตาราง สร้างซ้ำไม่ได้อยู่ดี
export async function findExistingCodes(codes, client = prisma) {
  const rows = await client.materials.findMany({
    where: { material_code: { in: codes } },
    select: { material_code: true },
  });
  return rows.map((row) => row.material_code.toUpperCase());
}

export async function createMany(rows, client = prisma) {
  const result = await client.materials.createMany({
    data: rows.map((row) => ({
      material_code: row.code,
      material_name: row.name,
      category_id: row.categoryId,
      quantity: row.quantity,
      minimum_quantity: row.minimumQuantity,
      expire_date: row.expireDate,
      unit_name: row.unitName,
      unit_price: row.unitPrice,
      remark: row.remark,
    })),
  });
  return result.count;
}
