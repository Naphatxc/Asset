// รูปย่อในตารางครุภัณฑ์/วัสดุ กดแล้วเปิดรูปเต็มในแท็บใหม่ ไม่มีรูปแสดงกล่องเปล่าให้คอลัมน์ยังตรงแนวกัน
// โหลดรูปจิ๋ว (size=thumb) ไม่ใช่รูปเต็ม — รูปเก่าที่อัปโหลดก่อนมีรูปจิ๋ว server ส่งรูปเต็มมาแทนเอง
import { toApiUrl } from '../api/http.js';

export default function ItemThumbnail({ imageUrl, alt }) {
  const src = toApiUrl(imageUrl);

  if (!src) {
    return (
      <span className="item-thumbnail item-thumbnail-empty" aria-label="ไม่มีรูป">
        –
      </span>
    );
  }

  return (
    <a className="item-thumbnail" href={src} target="_blank" rel="noreferrer">
      {/* image_url มี ?v=<ชื่อไฟล์> อยู่แล้วเสมอ จึงต่อ size ด้วย & */}
      <img src={`${src}&size=thumb`} alt={alt} loading="lazy" />
    </a>
  );
}
