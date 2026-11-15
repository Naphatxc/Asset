// พฤติกรรมมาตรฐานของ popup (role="dialog"/"alertdialog") ใช้ร่วมกันทุก popup ในระบบ
// - กด Esc = ปิด (เหมือนคลิกพื้นหลัง) เฉพาะ popup ที่อยู่บนสุด popup ซ้อนกัน (เช่น ยืนยันการเบิก) จึงปิดทีละชั้น
// - เปิดแล้วย้ายโฟกัสเข้า popup ให้คนใช้คีย์บอร์ด/โปรแกรมอ่านหน้าจอเริ่มอ่านจากใน popup
//   ถ้ามีช่องที่ autoFocus อยู่ข้างในแล้วจะไม่แย่งโฟกัส
// - กด Tab วนอยู่ใน popup ไม่หลุดไปปุ่มด้านหลังที่มองไม่เห็น
// - ปิดแล้วคืนโฟกัสให้ปุ่มที่กดเปิด จะได้กดต่อจากที่เดิมได้
//
// วิธีใช้: const dialogRef = useModal(onClose) แล้วใส่ ref={dialogRef} tabIndex={-1} ที่ <section role="dialog">
// popup ที่แสดงตามเงื่อนไขในหน้าเดียวกัน ส่ง null ตอนปิดอยู่ เช่น useModal(confirming ? cancel : null)
// เพราะ hook ต้องเรียกทุกครั้งที่ render ห้ามเรียกในเงื่อนไข
import { useEffect, useRef } from 'react';

// popup ที่เปิดอยู่เรียงตามลำดับที่เปิด ตัวท้ายสุดคือตัวบนสุด
const openModals = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModal(onClose) {
  const ref = useRef(null);
  // เก็บ onClose ล่าสุดไว้ใน ref effect จะได้ไม่ต้องผูกใหม่ทุก render (ผู้เรียกมักส่ง arrow function ใหม่ทุกครั้ง)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const open = Boolean(onClose);
  // จำปุ่มที่มีโฟกัสอยู่ตอน popup กำลังจะเปิด ต้องอ่านตอน render (ก่อน React วาง popup ลงหน้า)
  // เพราะช่อง autoFocus ใน popup จะแย่งโฟกัสไปก่อน effect ทำงาน ถ้าอ่านใน effect จะได้ช่องใน popup แทน
  const returnFocusRef = useRef(null);
  if (open && !returnFocusRef.current) returnFocusRef.current = document.activeElement;
  if (!open) returnFocusRef.current = null;

  useEffect(() => {
    if (!open) return undefined;

    const token = {};
    openModals.push(token);
    const previouslyFocused = returnFocusRef.current;
    const isTop = () => openModals[openModals.length - 1] === token;

    const node = ref.current;
    if (node && !node.contains(document.activeElement)) node.focus();

    function handleKeyDown(event) {
      if (!isTop()) return;

      // ช่องเลือกวันที่/ช่องค้นหาแบบมีรายการใน popup ใช้ Esc ปิดรายการของตัวเองก่อน (เรียก preventDefault)
      // กรณีนั้นไม่ปิดทั้ง popup
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key === 'Tab' && ref.current) {
        const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter(
          (element) => element.offsetParent !== null,
        );
        if (items.length === 0) {
          event.preventDefault();
          return;
        }

        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && (active === first || active === ref.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openModals.splice(openModals.indexOf(token), 1);
      // ปุ่มที่กดเปิดอาจหายไปแล้ว (เช่น แถวถูกลบหลังยืนยัน) คืนโฟกัสเฉพาะตอนยังอยู่ในหน้า
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  return ref;
}
