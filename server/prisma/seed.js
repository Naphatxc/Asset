// สคริปต์ mock ข้อมูลสำหรับพัฒนา/ทดสอบ UI เท่านั้น — ไม่แตะตาราง users เลย
// รัน: node prisma/seed.js (จากโฟลเดอร์ server)
import { prisma } from '../src/config/prisma.js';

async function main() {
  const existing = await prisma.categories.count();

  if (existing > 0) {
    console.log('มีข้อมูล categories อยู่แล้ว ข้ามการ seed เพื่อไม่ให้ซ้ำ');
    return;
  }

  const categories = {};

  for (const name of [
    'คอมพิวเตอร์และอุปกรณ์ต่อพ่วง',
    'เฟอร์นิเจอร์สำนักงาน',
    'เครื่องใช้ไฟฟ้า',
    'อุปกรณ์โสตทัศนูปกรณ์',
    'เครื่องมือช่าง',
    'วัสดุสิ้นเปลืองสำนักงาน',
  ]) {
    const category = await prisma.categories.create({
      data: { category_name: name },
    });

    categories[name] = category.category_id;
  }

  const locations = {};

  for (const [name, building, room] of [
    ['ห้องธุรการ', 'อาคาร 1', '101'],
    ['ห้องประชุม', 'อาคาร 1', '201'],
    ['ห้องปฏิบัติการคอมพิวเตอร์', 'อาคาร 2', '301'],
    ['ห้องพัสดุ', 'อาคาร 2', '105'],
    ['โรงจอดรถ', 'อาคาร 3', null],
  ]) {
    const location = await prisma.locations.create({
      data: { location_name: name, building, room },
    });

    locations[name] = location.location_id;
  }

  const equipmentSeeds = [
    {
      equipment_name: 'คอมพิวเตอร์ตั้งโต๊ะ Dell OptiPlex',
      category: 'คอมพิวเตอร์และอุปกรณ์ต่อพ่วง',
      location: 'ห้องปฏิบัติการคอมพิวเตอร์',
      fiscal_year: 2023,
      price: '18500.00',
      status: 'available',
      code: 'PC-2566-001',
    },
    {
      equipment_name: 'คอมพิวเตอร์ตั้งโต๊ะ Dell OptiPlex',
      category: 'คอมพิวเตอร์และอุปกรณ์ต่อพ่วง',
      location: 'ห้องปฏิบัติการคอมพิวเตอร์',
      fiscal_year: 2023,
      price: '18500.00',
      status: 'borrowed',
      code: 'PC-2566-002',
    },
    {
      equipment_name: 'เครื่องพิมพ์ Laser HP',
      category: 'คอมพิวเตอร์และอุปกรณ์ต่อพ่วง',
      location: 'ห้องธุรการ',
      fiscal_year: 2023,
      price: '5200.00',
      status: 'available',
      code: 'PRN-2566-001',
    },
    {
      equipment_name: 'เครื่องสแกนเนอร์',
      category: 'คอมพิวเตอร์และอุปกรณ์ต่อพ่วง',
      location: 'ห้องธุรการ',
      fiscal_year: 2020,
      price: '4200.00',
      status: 'available',
      code: 'SCN-2563-001',
      warranty_expire: new Date('2024-01-01'), // หมดประกันแล้ว ไว้ทดสอบการแสดงผล
    },
    {
      equipment_name: 'โต๊ะทำงานเหล็ก',
      category: 'เฟอร์นิเจอร์สำนักงาน',
      location: 'ห้องธุรการ',
      fiscal_year: 2022,
      price: '3200.00',
      status: 'available',
      code: 'DESK-2565-001',
    },
    {
      equipment_name: 'เก้าอี้สำนักงาน',
      category: 'เฟอร์นิเจอร์สำนักงาน',
      location: 'ห้องประชุม',
      fiscal_year: 2022,
      price: '1500.00',
      status: 'pending_repair',
      code: 'CHR-2565-001',
    },
    {
      equipment_name: 'ตู้เอกสารเหล็ก 4 ลิ้นชัก',
      category: 'เฟอร์นิเจอร์สำนักงาน',
      location: 'ห้องธุรการ',
      fiscal_year: 2020,
      price: '2800.00',
      status: 'available',
      code: 'CAB-2563-001',
      deleted: true, // ทดสอบหน้ารายการที่ถูกลบ (Soft Delete)
    },
    {
      equipment_name: 'เครื่องปรับอากาศ',
      category: 'เครื่องใช้ไฟฟ้า',
      location: 'ห้องประชุม',
      fiscal_year: 2021,
      price: '25000.00',
      status: 'repairing',
      code: 'AC-2564-001',
    },
    {
      equipment_name: 'โปรเจกเตอร์',
      category: 'อุปกรณ์โสตทัศนูปกรณ์',
      location: 'ห้องประชุม',
      fiscal_year: 2023,
      price: '32000.00',
      status: 'available',
      code: 'PRJ-2566-001',
    },
    {
      equipment_name: 'กล้องวงจรปิด',
      category: 'อุปกรณ์โสตทัศนูปกรณ์',
      location: 'ห้องพัสดุ',
      fiscal_year: 2023,
      price: '3500.00',
      status: 'available',
      code: 'CCTV-2566-001',
    },
    {
      equipment_name: 'สว่านไฟฟ้า',
      category: 'เครื่องมือช่าง',
      location: 'ห้องพัสดุ',
      fiscal_year: 2022,
      price: '1200.00',
      status: 'available',
      code: 'DRL-2565-001',
    },
    {
      equipment_name: 'รถเข็นขนของ',
      category: 'เครื่องมือช่าง',
      location: 'โรงจอดรถ',
      fiscal_year: 2021,
      price: '900.00',
      status: 'available',
      code: 'CART-2564-001',
    },
  ];

  for (const seed of equipmentSeeds) {
    const equipment = await prisma.equipment.create({
      data: {
        equipment_name: seed.equipment_name,
        category_id: categories[seed.category],
        location_id: locations[seed.location],
        fiscal_year: seed.fiscal_year,
        receive_date: new Date(`${seed.fiscal_year}-10-01`),
      },
    });

    const item = await prisma.equipment_items.create({
      data: {
        equipment_id: equipment.equipment_id,
        equipment_name: seed.equipment_name,
        equipment_code: seed.code,
        status: seed.status,
        price: seed.price,
        warranty_expire: seed.warranty_expire ?? null,
        deleted_at: seed.deleted ? new Date() : null,
      },
    });

    // seed ไม่มี admin เป็นคนกระทำจริง จึงเว้น changed_by เป็น null
    await prisma.equipment_history.create({
      data: {
        item_id: item.item_id,
        action: 'created',
        new_data: { equipment_code: seed.code, status: seed.status },
        changed_by: null,
      },
    });
  }

  const materialSeeds = [
    {
      material_name: 'กระดาษ A4',
      category: 'วัสดุสิ้นเปลืองสำนักงาน',
      code: 'MAT-PAPER-001',
      quantity: 120,
      minimum_quantity: 50,
      unit_name: 'รีม',
      unit_price: '120.00',
    },
    {
      material_name: 'หมึกพิมพ์เลเซอร์',
      category: 'วัสดุสิ้นเปลืองสำนักงาน',
      code: 'MAT-INK-001',
      quantity: 3, // ต่ำกว่า minimum_quantity โดยตั้งใจ (ทดสอบแจ้งเตือนใกล้หมด)
      minimum_quantity: 5,
      unit_name: 'กล่อง',
      unit_price: '1800.00',
    },
    {
      material_name: 'ปากกาลูกลื่น',
      category: 'วัสดุสิ้นเปลืองสำนักงาน',
      code: 'MAT-PEN-001',
      quantity: 200,
      minimum_quantity: 100,
      unit_name: 'ด้าม',
      unit_price: '8.00',
    },
    {
      material_name: 'แบตเตอรี่ AA',
      category: 'เครื่องใช้ไฟฟ้า',
      code: 'MAT-BAT-001',
      quantity: 10, // ต่ำกว่า minimum_quantity โดยตั้งใจ
      minimum_quantity: 20,
      unit_name: 'ก้อน',
      unit_price: '15.00',
    },
    {
      material_name: 'สาย HDMI',
      category: 'คอมพิวเตอร์และอุปกรณ์ต่อพ่วง',
      code: 'MAT-HDMI-001',
      quantity: 15,
      minimum_quantity: 10,
      unit_name: 'เส้น',
      unit_price: '150.00',
    },
    {
      material_name: 'น้ำยาทำความสะอาดจอ',
      category: 'วัสดุสิ้นเปลืองสำนักงาน',
      code: 'MAT-CLEAN-001',
      quantity: 2, // ต่ำกว่า minimum_quantity โดยตั้งใจ
      minimum_quantity: 5,
      unit_name: 'ขวด',
      unit_price: '90.00',
    },
  ];

  for (const seed of materialSeeds) {
    await prisma.materials.create({
      data: {
        material_code: seed.code,
        material_name: seed.material_name,
        category_id: categories[seed.category],
        quantity: seed.quantity,
        minimum_quantity: seed.minimum_quantity,
        unit_name: seed.unit_name,
        unit_price: seed.unit_price,
      },
    });
  }

  console.log(
    `Seed สำเร็จ: ${Object.keys(categories).length} categories, ${Object.keys(locations).length} locations, ${equipmentSeeds.length} equipment items, ${materialSeeds.length} materials`,
  );
}

main()
  .catch((error) => {
    console.error('Seed ล้มเหลว:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
