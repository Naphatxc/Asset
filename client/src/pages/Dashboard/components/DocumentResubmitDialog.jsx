// Popup "แก้ไขแล้วส่งใหม่" ของ IDP ที่ถูกส่งกลับ: เปิดทับหน้าเดิม ผู้ส่งไม่ต้องเลื่อนหน้าไปหาฟอร์ม
// แสดงผลการตรวจของ Admin ไว้ด้านบนให้เห็นว่าต้องแก้อะไร แล้วใช้ฟอร์มส่งเอกสารตัวเดียวกับหน้าหลัก
// ส่งแล้วเป็นรายการใหม่ (รอตรวจ) รายการที่ถูกส่งกลับยังอยู่ในประวัติเหมือนเดิม
import { useModal } from '../../../hooks/useModal.js';
import DocumentReviewResult from './DocumentReviewResult.jsx';
import DocumentSubmitForm from './DocumentSubmitForm.jsx';

export default function DocumentResubmitDialog({ type, label, returned, onClose, onSubmitted }) {
  const dialogRef = useModal(onClose);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="repair-dialog"
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
        tabIndex={-1}
        aria-labelledby="document-resubmit-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <p className="section-kicker">Resubmit</p>
            <h2 id="document-resubmit-title">แก้ไขแล้วส่ง {label} ใหม่</h2>
          </div>
        </div>

        <div className="document-returned-summary">
          <p className="document-returned-title">สิ่งที่ผู้ตรวจให้แก้ไข</p>
          <DocumentReviewResult submission={returned} />
        </div>

        <DocumentSubmitForm
          type={type}
          initialYear={returned.academic_year}
          onSuccess={() => {
            onSubmitted?.();
            onClose();
          }}
          extraActions={
            <button className="button-secondary" type="button" onClick={onClose}>
              ยกเลิก
            </button>
          }
        />
      </section>
    </div>
  );
}
