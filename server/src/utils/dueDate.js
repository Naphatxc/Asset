// วันครบกำหนดคืน (borrow_details.return_date / material_withdrawals.due_date) ใช้เกณฑ์เดียวกันทั้งระบบ
// ค่าเก็บเป็น 00:00:00 UTC ของ "วันที่ครบกำหนด" (ดู utils/parsing.js: toDate ตัด T00:00:00.000Z ต่อท้าย)
// แต่ผู้ใช้ทุกคนอยู่ที่ไทย (UTC+7) วันครบกำหนดจริงๆ จึงสิ้นสุดตอนเที่ยงคืนเวลาไทย = 17:00 UTC ของวันเดียวกัน
// ถ้าเทียบกับ UTC midnight ตรงๆ จะกลายเป็นเกินกำหนดตั้งแต่ 07:00 เวลาไทยของวันครบกำหนดเอง (เร็วไป 17 ชม.)
// query ดิบใน dashboard.repository.js ใช้ INTERVAL 17 HOUR ตามเกณฑ์นี้
const THAILAND_UTC_OFFSET_HOURS = 7;

export function isPastDueDate(dueDate) {
  const endOfDueDateUtc = new Date(
    dueDate.getTime() + (24 - THAILAND_UTC_OFFSET_HOURS) * 60 * 60 * 1000,
  );

  return new Date() > endOfDueDateUtc;
}

// วันนี้ตามเวลาไทย (YYYY-MM-DD) server รันเป็น UTC ถ้าใช้ new Date() ตรงๆ ช่วงตี 0-7 จะได้วันของเมื่อวาน
export function todayInBangkok() {
  return new Date(Date.now() + THAILAND_UTC_OFFSET_HOURS * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

// วันครบกำหนดต้องเป็นพรุ่งนี้เป็นต้นไป (ตรงกับ min={tomorrowDateInput()} ฝั่ง client) กันสร้างรายการที่เลยกำหนดตั้งแต่เกิด
export function isFutureDueDate(dueDate) {
  return dueDate.toISOString().slice(0, 10) > todayInBangkok();
}
