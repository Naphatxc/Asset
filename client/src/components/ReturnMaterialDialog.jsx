// Dialog ให้ Admin รับคืนวัสดุที่ต้องคืน — คืนทีละส่วนได้ (เบิก 3 คืน 2 แล้วค่อยคืนอีก 1)
// ค่าเริ่มต้นคือยอดที่ยังค้างทั้งหมด เพราะส่วนใหญ่คืนครบในครั้งเดียว
import { useState } from 'react';

export default function ReturnMaterialDialog({
  withdrawal,
  submitting,
  onSubmit,
  onClose,
}) {
  const outstanding = withdrawal.outstanding_quantity;
  const [quantity, setQuantity] = useState(String(outstanding));
  const [remark, setRemark] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty <= 0) {
      setError('กรุณาระบุจำนวนที่รับคืนให้ถูกต้อง');
      return;
    }
    if (qty > outstanding) {
      setError(`คืนได้ไม่เกินจำนวนที่ยังค้าง (${outstanding} ${withdrawal.unit_name})`);
      return;
    }

    setError('');
    onSubmit({ quantity: qty, remark: remark.trim() || null });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="withdraw-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="return-material-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <p className="section-kicker">Return material</p>
            <h2 id="return-material-dialog-title">รับคืนวัสดุ</h2>
          </div>
        </div>

        <p className="withdraw-dialog-material">
          <span className="equipment-code">{withdrawal.material_code}</span>{' '}
          {withdrawal.material_name} — {withdrawal.user_name} ยังค้างคืน {outstanding}{' '}
          {withdrawal.unit_name} (เบิกไป {withdrawal.quantity})
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              จำนวนที่รับคืน ({withdrawal.unit_name})
              <input
                type="number"
                min="1"
                max={outstanding}
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- โฟกัสช่องกรอกจำนวนให้พิมพ์ต่อได้ทันที
                autoFocus
                required
              />
            </label>

            <label className="field-wide">
              หมายเหตุ (ไม่บังคับ)
              <textarea
                rows="2"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                placeholder="เช่น สภาพของที่คืน"
              />
            </label>
          </div>

          {error && <p className="error-message">{error}</p>}

          <div className="form-actions">
            <button className="button-primary" type="submit" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'ยืนยันรับคืน'}
            </button>
            <button className="button-secondary" type="button" onClick={onClose}>
              ยกเลิก
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
