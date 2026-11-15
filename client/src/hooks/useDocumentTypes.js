// ชื่อที่แสดงของประเภทเอกสาร (IDP / OBE 3 / OBE 5) ที่ Admin ตั้งไว้ ใช้ร่วมกันทั้งแท็บเมนู หน้าส่งเอกสาร และหน้า Admin
// ระหว่างโหลด หรือโหลดไม่สำเร็จ ใช้ชื่อเริ่มต้นใน utils/documents.js แทน หน้าจะไม่ว่างเปล่า
// คืนค่าเป็น object ตาม key: { idp: { label, title, reviewed }, obe3: {...}, obe5: {...} }
// reviewed (มีขั้นตอนตรวจหรือไม่) เอาจากค่าคงที่เสมอ เพราะเป็นพฤติกรรมในโค้ด ไม่ใช่สิ่งที่เปลี่ยนจากหน้าเว็บได้
import { useQuery } from '@tanstack/react-query';

import { getDocumentTypes } from '../api/documents.js';
import { DOCUMENT_TYPES } from '../utils/documents.js';

export function useDocumentTypes() {
  const query = useQuery({ queryKey: ['document-types'], queryFn: getDocumentTypes });
  const stored = query.data?.types ?? [];

  return Object.fromEntries(
    Object.entries(DOCUMENT_TYPES).map(([key, fallback]) => {
      const type = stored.find((item) => item.doc_type === key);
      return [
        key,
        { label: type?.label ?? fallback.label, title: type?.title ?? fallback.title, reviewed: fallback.reviewed },
      ];
    }),
  );
}
