// ตั้งค่าและส่งอีเมลแจ้งเตือน
// - ฝั่งหน้าตั้งค่า (Admin): อ่าน / บันทึก / คืนค่าเริ่มต้น / ดูตัวอย่าง / ส่งอีเมลทดสอบ
// - ฝั่งระบบ: sendNotification() ที่ mailer เดิม (document.mail.js, password-reset.service.js) เรียกแทน sendMail ตรงๆ
//   ถ้า Admin ไม่เคยตั้งค่า ใช้ค่าเริ่มต้นใน notification.catalog.js ทุกอย่างจึงส่งเหมือนเดิม
import { appUrl, mailFromEmail } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { isMailConfigured, isMailLive, sendMail } from '../../utils/mailer.js';
import * as userRepository from '../users/user.repository.js';
import { RECIPIENT_MODES, NOTIFICATION_EVENTS, getEvent, sampleValues } from './notification.catalog.js';
import * as notificationRepository from './notification.repository.js';
import { renderEmail, validateTemplate } from './notification.template.js';

const MAX_EXTRA_EMAILS = 10;
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function normalizeNewlines(text) {
  return String(text).replace(/\r\n/g, '\n').trim();
}

function parseExtraEmails(text) {
  return String(text ?? '')
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// ค่าที่ใช้งานจริงของเหตุการณ์หนึ่ง = ค่าที่ Admin ตั้งไว้ (ถ้ามี) ทับค่าเริ่มต้นในโค้ด
// ข้อจำกัดของเหตุการณ์ (ปิดไม่ได้ / ผู้รับตายตัว) บังคับที่นี่ด้วย ต่อให้ DB ถูกแก้ตรงๆ ก็ไม่ทำให้ลิงก์รีเซ็ตรหัสผ่านไปผิดคน
function resolveSetting(event, row) {
  return {
    enabled: event.canDisable ? (row?.enabled ?? true) : true,
    recipient_mode:
      event.lockedRecipientMode ?? row?.recipient_mode ?? event.defaultRecipientMode,
    admin_ids: row?.admins.map((admin) => admin.user_id) ?? [],
    extra_emails: event.allowExtraEmails ? parseExtraEmails(row?.extra_emails) : [],
    subject: row?.subject_template ?? event.defaultSubject,
    body: row?.body_template ?? event.defaultBody,
    customized: Boolean(row),
  };
}

function serializeEvent(key, event, row) {
  return {
    key,
    label: event.label,
    description: event.description,
    requester_label: event.requesterLabel,
    can_disable: event.canDisable,
    allow_extra_emails: event.allowExtraEmails,
    recipient_modes: event.lockedRecipientMode ? [event.lockedRecipientMode] : RECIPIENT_MODES,
    required_variables: event.requiredVariables ?? [],
    variables: event.variables.map(({ key: name, label, block }) => ({
      key: name,
      label,
      block: Boolean(block),
    })),
    defaults: {
      recipient_mode: event.defaultRecipientMode,
      subject: event.defaultSubject,
      body: event.defaultBody,
    },
    setting: resolveSetting(event, row),
  };
}

export async function getSettings() {
  try {
    const [rows, admins] = await Promise.all([
      notificationRepository.findAll(),
      userRepository.findAdmins(),
    ]);
    const rowByKey = new Map(rows.map((row) => [row.event_key, row]));

    return {
      events: Object.entries(NOTIFICATION_EVENTS).map(([key, event]) =>
        serializeEvent(key, event, rowByKey.get(key)),
      ),
      admins,
      // live = ส่งออกจริงผ่าน Brevo, ไม่ live = โหมด dev พิมพ์ลง console เฉยๆ
      mail: { live: isMailLive(), from: isMailLive() ? mailFromEmail : null },
    };
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดการตั้งค่าแจ้งเตือนได้', { cause: error });
  }
}

function requireEvent(eventKey) {
  const event = getEvent(eventKey);
  if (!event) throw new AppError(404, 'ไม่พบเหตุการณ์แจ้งเตือนนี้');

  return event;
}

function requireValidTemplate(event, template) {
  const problem = validateTemplate(event, template);
  if (problem) throw new AppError(400, problem);
}

// บันทึกทั้งชุด (PUT) ถ้าค่าที่ส่งมาเท่ากับค่าเริ่มต้นทั้งหมด ลบแถวทิ้งแทน การ์ดจะกลับเป็น "ค่าเริ่มต้น" เอง
export async function updateSetting(eventKey, input, updatedBy) {
  const event = requireEvent(eventKey);
  const subject = normalizeNewlines(input.subject);
  const body = normalizeNewlines(input.body);
  const extraEmails = event.allowExtraEmails ? [...new Set(input.extraEmails)] : [];

  if (!event.canDisable && !input.enabled) {
    throw new AppError(400, 'อีเมลนี้ปิดไม่ได้ เพราะเป็นส่วนหนึ่งของการเข้าสู่ระบบ');
  }
  if (event.lockedRecipientMode && input.recipientMode !== event.lockedRecipientMode) {
    throw new AppError(400, 'อีเมลนี้ส่งถึงเจ้าของบัญชีเท่านั้น เปลี่ยนผู้รับไม่ได้');
  }
  if (!event.allowExtraEmails && input.extraEmails.length > 0) {
    throw new AppError(400, 'อีเมลนี้เพิ่มผู้รับพิเศษไม่ได้');
  }
  if (extraEmails.length > MAX_EXTRA_EMAILS) {
    throw new AppError(400, `เพิ่มอีเมลผู้รับพิเศษได้ไม่เกิน ${MAX_EXTRA_EMAILS} อีเมล`);
  }
  for (const email of extraEmails) {
    if (!EMAIL_PATTERN.test(email) || email.length > 255) {
      throw new AppError(400, `อีเมลผู้รับพิเศษไม่ถูกต้อง: ${email}`);
    }
  }
  requireValidTemplate(event, { subject, body });

  try {
    // Admin ที่เลือกต้องยังเป็น Admin อยู่จริง (กันส่ง id มั่ว / คนที่เพิ่งถูกลดสิทธิ์)
    const admins = await userRepository.findAdmins();
    const validIds = new Set(admins.map((admin) => admin.user_id));
    const adminIds =
      input.recipientMode === 'selected_admins' ? [...new Set(input.adminIds)] : [];

    if (adminIds.some((id) => !validIds.has(id))) {
      throw new AppError(400, 'มีผู้รับที่ไม่ได้เป็น Admin');
    }
    if (input.recipientMode === 'selected_admins' && adminIds.length === 0) {
      throw new AppError(400, 'กรุณาเลือก Admin ที่จะรับอีเมลอย่างน้อย 1 คน');
    }

    const isDefault =
      input.enabled &&
      input.recipientMode === event.defaultRecipientMode &&
      extraEmails.length === 0 &&
      subject === event.defaultSubject &&
      body === event.defaultBody;

    if (isDefault) {
      await notificationRepository.remove(eventKey);
    } else {
      await notificationRepository.save(eventKey, {
        enabled: input.enabled,
        recipientMode: input.recipientMode,
        extraEmails: extraEmails.length > 0 ? extraEmails.join(', ') : null,
        // เก็บ NULL เมื่อตรงกับค่าเริ่มต้น แก้ข้อความเริ่มต้นในโค้ดทีหลังก็ยังตามไปให้
        subject: subject === event.defaultSubject ? null : subject,
        body: body === event.defaultBody ? null : body,
        adminIds,
        updatedBy,
      });
    }

    return serializeEvent(eventKey, event, await notificationRepository.findByKey(eventKey));
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถบันทึกการตั้งค่าแจ้งเตือนได้', { cause: error });
  }
}

export async function resetSetting(eventKey) {
  const event = requireEvent(eventKey);

  try {
    await notificationRepository.remove(eventKey);
    return serializeEvent(eventKey, event, null);
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถคืนค่าเริ่มต้นได้', { cause: error });
  }
}

// ===== ตัวอย่าง / ส่งทดสอบ =====
// ใช้แม่แบบที่ส่งมาจากฟอร์ม (ยังไม่ต้องบันทึก) กับข้อมูลตัวอย่างของเหตุการณ์
export function previewTemplate(eventKey, template) {
  const event = requireEvent(eventKey);
  const subject = normalizeNewlines(template.subject);
  const body = normalizeNewlines(template.body);
  requireValidTemplate(event, { subject, body });

  return renderEmail(
    event,
    { subject, body },
    { values: sampleValues(event), rows: event.sampleRows, link: `${appUrl}/` },
  );
}

export async function sendTestEmail(eventKey, template, admin) {
  const message = previewTemplate(eventKey, template);

  // production ที่ยังไม่ตั้งค่า Brevo: บอกตรงๆ ไม่แกล้งตอบว่าส่งแล้ว
  if (!isMailConfigured()) {
    throw new AppError(503, 'ระบบส่งอีเมลยังไม่พร้อมใช้งาน (ยังไม่ได้ตั้งค่า Brevo ที่เซิร์ฟเวอร์)');
  }

  try {
    await sendMail({ to: admin.email, ...message, subject: `[ทดสอบ] ${message.subject}` });
  } catch (error) {
    throw new AppError(502, 'ส่งอีเมลทดสอบไม่สำเร็จ ตรวจสอบการตั้งค่า Brevo ที่เซิร์ฟเวอร์', {
      cause: error,
    });
  }

  return { to: admin.email, live: isMailLive() };
}

// ===== ส่งจริง =====
// ผู้รับตามโหมดที่ตั้งไว้ + อีเมลพิเศษ ตัดอีเมลซ้ำ (เช่น Admin ที่ส่งเอกสารเองและเป็นผู้รับด้วย) ให้ได้ฉบับเดียว
async function resolveRecipients(setting, requester) {
  const recipients = [];

  if (setting.recipient_mode === 'requester') {
    if (requester?.email) recipients.push(requester);
  } else {
    const admins = await userRepository.findAdmins();
    const selected = new Set(setting.admin_ids);
    recipients.push(
      ...admins.filter(
        (admin) => setting.recipient_mode === 'all_admins' || selected.has(admin.user_id),
      ),
    );
  }
  recipients.push(...setting.extra_emails.map((email) => ({ name: '', email })));

  const seen = new Set();
  return recipients.filter((recipient) => {
    const key = recipient.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// requester = { name, email } คนที่เกี่ยวข้องกับเหตุการณ์ (ผู้ส่งเอกสาร / เจ้าของเอกสาร / เจ้าของบัญชี)
// values / rows / link = ข้อมูลของเหตุการณ์ตามตัวแปรใน catalog ({{name}} ใส่เองต่อผู้รับแต่ละคน)
// ส่งแยกทีละคน ใครส่งไม่ผ่านไม่กระทบคนอื่น และไม่ throw ออกไป: เอกสาร/การขอรหัสที่บันทึกไปแล้วต้องไม่ล้มเพราะอีเมล
export async function sendNotification(eventKey, { requester, values, rows = [], link }) {
  const event = requireEvent(eventKey);

  // อ่านการตั้งค่าไม่ได้ (DB สะดุด) ก็ส่งตามค่าเริ่มต้น อีเมลจะได้ยังออก
  const row = await notificationRepository.findByKey(eventKey).catch((error) => {
    console.error(`Failed to load notification setting ${eventKey}`, error);
    return null;
  });
  const setting = resolveSetting(event, row);
  if (!setting.enabled) return;

  const recipients = await resolveRecipients(setting, requester);
  const results = await Promise.allSettled(
    recipients.map((recipient) => {
      const message = renderEmail(
        event,
        { subject: setting.subject, body: setting.body },
        { values: { ...values, name: recipient.name || recipient.email }, rows, link },
      );
      return sendMail({ to: recipient.email, ...message });
    }),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(`Failed to send notification email (${eventKey})`, result.reason);
    }
  }
}
