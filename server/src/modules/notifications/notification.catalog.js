// รายการเหตุการณ์ที่ระบบส่งอีเมลแจ้งเตือน + ค่าเริ่มต้นของแต่ละเหตุการณ์ (ที่เดียวที่รู้จักเหตุการณ์ทั้งหมด)
// ค่าเริ่มต้นตรงกับอีเมลที่ระบบส่งอยู่ก่อนมีหน้า "แจ้งเตือนอีเมล" Admin แก้แล้วจะเก็บใน DB (notification_settings)
// ถ้าจะเพิ่มเหตุการณ์ใหม่: เพิ่มรายการที่นี่ แล้วเรียก sendNotification(eventKey, ...) ในจุดที่เกิดเหตุการณ์ ไม่ต้องทำ migration
//
// ข้อความอีเมลเป็นแบบ plain text มี {{ตัวแปร}} ให้ระบบแทนค่า ย่อหน้าคั่นด้วยบรรทัดว่าง ตัวแปร 2 ตัวพิเศษ:
//   {{details}} = รายการข้อมูล "หัวข้อ: ค่า" หลายบรรทัด   {{link}} = ปุ่ม/ลิงก์เปิดระบบ
// (ทั้งสองตัวใช้ได้เฉพาะในเนื้อความ ไม่ใช้ในหัวเรื่อง)

export const RECIPIENT_MODES = ['requester', 'all_admins', 'selected_admins'];

export const RECIPIENT_MODE_LABELS = {
  requester: 'ผู้ที่เกี่ยวข้อง',
  all_admins: 'Admin ทุกคน',
  selected_admins: 'Admin ที่เลือก',
};

// ตัวแปรที่ทุกเหตุการณ์มี: ชื่อของ "ผู้รับอีเมลฉบับนั้น" (ส่งแยกทีละคน จึงใส่ชื่อของแต่ละคนได้)
const nameVariable = { key: 'name', label: 'ชื่อผู้รับอีเมล', sample: 'สมชาย ใจดี' };
const linkVariable = { key: 'link', label: 'ปุ่มเปิดระบบ', sample: '', block: true };
const detailsVariable = { key: 'details', label: 'รายละเอียดทั้งชุด', sample: '', block: true };

export const NOTIFICATION_EVENTS = {
  idp_pending: {
    label: 'IDP รอตรวจ',
    description: 'เมื่อมีคนส่ง IDP เข้ามา (ส่งครั้งแรก หรือแก้ไขแล้วส่งใหม่) เพื่อให้ Admin ไปตรวจ',
    // "ผู้ที่เกี่ยวข้อง" ของเหตุการณ์นี้คือผู้ส่งเอกสาร
    requesterLabel: 'ผู้ส่งเอกสาร',
    canDisable: true,
    allowExtraEmails: true,
    defaultRecipientMode: 'all_admins',
    linkLabel: 'เปิดระบบเพื่อตรวจ',
    variables: [
      nameVariable,
      { key: 'doc_label', label: 'ชื่อสั้นของเอกสาร', sample: 'IDP' },
      { key: 'doc_title', label: 'ชื่อเต็มของเอกสาร', sample: 'แผนพัฒนาบุคลากรรายบุคคล (IDP)' },
      { key: 'sender_name', label: 'ชื่อผู้ส่ง', sample: 'อาจารย์ใจดี มีสุข' },
      { key: 'sender_email', label: 'อีเมลผู้ส่ง', sample: 'jaidee@example.test' },
      { key: 'academic_year', label: 'ปีการศึกษา', sample: '2569' },
      { key: 'file_name', label: 'ชื่อไฟล์', sample: 'IDP-2569.pdf' },
      { key: 'submitted_at', label: 'เวลาที่ส่ง', sample: '21 พ.ย. 2569 09:30 น.' },
      { key: 'note', label: 'หมายเหตุจากผู้ส่ง', sample: 'แก้ไขตามที่ตรวจครั้งก่อนแล้ว' },
      detailsVariable,
      linkVariable,
    ],
    sampleRows: [
      ['ผู้ส่ง', 'อาจารย์ใจดี มีสุข (jaidee@example.test)'],
      ['ปีการศึกษา', '2569'],
      ['ไฟล์', 'IDP-2569.pdf'],
      ['ส่งเมื่อ', '21 พ.ย. 2569 09:30 น.'],
      ['หมายเหตุ', 'แก้ไขตามที่ตรวจครั้งก่อนแล้ว'],
    ],
    defaultSubject: '{{doc_label}} รอตรวจ: {{sender_name}} (ปีการศึกษา {{academic_year}})',
    defaultBody: 'มี{{doc_title}} ส่งเข้ามารอตรวจ\n\n{{details}}\n\n{{link}}',
  },

  idp_reviewed: {
    label: 'ผลการตรวจ IDP',
    description: 'เมื่อ Admin ตรวจ IDP เสร็จ (ผ่าน หรือส่งกลับให้แก้ไข) เพื่อแจ้งเจ้าของเอกสาร',
    requesterLabel: 'เจ้าของเอกสาร',
    canDisable: true,
    allowExtraEmails: true,
    defaultRecipientMode: 'requester',
    linkLabel: 'เปิดระบบเพื่อดูรายละเอียด',
    variables: [
      nameVariable,
      { key: 'doc_label', label: 'ชื่อสั้นของเอกสาร', sample: 'IDP' },
      { key: 'doc_title', label: 'ชื่อเต็มของเอกสาร', sample: 'แผนพัฒนาบุคลากรรายบุคคล (IDP)' },
      { key: 'owner_name', label: 'ชื่อเจ้าของเอกสาร', sample: 'อาจารย์ใจดี มีสุข' },
      { key: 'result', label: 'ผลการตรวจ (ผ่าน / ส่งกลับให้แก้ไข)', sample: 'ส่งกลับให้แก้ไข' },
      { key: 'academic_year', label: 'ปีการศึกษา', sample: '2569' },
      { key: 'file_name', label: 'ชื่อไฟล์ที่ส่ง', sample: 'IDP-2569.pdf' },
      { key: 'submitted_at', label: 'เวลาที่ส่ง', sample: '21 พ.ย. 2569 09:30 น.' },
      { key: 'reviewed_at', label: 'เวลาที่ตรวจ', sample: '21 พ.ย. 2569 14:05 น.' },
      { key: 'review_note', label: 'หมายเหตุจากผู้ตรวจ', sample: 'กรุณาเพิ่มแผนอบรมครึ่งปีหลัง' },
      {
        key: 'closing',
        label: 'ข้อความให้แก้ไข (ขึ้นเฉพาะตอนส่งกลับ)',
        sample: 'กรุณาแก้ไขตามหมายเหตุ แล้วส่ง IDP ใหม่ในระบบ',
      },
      detailsVariable,
      linkVariable,
    ],
    sampleRows: [
      ['ผลการตรวจ', 'ส่งกลับให้แก้ไข'],
      ['ปีการศึกษา', '2569'],
      ['ไฟล์ที่ส่ง', 'IDP-2569.pdf'],
      ['ส่งเมื่อ', '21 พ.ย. 2569 09:30 น.'],
      ['ตรวจเมื่อ', '21 พ.ย. 2569 14:05 น.'],
      ['หมายเหตุจากผู้ตรวจ', 'กรุณาเพิ่มแผนอบรมครึ่งปีหลัง'],
    ],
    defaultSubject: 'ผลการตรวจ {{doc_label}}: {{result}} (ปีการศึกษา {{academic_year}})',
    defaultBody:
      'สวัสดีคุณ {{name}} {{doc_title}} ที่คุณส่งไว้ตรวจเสร็จแล้ว\n\n{{details}}\n\n{{closing}}\n\n{{link}}',
  },

  password_reset: {
    label: 'ลิงก์ตั้งรหัสผ่านใหม่',
    description: 'เมื่อมีคนกด "ลืมรหัสผ่าน" ระบบส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลของบัญชีนั้น',
    requesterLabel: 'เจ้าของบัญชี',
    // ปิดไม่ได้ / เปลี่ยนผู้รับไม่ได้ / เพิ่มผู้รับไม่ได้: ลิงก์นี้เปลี่ยนรหัสผ่านของบัญชีได้ ต้องถึงเจ้าของบัญชีคนเดียวเท่านั้น
    canDisable: false,
    allowExtraEmails: false,
    defaultRecipientMode: 'requester',
    lockedRecipientMode: 'requester',
    // บังคับให้ข้อความมีตัวแปรเหล่านี้ ไม่งั้นอีเมลไม่มีลิงก์ให้กด
    requiredVariables: ['link'],
    // แสดงลิงก์ตัวหนังสือใต้ปุ่มด้วย เผื่อโปรแกรมอ่านอีเมลไม่แสดงปุ่ม
    showRawLink: true,
    linkLabel: 'ตั้งรหัสผ่านใหม่',
    variables: [
      nameVariable,
      { key: 'minutes', label: 'อายุของลิงก์ (นาที)', sample: '30' },
      linkVariable,
    ],
    sampleRows: [],
    defaultSubject: 'ตั้งรหัสผ่านใหม่ — ระบบจัดการวัสดุและครุภัณฑ์',
    defaultBody:
      'สวัสดีคุณ {{name}}\n\nมีการขอตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่\n\n{{link}}\n\nลิงก์นี้ใช้ได้ครั้งเดียวภายใน {{minutes}} นาที ถ้าคุณไม่ได้เป็นคนขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ',
  },
};

export const EVENT_KEYS = Object.keys(NOTIFICATION_EVENTS);

export function getEvent(eventKey) {
  return NOTIFICATION_EVENTS[eventKey] ?? null;
}

// ค่าตัวอย่างของตัวแปรสำหรับ "ดูตัวอย่าง" และ "ส่งอีเมลทดสอบ" ตัวแปรที่เป็นบล็อกใส่ในที่อื่น (ดู notification.template.js)
export function sampleValues(event) {
  return Object.fromEntries(
    event.variables.filter((variable) => !variable.block).map((v) => [v.key, v.sample]),
  );
}
