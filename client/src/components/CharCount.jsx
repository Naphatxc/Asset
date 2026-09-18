// โชว์ตัวนับตัวอักษรใต้ช่องที่มี maxLength ให้เห็นระหว่างพิมพ์ว่าใกล้เต็มหรือยัง ไม่ต้องรอโดนตัดเงียบๆ
// เปลี่ยนเป็นสีแดงตอนใกล้เต็ม (90% ขึ้นไป) เตือนก่อนโดนตัดจริง
export default function CharCount({ length, max }) {
  const isNearLimit = length >= max * 0.9;

  return (
    <span className={`char-count${isNearLimit ? ' char-count-warning' : ''}`}>
      {length}/{max}
    </span>
  );
}
