// หน้าต่างเปลี่ยนรหัสผ่านของตัวเอง เปิดจากปุ่มใน sidebar ของ Dashboard
import ChangePasswordForm from './ChangePasswordForm.jsx';

export default function ChangePasswordDialog({ onClose, onChanged }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="withdraw-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="section-kicker">Account</p>
        <h2 id="change-password-title">เปลี่ยนรหัสผ่าน</h2>
        <p className="withdraw-dialog-material">
          เปลี่ยนแล้วเครื่องอื่นที่ login บัญชีนี้ค้างไว้จะถูกออกจากระบบ
        </p>
        <ChangePasswordForm onSuccess={onChanged} onCancel={onClose} />
      </section>
    </div>
  );
}
