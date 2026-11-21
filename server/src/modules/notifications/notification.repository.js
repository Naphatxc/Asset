// Data Access Layer ของตาราง notification_settings (+ notification_setting_admins = Admin ที่ถูกเลือกเป็นผู้รับ)
import { prisma } from '../../config/prisma.js';

const withAdmins = { admins: { select: { user_id: true } } };

export async function findAll(client = prisma) {
  return client.notification_settings.findMany({ include: withAdmins });
}

export async function findByKey(eventKey, client = prisma) {
  return client.notification_settings.findUnique({
    where: { event_key: eventKey },
    include: withAdmins,
  });
}

// บันทึกทั้งชุดใน transaction เดียว: แถวตั้งค่า + รายชื่อ Admin ที่เลือก (ลบของเก่าแล้วใส่ใหม่ทั้งหมด)
export async function save(
  eventKey,
  { enabled, recipientMode, extraEmails, subject, body, adminIds, updatedBy },
) {
  const data = {
    enabled,
    recipient_mode: recipientMode,
    extra_emails: extraEmails,
    subject_template: subject,
    body_template: body,
    updated_by: updatedBy,
  };

  return prisma.$transaction(async (tx) => {
    await tx.notification_settings.upsert({
      where: { event_key: eventKey },
      create: { event_key: eventKey, ...data },
      update: data,
    });
    await tx.notification_setting_admins.deleteMany({ where: { event_key: eventKey } });
    if (adminIds.length > 0) {
      await tx.notification_setting_admins.createMany({
        data: adminIds.map((userId) => ({ event_key: eventKey, user_id: userId })),
      });
    }
  });
}

// คืนค่าเริ่มต้น = ลบแถวทิ้ง (ไม่มีแถว = ใช้ค่าเริ่มต้นในโค้ด) แถว Admin ที่เลือกหายตามด้วย ON DELETE CASCADE
export async function remove(eventKey, client = prisma) {
  return client.notification_settings.deleteMany({ where: { event_key: eventKey } });
}
