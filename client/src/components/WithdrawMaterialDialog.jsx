// Dialog กรอกจำนวนที่จะเบิกวัสดุ — กดยืนยันแล้วตัดยอดทันที ไม่มีขั้นตอนรออนุมัติ (ต่างจากยืมครุภัณฑ์)
import { useState } from 'react';

export default function WithdrawMaterialDialog({
  material,
  submitting,
  onSubmit,
  onClose,
}) {
  const [quantity, setQuantity] = useState('1');
  const [remark, setRemark] = useState('');
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

    setError('');
    onSubmit({ quantity: qty, remark: remark.trim() || null });
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
            <h2 id="withdraw-dialog-title">เบิกวัสดุ</h2>
          </div>
          <button className="button-secondary" type="button" onClick={onClose}>
            ปิด
          </button>
        </div>

        <p className="withdraw-dialog-material">
          <span className="equipment-code">{material.material_code}</span>{' '}
          {material.material_name} — คงเหลือ {material.quantity}{' '}
          {material.unit_name}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              จำนวนที่เบิก ({material.unit_name})
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
              {submitting ? 'กำลังเบิก...' : 'ยืนยันเบิก'}
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
