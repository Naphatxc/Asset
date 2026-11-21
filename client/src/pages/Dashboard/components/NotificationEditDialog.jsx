// Popup ตั้งค่าอีเมลแจ้งเตือนของเหตุการณ์เดียว: เปิด/ปิด ผู้รับ และแม่แบบหัวเรื่อง/เนื้อความ
// - เนื้อความใส่ {{ตัวแปร}} ได้ กดชิปใต้ช่องเพื่อแทรกตรงตำแหน่งเคอร์เซอร์ ระบบแทนค่าจริงตอนส่ง
// - ตัวอย่างอีเมลด้านล่างสร้างจาก server ด้วยโค้ดเดียวกับที่ส่งจริง (ข้อมูลตัวอย่าง) อัปเดตเองหลังหยุดพิมพ์ครู่หนึ่ง
// - "ส่งอีเมลทดสอบ" ส่งถึงอีเมลของ Admin ที่กดเอง ยังไม่ต้องบันทึกก่อน
// ยังไม่กดบันทึก = ยังไม่เปลี่ยนอะไรในระบบ
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import {
  previewNotification,
  sendTestNotification,
  updateNotificationSetting,
} from '../../../api/notifications.js';
import { useToast } from '../../../components/ToastProvider.jsx';
import { useModal } from '../../../hooks/useModal.js';

// ต้องตรงกับ server (notification.template.js)
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 5000;
const PREVIEW_DELAY_MS = 400;

const RECIPIENT_MODE_LABELS = {
  requester: (event) => `${event.requester_label} (เจ้าของเหตุการณ์)`,
  all_admins: () => 'Admin ทุกคน',
  selected_admins: () => 'Admin ที่เลือก',
};

export default function NotificationEditDialog({ event, admins, onClose }) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  const { setting, defaults } = event;

  const [enabled, setEnabled] = useState(setting.enabled);
  const [recipientMode, setRecipientMode] = useState(setting.recipient_mode);
  const [adminIds, setAdminIds] = useState(setting.admin_ids);
  const [extraEmails, setExtraEmails] = useState(setting.extra_emails.join(', '));
  const [subject, setSubject] = useState(setting.subject);
  const [body, setBody] = useState(setting.body);
  const [previewError, setPreviewError] = useState('');

  const subjectRef = useRef(null);
  const bodyRef = useRef(null);
  // ช่องที่โฟกัสล่าสุด ชิปตัวแปรจะแทรกลงช่องนั้น (ตัวแปรแบบบล็อกแทรกได้เฉพาะเนื้อความ)
  const lastFieldRef = useRef('body');

  const saveMutation = useMutation({
    mutationFn: () =>
      updateNotificationSetting(event.key, {
        enabled,
        recipientMode,
        adminIds,
        extraEmails,
        subject,
        body,
      }),
    onSuccess: (data) => {
      showSuccess(data.message);
      onClose();
    },
    onError: (error) => showError(error.message),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
  });

  const testMutation = useMutation({
    mutationFn: () => sendTestNotification(event.key, { subject, body }),
    onSuccess: (data) => showSuccess(data.message),
    onError: (error) => showError(error.message),
  });

  const previewMutation = useMutation({
    mutationFn: () => previewNotification(event.key, { subject, body }),
    onSuccess: () => setPreviewError(''),
    onError: (error) => setPreviewError(error.message),
  });
  const preview = previewMutation.data?.preview;

  // ขอตัวอย่างใหม่หลังหยุดพิมพ์ครู่หนึ่ง ไม่ยิงทุกตัวอักษร
  useEffect(() => {
    const timer = setTimeout(() => previewMutation.mutate(), PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [subject, body]);

  const busy = saveMutation.isPending;
  const dialogRef = useModal(() => {
    if (!busy) onClose();
  });

  function toggleAdmin(userId) {
    setAdminIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  // แทรก {{ตัวแปร}} ตรงเคอร์เซอร์ของช่องที่โฟกัสล่าสุด แล้วคืนเคอร์เซอร์ไปหลังตัวแปร
  function insertVariable(variable) {
    const useSubject = lastFieldRef.current === 'subject' && !variable.block;
    const input = useSubject ? subjectRef.current : bodyRef.current;
    const setValue = useSubject ? setSubject : setBody;
    const token = `{{${variable.key}}}`;
    // ตัวแปรแบบบล็อก (ปุ่ม/รายละเอียด) ต้องอยู่ย่อหน้าของตัวเอง จึงเว้นบรรทัดว่างรอบๆ
    const wrapped = variable.block ? `\n\n${token}\n\n` : token;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const next = input.value.slice(0, start) + wrapped + input.value.slice(end);

    setValue(next);
    requestAnimationFrame(() => {
      input.focus();
      const caret = start + wrapped.length;
      input.setSelectionRange(caret, caret);
    });
  }

  function resetTemplate() {
    setSubject(defaults.subject);
    setBody(defaults.body);
  }

  function submit(submitEvent) {
    submitEvent.preventDefault();
    saveMutation.mutate();
  }

  const templateIsDefault = subject === defaults.subject && body === defaults.body;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={busy ? undefined : onClose}>
      <section
        className="repair-dialog notification-dialog"
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
        tabIndex={-1}
        aria-labelledby="notification-dialog-title"
        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <p className="section-kicker">Notifications</p>
            <h2 id="notification-dialog-title">{event.label}</h2>
            <p className="notification-description">{event.description}</p>
          </div>
        </div>

        <form onSubmit={submit}>
          {/* ===== เปิด/ปิด ===== */}
          {event.can_disable ? (
            <label className="notification-check">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(changeEvent) => setEnabled(changeEvent.target.checked)}
              />
              ส่งอีเมลแจ้งเตือนนี้
            </label>
          ) : (
            <p className="notification-locked">
              อีเมลนี้ปิดไม่ได้และส่งถึงเจ้าของบัญชีเท่านั้น เพราะเป็นส่วนหนึ่งของการเข้าสู่ระบบ
              (แก้ข้อความได้ แต่ต้องมี {'{{link}}'} เสมอ)
            </p>
          )}

          {/* ===== ผู้รับ ===== */}
          <fieldset className="notification-fieldset" disabled={!enabled}>
            <legend>ผู้รับ</legend>
            {event.recipient_modes.length > 1 &&
              event.recipient_modes.map((mode) => (
                <label key={mode} className="notification-check">
                  <input
                    type="radio"
                    name="recipient-mode"
                    value={mode}
                    checked={recipientMode === mode}
                    onChange={() => setRecipientMode(mode)}
                  />
                  {RECIPIENT_MODE_LABELS[mode](event)}
                </label>
              ))}

            {recipientMode === 'selected_admins' && (
              <div className="notification-admins" role="group" aria-label="เลือก Admin ที่จะรับอีเมล">
                {admins.map((admin) => (
                  <label key={admin.user_id} className="notification-check">
                    <input
                      type="checkbox"
                      checked={adminIds.includes(admin.user_id)}
                      onChange={() => toggleAdmin(admin.user_id)}
                    />
                    {admin.name} <span className="notification-muted">({admin.email})</span>
                  </label>
                ))}
              </div>
            )}

            {event.allow_extra_emails && (
              <label className="notification-field">
                อีเมลผู้รับเพิ่มเติม (ไม่บังคับ)
                <input
                  value={extraEmails}
                  onChange={(changeEvent) => setExtraEmails(changeEvent.target.value)}
                  placeholder="เช่น department@gmail.com, office@example.com"
                />
                <span className="notification-muted">
                  คั่นด้วยจุลภาค ได้ไม่เกิน 10 อีเมล ส่งแยกทีละคนเหมือนผู้รับปกติ
                </span>
              </label>
            )}
          </fieldset>

          {/* ===== ข้อความ ===== */}
          <fieldset className="notification-fieldset">
            <legend>ข้อความอีเมล</legend>
            <label className="notification-field">
              หัวเรื่อง
              <input
                ref={subjectRef}
                value={subject}
                onChange={(changeEvent) => setSubject(changeEvent.target.value)}
                onFocus={() => (lastFieldRef.current = 'subject')}
                maxLength={MAX_SUBJECT_LENGTH}
                required
              />
            </label>
            <label className="notification-field">
              เนื้อความ (เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่)
              <textarea
                ref={bodyRef}
                rows={9}
                value={body}
                onChange={(changeEvent) => setBody(changeEvent.target.value)}
                onFocus={() => (lastFieldRef.current = 'body')}
                maxLength={MAX_BODY_LENGTH}
                required
              />
            </label>

            <div className="notification-variables">
              <span className="notification-muted">กดเพื่อแทรกตัวแปรตรงเคอร์เซอร์:</span>
              {event.variables.map((variable) => (
                <button
                  key={variable.key}
                  type="button"
                  className="notification-chip"
                  title={variable.label}
                  onClick={() => insertVariable(variable)}
                >
                  {`{{${variable.key}}}`}
                  <span>{variable.label}</span>
                </button>
              ))}
            </div>

            <div className="form-actions">
              <button
                className="button-secondary"
                type="button"
                onClick={resetTemplate}
                disabled={templateIsDefault}
              >
                คืนข้อความเริ่มต้น
              </button>
            </div>
          </fieldset>

          {/* ===== ตัวอย่าง ===== */}
          <fieldset className="notification-fieldset">
            <legend>ตัวอย่างอีเมล (ข้อมูลสมมติ)</legend>
            {previewError ? (
              <p className="error-message">{previewError}</p>
            ) : preview ? (
              <div className="notification-preview">
                <p className="notification-preview-subject">
                  <span className="notification-muted">หัวเรื่อง:</span> {preview.subject}
                </p>
                {/* sandbox ว่าง = ไม่รันสคริปต์/ลิงก์ในตัวอย่าง ใช้ดูหน้าตาอย่างเดียว */}
                <iframe
                  title="ตัวอย่างอีเมล"
                  sandbox=""
                  srcDoc={`<body style="font-family:sans-serif;font-size:14px;color:#333;margin:12px">${preview.html}</body>`}
                />
              </div>
            ) : (
              <p className="notification-muted">กำลังสร้างตัวอย่าง...</p>
            )}
          </fieldset>

          <div className="form-actions">
            <button className="button-primary" type="submit" disabled={busy}>
              {busy ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={() => testMutation.mutate()}
              disabled={busy || testMutation.isPending || Boolean(previewError)}
            >
              {testMutation.isPending ? 'กำลังส่ง...' : 'ส่งอีเมลทดสอบถึงฉัน'}
            </button>
            <button className="button-secondary" type="button" onClick={onClose} disabled={busy}>
              ยกเลิก
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
