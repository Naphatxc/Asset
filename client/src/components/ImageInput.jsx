// ช่องเลือกรูปครุภัณฑ์/วัสดุในฟอร์ม (รูปเดียวต่อรายการ) — บนมือถือ accept="image/*" ให้เลือกถ่ายรูปจากกล้องได้เลย
// ไม่ได้อัปโหลดทันที แค่ส่ง imageChange ขึ้นไปให้ฟอร์ม แล้ว Manager ค่อยอัปโหลดหลังบันทึกข้อมูลสำเร็จ
// (ตอนสร้างใหม่ยังไม่มี id ให้อัปโหลดเข้าไป)
// imageChange: null = ไม่แตะรูป, { file, thumbnail } = รูปใหม่ (thumbnail อาจเป็น null), { remove: true } = ลบรูป
import { useEffect, useRef, useState } from 'react';

import { toApiUrl } from '../api/http.js';

// รูปจากกล้องมือถือมักใหญ่ 3–10MB ย่อด้านยาวเหลือ 1600px เป็น JPEG ก่อนส่ง อัปโหลดเร็วขึ้นมากและเปลือง volume น้อยลง
// แปลงเป็น JPEG ยังช่วยให้ไฟล์ HEIC (ถ้า browser ถอดรหัสได้) ผ่านเงื่อนไขชนิดไฟล์ของ server ด้วย
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;
// รูปจิ๋วสำหรับตาราง (กล่อง 48px บนจอ 3x) ย่อให้ด้านสั้นเหลือ 160px เพราะ CSS ครอปแบบ cover ด้วยด้านสั้น
// ไฟล์ละไม่กี่ KB ตารางหน้าหนึ่งไม่ต้องโหลดรูปเต็มทีละหลายร้อย KB (server ต้องการเป็น JPEG เท่านั้น)
const THUMBNAIL_SHORT_SIDE = 160;
const THUMBNAIL_QUALITY = 0.8;

async function renderJpeg(bitmap, scale, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

// คืน { file, thumbnail } — ถอดรหัสไม่ได้คืนไฟล์เดิมโดยไม่มีรูปจิ๋ว (server จะใช้รูปเต็มแทนในตาราง)
async function prepareImage(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const longSide = Math.max(bitmap.width, bitmap.height);
    const shortSide = Math.min(bitmap.width, bitmap.height);
    const [blob, thumbBlob] = await Promise.all([
      renderJpeg(bitmap, Math.min(1, MAX_IMAGE_DIMENSION / longSide), JPEG_QUALITY),
      renderJpeg(bitmap, Math.min(1, THUMBNAIL_SHORT_SIDE / shortSide), THUMBNAIL_QUALITY),
    ]);
    bitmap.close();

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    const thumbnail = thumbBlob
      ? new File([thumbBlob], `${baseName}-thumb.jpg`, { type: 'image/jpeg' })
      : null;
    // ย่อแล้วใหญ่กว่าเดิม (เช่น PNG ภาพเล็กๆ) ใช้ไฟล์เดิมดีกว่า
    if (!blob || blob.size >= file.size) return { file, thumbnail };

    return { file: new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }), thumbnail };
  } catch {
    // browser ถอดรหัสไม่ได้ ส่งไฟล์เดิมไปให้ server ตัดสินเอง (จะได้ข้อความ error ชนิดไฟล์ที่ชัดเจน)
    return { file, thumbnail: null };
  }
}

// onProcessingChange: ฟอร์มใช้ปิดปุ่มบันทึกระหว่างย่อรูป ไม่งั้นกดบันทึกเร็วๆ ตอนรูปยังไม่เสร็จ รูปจะหายไปเงียบๆ
export default function ImageInput({
  currentUrl,
  value,
  onChange,
  onProcessingChange,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [processing, setProcessing] = useState(false);

  // object URL ของไฟล์ที่เลือกต้อง revoke ทิ้งเองเมื่อเปลี่ยนไฟล์/ปิดฟอร์ม ไม่งั้นค้างในหน่วยความจำ
  useEffect(() => {
    if (!value?.file) {
      setPreviewUrl(null);
      return undefined;
    }

    const url = URL.createObjectURL(value.file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [value]);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    // เคลียร์ value กัน onChange ไม่ยิงซ้ำถ้าเลือกไฟล์เดิมอีกรอบ
    event.target.value = '';
    if (!file) return;

    setProcessing(true);
    onProcessingChange?.(true);
    try {
      onChange(await prepareImage(file));
    } finally {
      setProcessing(false);
      onProcessingChange?.(false);
    }
  }

  const shownUrl = value?.remove ? null : previewUrl ?? toApiUrl(currentUrl);
  const hasSavedImage = Boolean(currentUrl) && !value?.remove;

  return (
    <div className="image-input">
      <div className="image-input-preview">
        {shownUrl ? (
          <img src={shownUrl} alt="รูปที่เลือก" />
        ) : (
          <span>{processing ? 'กำลังเตรียมรูป...' : 'ยังไม่มีรูป'}</span>
        )}
      </div>

      <div className="image-input-actions">
        <button
          className="button-secondary"
          type="button"
          disabled={disabled || processing}
          onClick={() => inputRef.current?.click()}
        >
          {shownUrl ? 'เปลี่ยนรูป' : 'เลือกรูป / ถ่ายรูป'}
        </button>
        {value?.file && (
          <button
            className="button-secondary"
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            {currentUrl ? 'ใช้รูปเดิม' : 'ไม่ใช้รูปนี้'}
          </button>
        )}
        {hasSavedImage && !value?.file && (
          <button
            className="button-danger"
            type="button"
            disabled={disabled}
            onClick={() => onChange({ remove: true })}
          >
            ลบรูป
          </button>
        )}
        {value?.remove && (
          <button
            className="button-secondary"
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            ยกเลิกการลบรูป
          </button>
        )}
        <p className="field-hint">
          {value?.remove
            ? 'รูปเดิมจะถูกลบเมื่อกดบันทึก'
            : 'รองรับ jpg, png, webp ระบบย่อขนาดรูปให้อัตโนมัติ'}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="file-drop-native-input"
        onChange={handleFileChange}
      />
    </div>
  );
}
