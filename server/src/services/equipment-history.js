// Helper กลางสำหรับบันทึก Audit Log ทุกการเปลี่ยนแปลงของครุภัณฑ์
export async function recordEquipmentHistory(
  connection,
  {
    itemId,
    action,
    oldData = null,
    newData = null,
    changedBy = null,
  },
) {
  await connection.execute(
    `INSERT INTO equipment_history (
      item_id,
      action,
      old_data,
      new_data,
      changed_by
    )
    VALUES (?, ?, ?, ?, ?)`,
    [
      itemId,
      action,
      // MySQL JSON รับ string JSON แล้วแปลงกลับเป็น object ตอน SELECT
      oldData === null ? null : JSON.stringify(oldData),
      newData === null ? null : JSON.stringify(newData),
      changedBy,
    ],
  );
}
