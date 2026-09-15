// Data Access Layer สำหรับตาราง categories
import { prisma } from '../../config/prisma.js';

export async function findMany(client = prisma) {
  return client.categories.findMany({
    select: {
      category_id: true,
      category_name: true,
      description: true,
    },
    orderBy: { category_name: 'asc' },
  });
}
