// รวมคำสั่งติดต่อ API ตั้งค่าอีเมลแจ้งเตือน (Admin เท่านั้น) ดู server/src/modules/notifications
import { request } from './http.js';

// เหตุการณ์ทั้งหมดพร้อมค่าที่ตั้งไว้ + รายชื่อ Admin + สถานะการเชื่อมต่อ Brevo
export function getNotificationSettings() {
  return request('/api/admin/notifications');
}

// บันทึกทั้งชุดของเหตุการณ์หนึ่ง (แทนที่ของเดิมทั้งหมด จึงต้องส่งครบทุกช่อง)
// values = { enabled, recipientMode, adminIds, extraEmails, subject, body }
export function updateNotificationSetting(eventKey, values) {
  return request(`/api/admin/notifications/${eventKey}`, {
    method: 'PUT',
    body: {
      enabled: values.enabled,
      recipient_mode: values.recipientMode,
      admin_ids: values.adminIds,
      extra_emails: values.extraEmails,
      subject: values.subject,
      body: values.body,
    },
  });
}

// คืนค่าเริ่มต้นของเหตุการณ์หนึ่ง
export function resetNotificationSetting(eventKey) {
  return request(`/api/admin/notifications/${eventKey}`, { method: 'DELETE' });
}

// ตัวอย่างอีเมลจากข้อความในฟอร์ม (ยังไม่บันทึก) -> { preview: { subject, text, html } }
export function previewNotification(eventKey, { subject, body }) {
  return request(`/api/admin/notifications/${eventKey}/preview`, {
    method: 'POST',
    body: { subject, body },
  });
}

// ส่งตัวอย่างถึงอีเมลของ Admin ที่กดเอง (server ไม่รับอีเมลปลายทางจาก request)
export function sendTestNotification(eventKey, { subject, body }) {
  return request(`/api/admin/notifications/${eventKey}/test`, {
    method: 'POST',
    body: { subject, body },
  });
}
