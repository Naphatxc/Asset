// ค่าคงที่และตัวช่วยที่หน้าส่งเอกสารของผู้ใช้ (DocumentSubmissions.jsx) หน้าเอกสารของ Admin (DocumentManager.jsx)
// และ popup ตรวจ IDP (DocumentReviewDialog.jsx) ใช้ร่วมกัน

// ประเภทเอกสาร key ต้องตรงกับ DOC_TYPES ใน server (document.validator.js)
// reviewed: true = ส่งไป-กลับ มี Admin ตรวจ (IDP) / false = ส่งอย่างเดียว Admin แค่โหลดไฟล์ไปใช้ (OBE 3, OBE 5)
export const DOCUMENT_TYPES = {
  idp: { label: 'IDP', title: 'แผนพัฒนาบุคลากรรายบุคคล (IDP)', reviewed: true },
  obe3: { label: 'OBE 3', title: 'OBE 3', reviewed: false },
  obe5: { label: 'OBE 5', title: 'OBE 5', reviewed: false },
};

// สถานะของ IDP (OBE 3 / OBE 5 ไม่มีสถานะ) สีของป้ายอยู่ที่ class .status-doc-<สถานะ> ใน styles.css
export const STATUS_LABELS = {
  pending: 'รอตรวจ',
  approved: 'ผ่าน',
  returned: 'ส่งกลับให้แก้ไข',
};

// ต้องตรงกับ server: รับเฉพาะ PDF/Word ไม่เกิน 10 MB (upload.middleware.js) หมายเหตุไม่เกิน 1000 ตัวอักษร (document.validator.js)
export const DOCUMENT_ACCEPT =
  '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_NOTE_LENGTH = 1000;
export const MIN_ACADEMIC_YEAR = 2560;

// ปีการศึกษาปัจจุบัน (พ.ศ.) ใช้เป็นค่าเริ่มต้นในฟอร์ม ผู้ส่งแก้เองได้
// ปีการศึกษาเริ่มราวเดือนมิถุนายน: ม.ค.–พ.ค. จึงยังนับเป็นปีการศึกษาของปีก่อนหน้า
export function currentAcademicYear() {
  const now = new Date();
  const buddhistYear = now.getFullYear() + 543;

  return now.getMonth() >= 5 ? buddhistYear : buddhistYear - 1;
}

// ปีการศึกษาสูงสุดที่ server รับ = ปี พ.ศ. ปัจจุบัน + 1 (ต้องตรงกับ maxAcademicYear ใน document.validator.js)
export function maxAcademicYear() {
  return new Date().getFullYear() + 543 + 1;
}

// เวลาจาก server เป็น UTC -> "14 พ.ย. 2569 15:36" ตามเวลาไทย
export function formatDateTime(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

// เวลาจาก server (UTC) -> วันที่ตามเวลาไทยในรูป ค.ศ. "2026-11-14"
// ให้เทียบกับค่าของ <input type="date"> ได้ตรงๆ (เทียบเป็นข้อความได้เพราะเรียงตามลำดับเดียวกับวันที่)
export function bangkokDateKey(value) {
  if (!value) return '';

  // en-CA ให้รูปแบบ YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date(value));
}

// ข้อความ error ถ้าไฟล์นี้ส่งไม่ได้ (null = ส่งได้) เช็คก่อนอัปโหลดจะได้ไม่ต้องรอ server ตอบกลับมาว่าไม่ผ่าน
export function fileProblem(file) {
  if (!file) return 'กรุณาแนบไฟล์เอกสาร';
  if (!/\.(pdf|doc|docx)$/i.test(file.name)) return 'รองรับเฉพาะไฟล์ PDF หรือ Word (.doc, .docx)';
  if (file.size > MAX_FILE_SIZE) return 'ไฟล์มีขนาดใหญ่เกิน 10MB';

  return null;
}
