// Helper กลางสำหรับบันทึก Audit Log ทุกการเปลี่ยนแปลงของครุภัณฑ์
export async function recordEquipmentHistory(
  database,
  {
    itemId,
    action,
    oldData = null,
    newData = null,
    changedBy = null,
  },
) {
  // แปลง Date/Decimal ให้เป็น JSON ปกติก่อนเก็บ snapshot
  const toJson = (value) =>
    value === null ? null : JSON.parse(JSON.stringify(value));

  await database.equipment_history.create({
    data: {
      item_id: itemId,
      action,
      changed_by: changedBy,
      ...(oldData === null ? {} : { old_data: toJson(oldData) }),
      ...(newData === null ? {} : { new_data: toJson(newData) }),
    },
  });
}
