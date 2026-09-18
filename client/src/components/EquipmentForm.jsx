// Form เดียวใช้ได้ทั้งเพิ่มและแก้ไข โดยดูจากว่ามี equipment ส่งเข้ามาหรือไม่
import { useEffect, useMemo, useState } from 'react';
import SearchableSelect from './SearchableSelect.jsx';

// ช่องที่ required แสดงดอกจันทร์สีแดงกำกับให้เห็นชัดว่าต้องกรอก (ดู .required-mark ใน styles.css)
function RequiredMark() {
  return (
    <span className="required-mark" aria-hidden="true">
      {' '}
      *
    </span>
  );
}

// ค่าเริ่มต้นของฟอร์มสร้างครุภัณฑ์ใหม่
const emptyForm = {
  equipment_name: '',
  equipment_code: '',
  category_id: '',
  location_id: '',
  fiscal_year: '',
  description: '',
  receive_date: '',
  remark: '',
  status: 'available',
  price: '',
  warranty_expire: '',
};

// input type="date" ต้องการ YYYY-MM-DD จึงตัดส่วนเวลาออก
function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

// แปลงข้อมูลจาก API ให้เป็น string ที่ใส่ใน input/select ได้
function createInitialForm(equipment) {
  if (!equipment) return emptyForm;

  return {
    equipment_name: equipment.equipment_name ?? '',
    equipment_code: equipment.equipment_code ?? '',
    category_id: String(equipment.category_id ?? ''),
    location_id: String(equipment.location_id ?? ''),
    fiscal_year: String(equipment.fiscal_year ?? ''),
    description: equipment.description ?? '',
    receive_date: toDateInput(equipment.receive_date),
    remark: equipment.remark ?? '',
    status: equipment.status ?? 'available',
    price: String(equipment.price ?? ''),
    warranty_expire: toDateInput(equipment.warranty_expire),
  };
}

export default function EquipmentForm({
  equipment,
  categories,
  locations,
  submitting,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(() =>
    createInitialForm(equipment),
  );
  const editing = Boolean(equipment);

  // เมื่อผู้ใช้กดแก้ไขคนละรายการ ให้เติมข้อมูลของรายการใหม่ลงฟอร์ม
  useEffect(() => {
    setForm(createInitialForm(equipment));
  }, [equipment]);

  // แปลงเป็น { value, label } ให้ SearchableSelect ใช้ตรงกัน ไม่ต้องรู้ shape ของ categories/locations เอง
  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.category_id),
        label: category.category_name,
      })),
    [categories],
  );
  const locationOptions = useMemo(
    () =>
      locations.map((location) => ({
        value: String(location.location_id),
        label: `${location.location_name}${location.room ? ` · ห้อง ${location.room}` : ''}`,
      })),
    [locations],
  );

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  // ก่อนส่ง API แปลง id/ราคา/ปีจาก string ของ input กลับเป็น number หรือ null
  function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      equipment_name: form.equipment_name.trim(),
      category_id: Number(form.category_id),
      location_id: form.location_id
        ? Number(form.location_id)
        : null,
      fiscal_year: form.fiscal_year
        ? Number(form.fiscal_year)
        : null,
      description: form.description.trim() || null,
      receive_date: form.receive_date || null,
      remark: form.remark.trim() || null,
      price: form.price === '' ? null : Number(form.price),
      warranty_expire: form.warranty_expire || null,
    };

    if (!editing) {
      // equipment_code และ status กำหนดตอนสร้างเท่านั้น เพื่อไม่ให้ QR เดิมเสียในอนาคต
      payload.equipment_code = form.equipment_code
        .trim()
        .toUpperCase();
      payload.status = form.status;
    }

    onSubmit(payload);
  }

  return (
    <form className="equipment-form" onSubmit={handleSubmit}>
      <div className="form-heading">
        <div>
          <p className="section-kicker">
            {editing ? 'Edit equipment' : 'New equipment'}
          </p>
          <h3>
            {editing ? 'แก้ไขครุภัณฑ์' : 'เพิ่มครุภัณฑ์ใหม่'}
          </h3>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={onCancel}
        >
          ปิด
        </button>
      </div>

      <div className="form-grid">
        <label className="field-wide">
          <span>
            ชื่อครุภัณฑ์
            <RequiredMark />
          </span>
          <input
            name="equipment_name"
            value={form.equipment_name}
            onChange={updateField}
            required
          />
        </label>

        <label>
          <span>
            รหัสครุภัณฑ์
            <RequiredMark />
          </span>
          <input
            name="equipment_code"
            value={form.equipment_code}
            onChange={updateField}
            placeholder="STAT-PC-0002"
            readOnly={editing}
            required
          />
        </label>

        <label>
          <span>
            หมวดหมู่
            <RequiredMark />
          </span>
          <SearchableSelect
            name="category_id"
            value={form.category_id}
            onChange={updateField}
            required
            placeholder="พิมพ์ชื่อหมวดหมู่..."
            emptyLabel="เลือกหมวดหมู่"
            options={categoryOptions}
          />
        </label>

        <label>
          สถานที่
          <SearchableSelect
            name="location_id"
            value={form.location_id}
            onChange={updateField}
            placeholder="พิมพ์ชื่อสถานที่..."
            emptyLabel="ยังไม่ระบุ"
            options={locationOptions}
          />
        </label>

        {!editing && (
          <label>
            สถานะเริ่มต้น
            <select
              name="status"
              value={form.status}
              onChange={updateField}
            >
              <option value="available">พร้อมใช้งาน</option>
              <option value="borrowed">ถูกยืม</option>
              <option value="pending_repair">รอซ่อม</option>
              <option value="repairing">กำลังซ่อม</option>
            </select>
          </label>
        )}

        <label>
          ปีงบประมาณ
          <input
            name="fiscal_year"
            type="number"
            min="1901"
            max="2155"
            value={form.fiscal_year}
            onChange={updateField}
          />
        </label>

        <label>
          ราคา
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={updateField}
          />
        </label>

        <label>
          วันที่รับ
          <input
            name="receive_date"
            type="date"
            value={form.receive_date}
            onChange={updateField}
          />
        </label>

        <label>
          วันหมดประกัน
          <input
            name="warranty_expire"
            type="date"
            value={form.warranty_expire}
            onChange={updateField}
          />
        </label>

        <label className="field-wide">
          รายละเอียด
          <textarea
            name="description"
            rows="3"
            value={form.description}
            onChange={updateField}
          />
        </label>

        <label className="field-wide">
          หมายเหตุ
          <textarea
            name="remark"
            rows="3"
            value={form.remark}
            onChange={updateField}
          />
        </label>
      </div>

      <div className="form-actions">
        <button
          className="button-primary"
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? 'กำลังบันทึก...'
            : editing
              ? 'บันทึกการแก้ไข'
              : 'เพิ่มครุภัณฑ์'}
        </button>
        <button
          className="button-secondary"
          type="button"
          onClick={onCancel}
        >
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
