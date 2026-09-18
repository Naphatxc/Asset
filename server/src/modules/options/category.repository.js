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

export async function create(categoryName, client = prisma) {
  return client.categories.create({
    data: { category_name: categoryName },
    select: {
      category_id: true,
      category_name: true,
      description: true,
    },
  });
}
