// Data Access Layer สำหรับตาราง locations
import { prisma } from '../../config/prisma.js';

// ไม่ orderBy ที่ DB ด้วยเหตุผลเดียวกับ category.repository.js — เรียงด้วย Intl.Collator('th') ที่ service แทน
export async function findMany(client = prisma) {
  return client.locations.findMany({
    select: {
      location_id: true,
      location_name: true,
      building: true,
      room: true,
    },
  });
}

export async function create({ locationName, building, room }, client = prisma) {
  return client.locations.create({
    data: { location_name: locationName, building, room },
    select: {
      location_id: true,
      location_name: true,
      building: true,
      room: true,
    },
  });
}
