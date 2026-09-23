// ของที่หน้าสแกน (AuditScanPage) กับหน้าสรุป (AuditManager) ใช้ร่วมกัน: ป้ายสถานะ, จัดกลุ่มผลตรวจ, export CSV

export const equipmentStatusLabels = {
  available: 'พร้อมใช้งาน',
  borrowed: 'ถูกยืม',
  pending_repair: 'รอซ่อม',
  repairing: 'กำลังซ่อม',
  damaged: 'ชำรุด',
  disposed: 'จำหน่ายออก',
};

// ผลของแต่ละชิ้นในรอบ — normal/damaged คือ admin กดเอง ชิ้นที่ไม่ได้ตรวจแต่ถูกยืม/ซ่อมอยู่แยกออกมา
// เพราะไม่ได้หาย แค่ไม่อยู่ให้สแกน
export const outcomeLabels = {
  normal: 'ปกติ',
  damaged: 'ชำรุด',
  borrowed: 'อยู่กับผู้ยืม',
  in_repair: 'อยู่ระหว่างซ่อม',
  deleted: 'จำหน่ายออกระหว่างรอบ',
  unchecked: 'ยังไม่ตรวจ',
  missing: 'ไม่พบ',
};

// รอบที่ปิดแล้วใช้ผลที่ server ตัดสินเก็บไว้ตอนปิด (closing_outcome) ไม่คิดใหม่จากสถานะปัจจุบัน
// ไม่งั้นของที่ถูกยืมตอนปิดรอบ พอคืนแล้วรายงานรอบเก่าจะกลายเป็น "ไม่พบ" เอง
export function classifyRecord(record, roundClosed) {
  if (record.result) return record.result;
  if (roundClosed) return record.closing_outcome ?? 'missing';
  if (record.deleted) return 'deleted';
  if (record.status === 'borrowed') return 'borrowed';
  if (record.status === 'pending_repair' || record.status === 'repairing') return 'in_repair';
  return 'unchecked';
}

export function locationLabel(location) {
  if (!location) return 'ไม่ระบุห้อง';
  return `${location.location_name}${location.room ? ` · ห้อง ${location.room}` : ''}`;
}

export function formatDateTime(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

// ชื่อรอบเริ่มต้นเป็นปี พ.ศ. ตามที่ภาควิชาใช้เรียกกัน
export function defaultRoundTitle() {
  const buddhistYear = new Date().getFullYear() + 543;
  return `ตรวจนับครุภัณฑ์ประจำปี ${buddhistYear}`;
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// CSV ใส่ BOM นำหน้า ไม่งั้น Excel เปิดแล้วภาษาไทยเพี้ยน (มันเดา encoding เป็น ANSI ถ้าไม่มี BOM)
export function downloadAuditCsv(round, records, locationsById) {
  const roundClosed = round.status === 'closed';
  const header = [
    'รหัสครุภัณฑ์',
    'ชื่อครุภัณฑ์',
    'หมวดหมู่',
    'ผลตรวจ',
    'ห้องตามระบบตอนเปิดรอบ',
    'ห้องที่พบ',
    'ย้ายห้องระหว่างตรวจ',
    'สถานะปัจจุบัน',
    'หมายเหตุ',
    'ผู้ตรวจ',
    'เวลาตรวจ',
  ];
  const rows = records.map((record) => [
    record.equipment_code,
    record.equipment_name,
    record.category_name,
    outcomeLabels[classifyRecord(record, roundClosed)],
    locationLabel(locationsById.get(record.expected_location_id)),
    record.found_location_id
      ? locationLabel(locationsById.get(record.found_location_id))
      : '',
    record.location_moved ? 'ใช่' : '',
    equipmentStatusLabels[record.status] ?? record.status,
    record.note,
    record.checked_by_name,
    record.checked_at ? formatDateTime(record.checked_at) : '',
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${round.title}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
