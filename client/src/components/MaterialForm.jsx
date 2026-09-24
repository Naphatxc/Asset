// Form เดียวใช้ได้ทั้งเพิ่มและแก้ไขวัสดุ โดยดูจากว่ามี material ส่งเข้ามาหรือไม่ (เหมือน EquipmentForm.jsx)
// ต่างจากครุภัณฑ์ตรงที่ไม่มีสถานที่/สถานะ/ QR แต่มีจำนวนคงเหลือ/ขั้นต่ำ/หน่วยนับ/วันหมดอายุแทน
import { useEffect, useMemo, useState } from 'react';
import CharCount from './CharCount.jsx';
import ImageInput from './ImageInput.jsx';
import SelectWithCreate from './SelectWithCreate.jsx';
import ThaiDateInput from './ThaiDateInput.jsx';
import { categoryCreateFields } from './EquipmentForm.jsx';

const MAX_MATERIAL_NAME_LENGTH = 150;
const MAX_MATERIAL_CODE_LENGTH = 50;
const MAX_UNIT_NAME_LENGTH = 50;
const MAX_LONG_TEXT_LENGTH = 2000;

function RequiredMark() {
  return (
    <span className="required-mark" aria-hidden="true">
      {' '}
      *
    </span>
  );
}

const emptyForm = {
  material_name: '',
  material_code: '',
  category_id: '',
  quantity: '0',
  minimum_quantity: '0',
  unit_name: '',
  unit_price: '',
  expire_date: '',
  remark: '',
  is_returnable: false,
};

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function createInitialForm(material) {
  if (!material) return emptyForm;

  return {
    material_name: material.material_name ?? '',
    material_code: material.material_code ?? '',
    category_id: String(material.category_id ?? ''),
    quantity: String(material.quantity ?? 0),
    minimum_quantity: String(material.minimum_quantity ?? 0),
    unit_name: material.unit_name ?? '',
    unit_price: material.unit_price ?? '' ? String(material.unit_price) : '',
    expire_date: toDateInput(material.expire_date),
    remark: material.remark ?? '',
    is_returnable: Boolean(material.is_returnable),
  };
}

export default function MaterialForm({
  material,
  categories,
  submitting,
  onSubmit,
  onCancel,
  onCreateCategory,
}) {
  const [form, setForm] = useState(() => createInitialForm(material));
  // รูปที่เลือกไว้แต่ยังไม่ได้อัปโหลด (ดู ImageInput.jsx) ส่งไปพร้อม payload ตอนกดบันทึก
  const [imageChange, setImageChange] = useState(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const editing = Boolean(material);

  useEffect(() => {
    setForm(createInitialForm(material));
    setImageChange(null);
  }, [material]);

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.category_id),
        label: category.category_name,
      })),
    [categories],
  );

  const [formError, setFormError] = useState('');

  function updateField(event) {
    const { name, type, value, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    if (formError) setFormError('');
  }

  function findRequiredFieldError() {
    if (!form.material_name.trim()) return 'กรุณากรอกชื่อวัสดุ';
    if (!form.material_code.trim()) return 'กรุณากรอกรหัสวัสดุ';
    if (!form.category_id) return 'กรุณาเลือกหมวดหมู่';
    if (!form.unit_name.trim()) return 'กรุณากรอกหน่วยนับ';

    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();
    // กด Enter ในช่องกรอกก็ submit ได้ ปุ่มที่ปิดไว้กันไม่ครบ ต้องเช็คตรงนี้ด้วย
    if (imageProcessing) return;

    const requiredFieldError = findRequiredFieldError();
    if (requiredFieldError) {
      setFormError(requiredFieldError);
      return;
    }

    setFormError('');

    const payload = {
      material_name: form.material_name.trim(),
      category_id: Number(form.category_id),
      quantity: form.quantity === '' ? 0 : Number(form.quantity),
      minimum_quantity:
        form.minimum_quantity === '' ? 0 : Number(form.minimum_quantity),
      unit_name: form.unit_name.trim(),
      unit_price: form.unit_price === '' ? null : Number(form.unit_price),
      expire_date: form.expire_date || null,
      remark: form.remark.trim() || null,
      is_returnable: form.is_returnable,
    };

    if (editing) {
      // ส่งเฉพาะช่องที่แก้จริง โดยเฉพาะจำนวนคงเหลือ: ถ้าส่งค่าตอนเปิดฟอร์มกลับไปทุกครั้ง จะทับยอดที่มีคน
      // เบิกไประหว่างที่ฟอร์มเปิดค้างอยู่ (ชื่อ key ของ payload ตรงกับของ form ทุกตัว)
      const initial = createInitialForm(material);
      const changed = Object.fromEntries(
        Object.entries(payload).filter(([field]) => form[field] !== initial[field]),
      );

      if (Object.keys(changed).length === 0 && !imageChange) {
        onCancel();
        return;
      }

      onSubmit(changed, imageChange);
      return;
    }

    // material_code กำหนดตอนสร้างเท่านั้น (เหมือน equipment_code) กันรหัสเปลี่ยนทั้งที่ของชิ้นเดิม
    payload.material_code = form.material_code.trim().toUpperCase();

    onSubmit(payload, imageChange);
  }

  return (
    <form className="equipment-form" onSubmit={handleSubmit}>
      <div className="form-heading">
        <div>
          <p className="section-kicker">{editing ? 'Edit material' : 'New material'}</p>
          <h3>{editing ? 'แก้ไขวัสดุ' : 'เพิ่มวัสดุใหม่'}</h3>
        </div>
        <button className="button-secondary" type="button" onClick={onCancel}>
          ปิด
        </button>
      </div>

      <div className="form-grid">
        <label className="field-wide">
          <span>
            ชื่อวัสดุ
            <RequiredMark />
          </span>
          <input
            name="material_name"
            value={form.material_name}
            onChange={updateField}
            maxLength={MAX_MATERIAL_NAME_LENGTH}
            required
          />
          <CharCount length={form.material_name.length} max={MAX_MATERIAL_NAME_LENGTH} />
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
          <span>
            รหัสวัสดุ
            <RequiredMark />
          </span>
          <input
            name="material_code"
            value={form.material_code}
            onChange={updateField}
            placeholder={editing ? undefined : 'ตัวอย่าง: MAT-PAPER-A4'}
            maxLength={MAX_MATERIAL_CODE_LENGTH}
            readOnly={editing}
            required
          />
          {!editing && (
            <CharCount length={form.material_code.length} max={MAX_MATERIAL_CODE_LENGTH} />
          )}
        </label>

        <label>
          <span>
            หน่วยนับ
            <RequiredMark />
          </span>
          <input
            name="unit_name"
            value={form.unit_name}
            onChange={updateField}
            placeholder="เช่น ชิ้น, กล่อง, รีม"
            maxLength={MAX_UNIT_NAME_LENGTH}
            required
          />
          <CharCount length={form.unit_name.length} max={MAX_UNIT_NAME_LENGTH} />
        </label>

        <label>
          จำนวนคงเหลือ
          <input
            name="quantity"
            type="number"
            min="0"
            step="1"
            value={form.quantity}
            onChange={updateField}
          />
        </label>

        <label>
          จำนวนขั้นต่ำ (แจ้งเตือนเมื่อต่ำกว่านี้)
          <input
            name="minimum_quantity"
            type="number"
            min="0"
            step="1"
            value={form.minimum_quantity}
            onChange={updateField}
          />
        </label>

        <label>
          ราคาต่อหน่วย
          <input
            name="unit_price"
            type="number"
            min="0"
            step="0.01"
            value={form.unit_price}
            onChange={updateField}
          />
        </label>

        <label>
          วันหมดอายุ
          <ThaiDateInput
            name="expire_date"
            value={form.expire_date}
            onChange={updateField}
          />
        </label>

        <div className="field-wide">
          <label className="checkbox-list-item">
            <input
              name="is_returnable"
              type="checkbox"
              checked={form.is_returnable}
              onChange={updateField}
            />
            ต้องนำมาคืน (เช่น สาย HDMI) — ผู้เบิกต้องระบุวันครบกำหนดคืน
          </label>
          {editing && material.is_returnable && !form.is_returnable && (
            <p className="field-hint">รายการที่เบิกไปแล้วยังต้องคืนตามกำหนดเดิม มีผลเฉพาะการเบิกครั้งถัดไป</p>
          )}
        </div>

        <label className="field-wide">
          หมายเหตุ
          <textarea
            name="remark"
            rows="3"
            value={form.remark}
            onChange={updateField}
            maxLength={MAX_LONG_TEXT_LENGTH}
          />
          <CharCount length={form.remark.length} max={MAX_LONG_TEXT_LENGTH} />
        </label>

        <div className="field-wide image-field">
          <span>รูปวัสดุ</span>
          <ImageInput
            currentUrl={material?.image_url}
            value={imageChange}
            onChange={setImageChange}
            onProcessingChange={setImageProcessing}
            disabled={submitting}
          />
        </div>
      </div>

      {formError && <p className="error-message">{formError}</p>}

      <div className="form-actions">
        <button className="button-primary" type="submit" disabled={submitting || imageProcessing}>
          {submitting
            ? 'กำลังบันทึก...'
            : imageProcessing
              ? 'กำลังเตรียมรูป...'
              : editing
                ? 'บันทึกการแก้ไข'
                : 'เพิ่มวัสดุ'}
        </button>
        <button className="button-secondary" type="button" onClick={onCancel}>
          ยกเลิก
        </button>
      </div>
    </form>
  );
}
