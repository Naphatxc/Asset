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
