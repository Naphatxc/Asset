// Data Access Layer สำหรับตาราง locations
import { prisma } from '../../config/prisma.js';

export async function findMany(client = prisma) {
  return client.locations.findMany({
    select: {
      location_id: true,
      location_name: true,
      building: true,
      room: true,
    },
    orderBy: { location_name: 'asc' },
  });
}
