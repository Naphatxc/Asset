// รวมคำสั่งติดต่อ Document API — เอกสาร IDP / OBE 3 / OBE 5 ที่ผู้ใช้ส่งให้ Admin
// ส่ง/ดูของตัวเองผ่าน /api/documents (ทุกคนที่ login) ส่วนดูของทุกคนและตรวจ IDP อยู่ใต้ /api/admin/documents (Admin)
import { request, toApiUrl } from './http.js';

// ประวัติการส่งของตัวเอง ใหม่สุดก่อน type = 'idp' | 'obe3' | 'obe5'
export function getMyDocuments(type) {
  return request(`/api/documents/mine?type=${encodeURIComponent(type)}`);
}

// file มาจาก <input type="file"> ส่งเป็น multipart/form-data (ไฟล์เดียว) ผู้ส่งคือคนที่ login อยู่ server ไม่รับจาก body
export function submitDocument({ type, academicYear, note, file }) {
  const formData = new FormData();
  formData.append('doc_type', type);
  formData.append('academic_year', academicYear);
  formData.append('note', note);
  formData.append('file', file);

  return request('/api/documents', { method: 'POST', body: formData });
}

// เอกสารของทุกคนทุกประเภท (Admin) กรองประเภท/สถานะ/ปีฝั่ง client
export function getAllDocuments() {
  return request('/api/admin/documents');
}

// ตรวจ IDP: decision = 'approved' (ผ่าน) | 'returned' (ส่งกลับให้แก้ไข) file = ไฟล์ที่แนบกลับ (ไม่บังคับ)
export function reviewDocument(submissionId, { decision, note, file }) {
  const formData = new FormData();
  formData.append('decision', decision);
  formData.append('review_note', note);
  if (file) formData.append('file', file);

  return request(`/api/admin/documents/${submissionId}/review`, {
    method: 'PATCH',
    body: formData,
  });
}

// ลิงก์ดาวน์โหลดตรงไปที่ server (ไม่ผ่าน axios) cookie แนบไปเองเหมือนไฟล์แนบแจ้งซ่อม (ดู api/repair.js)
// path = file_url หรือ review_file_url ที่ server ส่งมากับรายการ (server เช็คสิทธิ์ตอนเปิดลิงก์อีกชั้น)
export function getDocumentDownloadUrl(path) {
  return toApiUrl(path);
}

// ชื่อที่แสดงของทั้ง 3 ประเภท: { types: [{ doc_type, label, title, reviewed }] }
export function getDocumentTypes() {
  return request('/api/documents/types');
}

// Admin เปลี่ยนชื่อที่แสดง label = ชื่อสั้นบนแท็บ/ปุ่ม, title = ชื่อเต็มบนหัวหน้า/อีเมล
export function updateDocumentType(docType, { label, title }) {
  return request(`/api/admin/documents/types/${docType}`, {
    method: 'PATCH',
    body: { label, title },
  });
}
