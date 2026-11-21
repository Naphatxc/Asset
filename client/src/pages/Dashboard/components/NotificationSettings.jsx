// หน้า "แจ้งเตือนอีเมล" ของ Admin: เลือกได้ว่าระบบจะส่งอีเมลอะไร ถึงใคร ด้วยข้อความอย่างไร
// - ตารางแสดงทุกเหตุการณ์ที่ระบบส่งอีเมล (IDP รอตรวจ / ผลตรวจ IDP / ลืมรหัสผ่าน) สวิตช์เปิด-ปิดกดได้ในตารางเลย
// - ปุ่ม "ตั้งค่า" เปิด popup แก้ผู้รับและข้อความ (NotificationEditDialog.jsx)
// - ไม่เคยแก้อะไร = ส่งเหมือนเดิมทุกอย่าง (ค่าเริ่มต้นอยู่ที่ server: notification.catalog.js)
// อีเมลส่งผ่าน Brevo จากอีเมลผู้ส่งของระบบ ตั้งที่เซิร์ฟเวอร์ ไม่ได้ตั้งจากหน้านี้
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  getNotificationSettings,
  resetNotificationSetting,
  updateNotificationSetting,
} from '../../../api/notifications.js';
import { useToast } from '../../../components/ToastProvider.jsx';
import NotificationEditDialog from './NotificationEditDialog.jsx';
import './NotificationSettings.css';

// สรุปผู้รับเป็นข้อความสั้นๆ ในตาราง
function describeRecipients(event, admins) {
  const { recipient_mode: mode, admin_ids: adminIds, extra_emails: extraEmails } = event.setting;
  let text = event.requester_label;

  if (mode === 'all_admins') text = 'Admin ทุกคน';
  if (mode === 'selected_admins') {
    const names = admins
      .filter((admin) => adminIds.includes(admin.user_id))
      .map((admin) => admin.name);
    text = names.length > 0 ? `Admin: ${names.join(', ')}` : 'Admin ที่เลือก';
  }
  if (extraEmails.length > 0) text += ` + อีเมลพิเศษ ${extraEmails.length}`;

  return text;
}

export default function NotificationSettings() {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  // เหตุการณ์ที่เปิด popup อยู่ (เก็บแค่ key แล้วหาข้อมูลล่าสุดจาก query ทุกครั้ง)
  const [editingKey, setEditingKey] = useState(null);
  // เหตุการณ์ที่กด "คืนค่าเริ่มต้น" ครั้งแรกแล้ว รอกดยืนยันอีกครั้ง (เหมือนปุ่มลบผู้ใช้)
  const [confirmingResetKey, setConfirmingResetKey] = useState(null);

  const settingsQuery = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: getNotificationSettings,
  });
  const events = settingsQuery.data?.events ?? [];
  const admins = settingsQuery.data?.admins ?? [];
  const mail = settingsQuery.data?.mail;
  const editingEvent = events.find((event) => event.key === editingKey);

  // สวิตช์เปิด/ปิดในตาราง ส่งค่าอื่นของเหตุการณ์ไปเหมือนเดิม เปลี่ยนแค่ enabled
  const toggleMutation = useMutation({
    mutationFn: (event) => {
      const { setting } = event;

      return updateNotificationSetting(event.key, {
        enabled: !setting.enabled,
        recipientMode: setting.recipient_mode,
        adminIds: setting.admin_ids,
        extraEmails: setting.extra_emails,
        subject: setting.subject,
        body: setting.body,
      });
    },
    onSuccess: (data) =>
      showSuccess(data.event.setting.enabled ? 'เปิดการแจ้งเตือนแล้ว' : 'ปิดการแจ้งเตือนแล้ว'),
    onError: (error) => showError(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
  });

  const resetMutation = useMutation({
    mutationFn: (event) => resetNotificationSetting(event.key),
    onSuccess: (data) => showSuccess(data.message),
    onError: (error) => showError(error.message),
    onSettled: () => {
      setConfirmingResetKey(null);
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });

  return (
    <section className="equipment-section">
      <div className="section-heading equipment-toolbar">
        <div>
          <p className="section-kicker">Notifications</p>
          <h2>ตั้งค่าแจ้งเตือนอีเมล</h2>
        </div>
      </div>

      {mail && (
        <p className="user-note notification-mail-note">
          {mail.live
            ? `ส่งผ่าน Brevo จากอีเมลผู้ส่งของระบบ (${mail.from}) ผู้รับจะเห็นอีเมลในกล่องจดหมายตามปกติ เช่น Gmail`
            : 'โหมดพัฒนา: ยังไม่ได้เชื่อม Brevo อีเมลทั้งหมดจะถูกพิมพ์ลง console ของเซิร์ฟเวอร์แทนการส่งจริง'}
        </p>
      )}

      {settingsQuery.error && <p className="error-message">{settingsQuery.error.message}</p>}

      <div className="table-wrap notification-table-wrap">
        <table className="user-table responsive-table">
          <thead>
            <tr>
              <th>เหตุการณ์</th>
              <th>สถานะ</th>
              <th>ผู้รับ</th>
              <th>ข้อความ</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const { setting } = event;
              const busy = toggleMutation.isPending || resetMutation.isPending;
              const confirmingReset = confirmingResetKey === event.key;

              return (
                <tr key={event.key}>
                  <td data-label="เหตุการณ์">
                    <strong>{event.label}</strong>
                    <p className="notification-description">{event.description}</p>
                  </td>
                  <td data-label="สถานะ">
                    {event.can_disable ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={setting.enabled}
                        aria-label={`${setting.enabled ? 'ปิด' : 'เปิด'}การแจ้งเตือน ${event.label}`}
                        className={`notification-switch${setting.enabled ? ' is-on' : ''}`}
                        disabled={busy}
                        onClick={() => toggleMutation.mutate(event)}
                      >
                        <span className="notification-switch-knob" aria-hidden="true" />
                        <span>{setting.enabled ? 'เปิด' : 'ปิด'}</span>
                      </button>
                    ) : (
                      <span className="status-badge status-available">เปิดเสมอ</span>
                    )}
                  </td>
                  <td data-label="ผู้รับ">{describeRecipients(event, admins)}</td>
                  <td data-label="ข้อความ">
                    <span
                      className={`status-badge ${setting.customized ? 'status-borrowed' : 'status-repairing'}`}
                    >
                      {setting.customized ? 'แก้ไขแล้ว' : 'ค่าเริ่มต้น'}
                    </span>
                  </td>
                  <td className="stack-actions" data-label="จัดการ">
                    <div className="row-actions">
                      <button type="button" onClick={() => setEditingKey(event.key)} disabled={busy}>
                        ตั้งค่า
                      </button>
                      {setting.customized && (
                        <button
                          className="button-danger"
                          type="button"
                          onClick={() =>
                            confirmingReset
                              ? resetMutation.mutate(event)
                              : setConfirmingResetKey(event.key)
                          }
                          disabled={busy}
                        >
                          {confirmingReset ? 'ยืนยันคืนค่า' : 'คืนค่าเริ่มต้น'}
                        </button>
                      )}
                      {confirmingReset && !busy && (
                        <button type="button" onClick={() => setConfirmingResetKey(null)}>
                          ยกเลิก
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {settingsQuery.isPending && (
              <tr>
                <td colSpan={5}>กำลังโหลด...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingEvent && (
        <NotificationEditDialog
          event={editingEvent}
          admins={admins}
          onClose={() => setEditingKey(null)}
        />
      )}
    </section>
  );
}
