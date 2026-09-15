// Helper แปลงค่า input ดิบจาก request ให้เป็นรูปแบบที่ใช้ต่อได้ (ใช้ร่วมกันหลาย validator/service)
export function hasOwn(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

export function toDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;

  return new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
}
