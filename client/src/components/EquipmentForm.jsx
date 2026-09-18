// Form เดียวใช้ได้ทั้งเพิ่มและแก้ไข โดยดูจากว่ามี equipment ส่งเข้ามาหรือไม่
import { useEffect, useMemo, useState } from 'react';
import SelectWithCreate from './SelectWithCreate.jsx';

// ให้ SelectWithCreate ของหมวดหมู่/สถานที่ ไม่ต้องรู้ shape ของ field ที่ใช้กรอกตอนเพิ่มใหม่เอง
// code_prefix ไม่บังคับ — ถ้าใส่ไว้ ระบบจะเดารหัสครุภัณฑ์ตัวถัดไปให้อัตโนมัติทุกครั้งที่เลือกหมวดหมู่นี้
const categoryCreateFields = [
  { name: 'name', label: 'ชื่อหมวดหมู่ใหม่', required: true },
  { name: 'code_prefix', label: 'รหัสย่อ เช่น PC (ไม่บังคับ ใช้ออกรหัสครุภัณฑ์อัตโนมัติ)' },
];
const locationCreateFields = [
  { name: 'name', label: 'ชื่อสถานที่ใหม่', required: true },
  { name: 'building', label: 'อาคาร (ถ้ามี)' },
  { name: 'room', label: 'ห้อง (ถ้ามี)' },
];

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
  onCreateCategory,
  onCreateLocation,
  onFetchNextCode,
}) {
  const [form, setForm] = useState(() =>
    createInitialForm(equipment),
  );
  // true ทันทีที่ผู้ใช้พิมพ์รหัสเอง กันไม่ให้ auto-suggest ทับค่าที่พิมพ์เองทิ้งตอนเปลี่ยนหมวดหมู่
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const editing = Boolean(equipment);

  // เมื่อผู้ใช้กดแก้ไขคนละรายการ (หรือเปิดฟอร์มสร้างใหม่) ให้เติมข้อมูลของรายการใหม่ลงฟอร์ม
  useEffect(() => {
    setForm(createInitialForm(equipment));
    setCodeManuallyEdited(false);
  }, [equipment]);

  // ตอนสร้างครุภัณฑ์ใหม่ (ไม่ใช่แก้ไข) และยังไม่เคยพิมพ์รหัสเอง: พอเลือกหมวดหมู่ที่มี code_prefix ตั้งไว้
  // ให้เดารหัสตัวถัดไปมาเติมให้อัตโนมัติ (ยังแก้เองทับได้เสมอ ไม่ใช่ readOnly)
  useEffect(() => {
    if (editing || !form.category_id || codeManuallyEdited) return;

    let ignore = false;

    onFetchNextCode(Number(form.category_id))
      .then((code) => {
        if (ignore || !code) return;
        setForm((current) => ({ ...current, equipment_code: code }));
      })
      .catch(() => {
        // เดาไม่สำเร็จก็ไม่เป็นไร ผู้ใช้พิมพ์รหัสเองได้ตามปกติ ไม่ต้อง block ฟอร์ม
      });

    return () => {
      ignore = true;
    };
  }, [form.category_id, editing, codeManuallyEdited, onFetchNextCode]);

  // แปลงเป็น { value, label } ให้ SelectWithCreate ใช้ตรงกัน ไม่ต้องรู้ shape ของ categories/locations เอง
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

  const [formError, setFormError] = useState('');

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    // ผู้ใช้เริ่มแก้ไขแล้ว เคลียร์ error เดิมทิ้ง กันข้อความค้างแม้แก้ไขถูกแล้ว
    if (formError) setFormError('');
  }

  function updateEquipmentCode(event) {
    setCodeManuallyEdited(true);
    updateField(event);
  }

  // เช็คฟิลด์ที่ required ทั้งหมดก่อนยิง API เลยสักครั้ง (นอกเหนือจาก HTML required ที่ browser เช็คให้อยู่แล้ว)
  // เพื่อโชว์ข้อความ error แบบเดียวกับที่ใช้ทั้งแอป แทนข้อความ default ของ browser ที่หน้าตาไม่ตรงกัน
  function findRequiredFieldError() {
    if (!form.equipment_name.trim()) return 'กรุณากรอกชื่อครุภัณฑ์';
    if (!form.equipment_code.trim()) return 'กรุณากรอกรหัสครุภัณฑ์';
    if (!form.category_id) return 'กรุณาเลือกหมวดหมู่';
    if (!form.description.trim()) return 'กรุณากรอกรายละเอียดครุภัณฑ์';

    return null;
  }

  // ก่อนส่ง API แปลง id/ราคา/ปีจาก string ของ input กลับเป็น number หรือ null
  function handleSubmit(event) {
    event.preventDefault();

    const requiredFieldError = findRequiredFieldError();
    if (requiredFieldError) {
      setFormError(requiredFieldError);
      return;
    }

    setFormError('');

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
            onChange={updateEquipmentCode}
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
          <SelectWithCreate
            name="category_id"
            value={form.category_id}
            onChange={updateField}
            required
            emptyLabel="เลือกหมวดหมู่"
            options={categoryOptions}
            createLabel="+ เพิ่มหมวดหมู่ใหม่..."
            createFields={categoryCreateFields}
            onCreate={(fields) =>
              onCreateCategory(fields.name, fields.code_prefix)
            }
          />
        </label>

        <label>
          สถานที่
          <SelectWithCreate
            name="location_id"
            value={form.location_id}
            onChange={updateField}
            emptyLabel="ยังไม่ระบุ"
            options={locationOptions}
            createLabel="+ เพิ่มสถานที่ใหม่..."
            createFields={locationCreateFields}
            onCreate={(fields) => onCreateLocation(fields)}
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
          <span>
            รายละเอียด
            <RequiredMark />
          </span>
          <textarea
            name="description"
            rows="3"
            value={form.description}
            onChange={updateField}
            required
          />
        </label>

        <label className="field-wide">
          คุณสมบัติ
          <textarea
            name="remark"
            rows="3"
            value={form.remark}
            onChange={updateField}
          />
        </label>
      </div>

      {formError && <p className="error-message">{formError}</p>}

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
