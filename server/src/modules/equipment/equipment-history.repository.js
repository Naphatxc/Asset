// Data Access Layer สำหรับ Audit Log ของครุภัณฑ์ (equipment_history)
import { prisma } from '../../config/prisma.js';

// แปลง Date/Decimal ให้เป็น JSON ปกติก่อนเก็บ snapshot
function toJson(value) {
  return value === null ? null : JSON.parse(JSON.stringify(value));
}

export async function create(
  { itemId, action, oldData = null, newData = null, changedBy = null },
  client = prisma,
) {
  return client.equipment_history.create({
    data: {
      item_id: itemId,
      action,
      changed_by: changedBy,
      ...(oldData === null ? {} : { old_data: toJson(oldData) }),
      ...(newData === null ? {} : { new_data: toJson(newData) }),
    },
  });
}

export async function findByItemId(itemId, client = prisma) {
  return client.equipment_history.findMany({
    where: { item_id: itemId },
    include: { users: true },
    orderBy: { history_id: 'desc' },
  });
}
