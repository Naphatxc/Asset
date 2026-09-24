// Data Access Layer สำหรับ materials / material_withdrawals / material_returns — ทุกฟังก์ชันรับ Prisma transaction client ได้ (default = prisma)
import { prisma } from '../../config/prisma.js';

export const materialInclude = {
  categories: true,
};

const withdrawalInclude = {
  materials: true,
  users: true,
};

// แบ่งหน้า (page/limit) + ค้นหารหัส/ชื่อ + กรองหมวดหมู่ แทนที่จะดึงมาทั้งหมดทีเดียว (เหมือน equipment.repository.js)
function buildListWhere({ deleted, search, categoryId }) {
  return {
    deleted_at: deleted ? { not: null } : null,
    ...(categoryId ? { category_id: categoryId } : {}),
    ...(search
      ? {
          OR: [
            { material_code: { contains: search } },
            { material_name: { contains: search } },
          ],
        }
      : {}),
  };
}

// orderBy มาจาก ?sort= (utils/sorting.js) ต่อท้ายด้วย id ให้ลำดับคงที่ ข้ามหน้าแล้วไม่มีแถวซ้ำ/หาย
export async function findManyActive(
  { page = 1, limit = 20, search, categoryId, orderBy } = {},
  client = prisma,
) {
  const where = buildListWhere({ deleted: false, search, categoryId });
  const [items, total] = await Promise.all([
    client.materials.findMany({
      where,
      include: materialInclude,
      orderBy: orderBy ? [orderBy, { material_id: 'desc' }] : { material_id: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    client.materials.count({ where }),
  ]);

  return { items, total };
}

export async function findManyDeleted(
  { page = 1, limit = 20, search, categoryId, orderBy } = {},
  client = prisma,
) {
  const where = buildListWhere({ deleted: true, search, categoryId });
  const [items, total] = await Promise.all([
    client.materials.findMany({
      where,
      include: materialInclude,
      orderBy: orderBy ? [orderBy, { material_id: 'desc' }] : { material_id: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    client.materials.count({ where }),
  ]);

  return { items, total };
}

export async function findById(
  materialId,
  { includeDeleted = false, client = prisma } = {},
) {
  return client.materials.findFirst({
    where: {
      material_id: materialId,
      ...(includeDeleted ? {} : { deleted_at: null }),
    },
    include: materialInclude,
  });
}

export async function create(data, client = prisma) {
  return client.materials.create({ data, include: materialInclude });
}

export async function update(materialId, data, client = prisma) {
  return client.materials.update({
    where: { material_id: materialId },
    data,
    include: materialInclude,
  });
}

export async function softDelete(materialId, client = prisma) {
  return client.materials.update({
    where: { material_id: materialId },
    data: { deleted_at: new Date() },
  });
}

export async function restore(materialId, client = prisma) {
  return client.materials.update({
    where: { material_id: materialId },
    data: { deleted_at: null },
  });
}

export async function decrementQuantity(materialId, amount, client = prisma) {
  return client.materials.update({
    where: { material_id: materialId },
    data: { quantity: { decrement: amount } },
  });
}

export async function incrementQuantity(materialId, amount, client = prisma) {
  return client.materials.update({
    where: { material_id: materialId },
    data: { quantity: { increment: amount } },
  });
}

export async function createWithdrawal(data, client = prisma) {
  return client.material_withdrawals.create({ data, include: withdrawalInclude });
}

// outstanding = เฉพาะใบที่ต้องคืนและยังคืนไม่ครบ (due_date มีค่า + returned_at ยังว่าง)
export async function findWithdrawals(
  { page = 1, limit = 20, materialId, userId, outstanding = false, orderBy } = {},
  client = prisma,
) {
  const where = {
    ...(materialId ? { material_id: materialId } : {}),
    ...(userId ? { user_id: userId } : {}),
    ...(outstanding ? { due_date: { not: null }, returned_at: null } : {}),
  };
  const [items, total] = await Promise.all([
    client.material_withdrawals.findMany({
      where,
      include: withdrawalInclude,
      orderBy: orderBy
        ? [orderBy, { withdrawal_id: 'desc' }]
        : { withdrawn_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    client.material_withdrawals.count({ where }),
  ]);

  return { items, total };
}

export async function findWithdrawalById(withdrawalId, client = prisma) {
  return client.material_withdrawals.findUnique({
    where: { withdrawal_id: withdrawalId },
    include: withdrawalInclude,
  });
}

export async function updateWithdrawal(withdrawalId, data, client = prisma) {
  return client.material_withdrawals.update({
    where: { withdrawal_id: withdrawalId },
    data,
    include: withdrawalInclude,
  });
}

export async function createReturn(data, client = prisma) {
  return client.material_returns.create({ data });
}
