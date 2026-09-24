// Dialog กรอกจำนวนที่จะเบิกวัสดุ — กดยืนยันแล้วตัดยอดทันที ไม่มีขั้นตอนรออนุมัติ (ต่างจากยืมครุภัณฑ์)
// วัสดุที่ต้องคืน (is_returnable) ต้องกรอกวันครบกำหนดคืนเพิ่ม เงื่อนไขเดียวกับวันคืนของใบยืมครุภัณฑ์
import { useState } from 'react';

import ThaiDateInput from './ThaiDateInput.jsx';

// ThaiDateInput ใช้ค่า YYYY-MM-DD (เหมือน MyBorrows.jsx)
function tomorrowDateInput() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

export default function WithdrawMaterialDialog({
  material,
  submitting,
  onSubmit,
  onClose,
}) {
  const [quantity, setQuantity] = useState('1');
  const [remark, setRemark] = useState('');
  const [dueDate, setDueDate] = useState('');
  // วัสดุที่ต้องคืนเรียกว่า "ยืม" ให้ตรงกับปุ่มในรายการวัสดุ (MaterialManager.jsx)
  const action = material.is_returnable ? 'ยืม' : 'เบิก';
  const [error, setError] = useState('');

  function handleSubmit(event) {
    event.preventDefault();
    const qty = Number(quantity);

    if (!Number.isInteger(qty) || qty <= 0) {
      setError('กรุณาระบุจำนวนที่จะเบิกให้ถูกต้อง');
      return;
    }
    if (qty > material.quantity) {
      setError(`วัสดุคงเหลือไม่พอ (เหลือ ${material.quantity} ${material.unit_name})`);
      return;
    }

    if (material.is_returnable && !dueDate) {
      setError('กรุณาระบุวันครบกำหนดคืน');
      return;
    }
    if (material.is_returnable && dueDate < tomorrowDateInput()) {
      setError('วันครบกำหนดคืนต้องเป็นวันพรุ่งนี้หรือหลังจากนั้น');
      return;
    }

    setError('');
    onSubmit({
      quantity: qty,
      remark: remark.trim() || null,
      dueDate: material.is_returnable ? dueDate : null,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="withdraw-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <p className="section-kicker">Withdraw material</p>
            <h2 id="withdraw-dialog-title">
              {material.is_returnable ? 'ยืมวัสดุ (ต้องคืน)' : 'เบิกวัสดุ'}
            </h2>
          </div>
        </div>

        <p className="withdraw-dialog-material">
          <span className="equipment-code">{material.material_code}</span>{' '}
          {material.material_name} — คงเหลือ {material.quantity}{' '}
          {material.unit_name}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              จำนวนที่{action} ({material.unit_name})
              <input
                type="number"
                min="1"
                max={material.quantity}
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- โฟกัสช่องกรอกจำนวนให้พิมพ์ต่อได้ทันที
                autoFocus
                required
              />
            </label>

            {material.is_returnable && (
              <label>
                วันครบกำหนดคืน
                <ThaiDateInput
                  value={dueDate}
                  min={tomorrowDateInput()}
                  onChange={(event) => setDueDate(event.target.value)}
                  required
                />
              </label>
            )}

            <label className="field-wide">
              หมายเหตุ (ไม่บังคับ)
              <textarea
                rows="2"
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                placeholder="เช่น ใช้สำหรับงาน..."
              />
            </label>
          </div>

          {error && <p className="error-message">{error}</p>}

          <div className="form-actions">
            <button className="button-primary" type="submit" disabled={submitting}>
              {submitting ? `กำลัง${action}...` : `ยืนยัน${action}`}
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
