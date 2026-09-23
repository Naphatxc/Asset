// ช่องเลือกรูปครุภัณฑ์/วัสดุในฟอร์ม (รูปเดียวต่อรายการ) — บนมือถือ accept="image/*" ให้เลือกถ่ายรูปจากกล้องได้เลย
// ไม่ได้อัปโหลดทันที แค่ส่ง imageChange ขึ้นไปให้ฟอร์ม แล้ว Manager ค่อยอัปโหลดหลังบันทึกข้อมูลสำเร็จ
// (ตอนสร้างใหม่ยังไม่มี id ให้อัปโหลดเข้าไป) imageChange: null = ไม่แตะรูป, { file } = รูปใหม่, { remove: true } = ลบรูป
import { useEffect, useRef, useState } from 'react';

import { toApiUrl } from '../api/http.js';

// รูปจากกล้องมือถือมักใหญ่ 3–10MB ย่อด้านยาวเหลือ 1600px เป็น JPEG ก่อนส่ง อัปโหลดเร็วขึ้นมากและเปลือง volume น้อยลง
// แปลงเป็น JPEG ยังช่วยให้ไฟล์ HEIC (ถ้า browser ถอดรหัสได้) ผ่านเงื่อนไขชนิดไฟล์ของ server ด้วย
const MAX_IMAGE_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

async function downscaleImage(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    // ย่อแล้วใหญ่กว่าเดิม (เช่น PNG ภาพเล็กๆ) ใช้ไฟล์เดิมดีกว่า
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch {
    // browser ถอดรหัสไม่ได้ ส่งไฟล์เดิมไปให้ server ตัดสินเอง (จะได้ข้อความ error ชนิดไฟล์ที่ชัดเจน)
    return file;
  }
}

export default function ImageInput({ currentUrl, value, onChange, disabled = false }) {
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
    const resized = await downscaleImage(file);
    setProcessing(false);
    onChange({ file: resized });
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
