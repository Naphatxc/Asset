// รูปย่อในตารางครุภัณฑ์/วัสดุ กดแล้วเปิดรูปเต็มในแท็บใหม่ ไม่มีรูปแสดงกล่องเปล่าให้คอลัมน์ยังตรงแนวกัน
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
      <img src={src} alt={alt} loading="lazy" />
    </a>
  );
}
