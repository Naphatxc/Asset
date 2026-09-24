// URL ใน QR ต้องเป็น URL ที่โทรศัพท์เข้าถึงได้ ไม่ควรผูกกับข้อมูลที่อาจถูกแก้ไข
export function getPublicAppUrl() {
  const configuredUrl = String(
    import.meta.env.VITE_PUBLIC_APP_URL ?? '',
  ).trim();

  if (!configuredUrl) return window.location.origin;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    // ถ้าพิมพ์ค่าใน .env ผิด ให้เว็บยังสร้าง QR จาก URL ที่เปิดอยู่แทนการ crash
    return window.location.origin;
  }
}

export function buildEquipmentUrl(equipmentCode) {
  const baseUrl = new URL(getPublicAppUrl());
  const encodedCode = encodeURIComponent(
    String(equipmentCode).trim().toUpperCase(),
  );

  return new URL(`/equipment/${encodedCode}`, baseUrl).toString();
}

// อ่านรหัสครุภัณฑ์กลับจากข้อความใน QR (ที่ buildEquipmentUrl สร้าง) ไม่สนว่า QR พิมพ์จาก host ไหน
// เผื่อป้ายเก่าที่พิมพ์ตอนยังใช้ URL อื่น ถ้าเป็นข้อความเปล่าๆ (ไม่ใช่ URL) ถือว่าเป็นรหัสตรงๆ
// คืน null ถ้าเป็น URL ที่ไม่ใช่หน้าครุภัณฑ์ เช่น สแกนโดน QR อื่นที่ติดอยู่ใกล้ๆ
export function parseEquipmentCode(scannedText) {
  const text = String(scannedText ?? '').trim();
  if (!text) return null;

  let url;
  try {
    url = new URL(text);
  } catch {
    return text.toUpperCase();
  }

  const match = url.pathname.match(/\/equipment\/([^/]+)\/?$/);
  if (!match) return null;

  try {
    return decodeURIComponent(match[1]).trim().toUpperCase() || null;
  } catch {
    return null;
  }
}
