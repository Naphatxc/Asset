// Export ครุภัณฑ์ทั้งหมด (ที่ยังไม่ถูกลบ) จากฐานข้อมูลที่ตั้งค่าใน server/.env เป็นไฟล์ JSON
// สำหรับกด "นำเข้า" ในแท็บครุภัณฑ์ของอีกระบบ (เช่น ย้ายข้อมูลจากเครื่อง dev ขึ้น production)
//
// รัน: npm --workspace server run export:equipment -- <ไฟล์ปลายทาง.json> [--without-locations]
//   --without-locations  ไม่ใส่สถานที่ (ใช้เมื่อสถานที่ในเครื่องต้นทางเป็นข้อมูลทดสอบ ไปตั้งจริงตอนตรวจนับ)
//
// ไม่ส่ง id ใดๆ ไป เพราะ id ข้ามฐานข้อมูลไม่มีความหมาย หมวดหมู่/สถานที่จับคู่กันด้วยชื่อตอนนำเข้า
import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '../src/config/prisma.js';

function toDateString(value) {
  return value ? value.toISOString().slice(0, 10) : null;
}

async function main() {
  const args = process.argv.slice(2);
  const outputPath = args.find((arg) => !arg.startsWith('--'));
  const withoutLocations = args.includes('--without-locations');

  if (!outputPath) {
    console.error('ระบุไฟล์ปลายทาง เช่น npm --workspace server run export:equipment -- equipment-export.json');
    process.exitCode = 1;
    return;
  }

  const items = await prisma.equipment_items.findMany({
    where: { deleted_at: null },
    include: { equipment: { include: { categories: true, locations: true } } },
    orderBy: { item_id: 'asc' },
  });

  const rows = items.map((item) => {
    const details = item.equipment;
    const location = withoutLocations ? null : details.locations;

    return {
      equipment_code: item.equipment_code,
      equipment_name: details.equipment_name,
      category_name: details.categories.category_name,
      location_name: location?.location_name ?? null,
      location_building: location?.building ?? null,
      location_room: location?.room ?? null,
      fiscal_year: details.fiscal_year,
      description: details.description,
      receive_date: toDateString(details.receive_date),
      remark: details.remark,
      price: item.price === null ? null : item.price.toString(),
      warranty_expire: toDateString(item.warranty_expire),
    };
  });

  const output = {
    format: 'asset-equipment-v1',
    exported_at: new Date().toISOString(),
    count: rows.length,
    items: rows,
  };

  const absolutePath = path.resolve(outputPath);
  fs.writeFileSync(absolutePath, JSON.stringify(output, null, 2));
  console.log(`export ครุภัณฑ์ ${rows.length} รายการ -> ${absolutePath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
