// Helper แปลงค่า input ดิบจาก request ให้เป็นรูปแบบที่ใช้ต่อได้ (ใช้ร่วมกันหลาย validator/service)
export function hasOwn(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

// คืน null เสมอถ้า parse ไม่ได้ (ไม่ใช่ Invalid Date object ซึ่งเป็น truthy) ผู้เรียกทุกที่ที่เช็ค
// `if (!value)` จะได้ดักค่าที่ parse ไม่ขึ้นได้จริง แทนที่จะปล่อยผ่านไปพังตอน query DB
export function toDate(value) {
  if (value == null || value === '') return null;

  const date =
    value instanceof Date
      ? value
      : new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}
