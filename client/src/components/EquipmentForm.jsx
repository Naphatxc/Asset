// Form เดียวใช้ได้ทั้งเพิ่มและแก้ไข โดยดูจากว่ามี equipment ส่งเข้ามาหรือไม่
import { useEffect, useMemo, useState } from 'react';
import CharCount from './CharCount.jsx';
import ImageInput from './ImageInput.jsx';
import SelectWithCreate from './SelectWithCreate.jsx';

// จำกัดความยาวแต่ละช่องกันพิมพ์ยาวเกินจริง (spam) ตัวเลขอิงจากข้อมูลครุภัณฑ์จริงที่ยังไม่ได้ migrate เข้าระบบนี้
// (ชื่อยาวสุด 194 ตัวอักษร, คุณสมบัติ/รายละเอียดยาวสุด ~244 ตัวอักษร) เผื่อ headroom ให้พอ แต่ต้องตรงกับ
// server (equipment.validator.js / options.validator.js) เพราะฝั่ง client แค่กันเบื้องต้น ฝั่ง server คือตัวจริง
const MAX_EQUIPMENT_NAME_LENGTH = 255;
const MAX_EQUIPMENT_CODE_LENGTH = 50;
const MAX_LONG_TEXT_LENGTH = 2000; // description / คุณสมบัติ (remark)
const MAX_NAME_LENGTH = 100; // ชื่อหมวดหมู่ / ชื่อสถานที่ / อาคาร
const MAX_CODE_PREFIX_LENGTH = 20;
const MAX_ROOM_LENGTH = 30;

// ให้ SelectWithCreate ของหมวดหมู่/สถานที่ ไม่ต้องรู้ shape ของ field ที่ใช้กรอกตอนเพิ่มใหม่เอง
// code_prefix ไม่บังคับ — ถ้าใส่ไว้ ระบบจะเดารหัสครุภัณฑ์ตัวถัดไปให้อัตโนมัติทุกครั้งที่เลือกหมวดหมู่นี้
// export ไว้ให้ EquipmentManager.jsx ใช้ร่วมกันได้ (dropdown กรองรายการก็เพิ่มหมวดหมู่/สถานที่ใหม่ได้เหมือนกัน)
export const categoryCreateFields = [
  { name: 'name', label: 'ชื่อหมวดหมู่ใหม่', required: true, maxLength: MAX_NAME_LENGTH },
  {
    name: 'code_prefix',
    label: 'รหัสย่อ เช่น PC (ไม่บังคับ ใช้ออกรหัสครุภัณฑ์อัตโนมัติ)',
    maxLength: MAX_CODE_PREFIX_LENGTH,
  },
];
export const locationCreateFields = [
  { name: 'name', label: 'ชื่อสถานที่ใหม่', required: true, maxLength: MAX_NAME_LENGTH },
  { name: 'building', label: 'อาคาร (ถ้ามี)', maxLength: MAX_NAME_LENGTH },
  { name: 'room', label: 'ห้อง (ถ้ามี)', maxLength: MAX_ROOM_LENGTH },
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

// ปีงบประมาณเก็บใน DB เป็น ค.ศ. (คอลัมน์ MySQL YEAR รับได้แค่ 1901–2155) แต่ผู้ใช้กรอก/เห็นเป็น พ.ศ.
const BUDDHIST_ERA_OFFSET = 543;

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
    fiscal_year: equipment.fiscal_year
      ? String(equipment.fiscal_year + BUDDHIST_ERA_OFFSET)
      : '',
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
  // รูปที่เลือกไว้แต่ยังไม่ได้อัปโหลด (ดู ImageInput.jsx) ส่งไปพร้อม payload ตอนกดบันทึก
  const [imageChange, setImageChange] = useState(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  // true ทันทีที่ผู้ใช้พิมพ์รหัสเอง กันไม่ให้ auto-suggest ทับค่าที่พิมพ์เองทิ้งตอนเปลี่ยนหมวดหมู่
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const editing = Boolean(equipment);

  // เมื่อผู้ใช้กดแก้ไขคนละรายการ (หรือเปิดฟอร์มสร้างใหม่) ให้เติมข้อมูลของรายการใหม่ลงฟอร์ม
  useEffect(() => {
    setForm(createInitialForm(equipment));
    setCodeManuallyEdited(false);
    setImageChange(null);
  }, [equipment]);

  // ตอนสร้างครุภัณฑ์ใหม่ (ไม่ใช่แก้ไข) และยังไม่เคยพิมพ์รหัสเอง: รหัสต้องตามหมวดหมู่ที่เลือกเสมอ — เปลี่ยน
  // หมวดหมู่ปุ๊บเคลียร์รหัสเดิมทิ้งก่อน (กันรหัสของหมวดหมู่ก่อนหน้าค้างอยู่ทั้งที่ไม่ตรงกันแล้ว) แล้วค่อยเติม
  // รหัสตัวถัดไปให้ถ้าหมวดหมู่นั้นมี code_prefix ตั้งไว้ (ยังแก้เองทับได้เสมอ ไม่ใช่ readOnly)
  useEffect(() => {
    if (editing || codeManuallyEdited) return;

    setForm((current) =>
      current.equipment_code ? { ...current, equipment_code: '' } : current,
    );

    if (!form.category_id) return;

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
    // กด Enter ในช่องกรอกก็ submit ได้ ปุ่มที่ปิดไว้กันไม่ครบ ต้องเช็คตรงนี้ด้วย
    if (imageProcessing) return;

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
        ? Number(form.fiscal_year) - BUDDHIST_ERA_OFFSET
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

    // ตอนแก้ไข ถ้าข้อมูลไม่เปลี่ยนเลยไม่ต้อง PATCH (ไม่งั้นได้ประวัติ "แก้ไขข้อมูล" ว่างๆ ทุกครั้งที่เปลี่ยนแค่รูป)
    // ส่ง payload เป็น null ให้ Manager ข้ามไปบันทึกรูปอย่างเดียว ถ้าไม่เปลี่ยนอะไรเลยก็ปิดฟอร์มไป
    if (editing) {
      const initial = createInitialForm(equipment);
      const unchanged = Object.keys(initial).every((field) => form[field] === initial[field]);

      if (unchanged) {
        if (imageChange) onSubmit(null, imageChange);
        else onCancel();
        return;
      }
    }

    onSubmit(payload, imageChange);
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
            maxLength={MAX_EQUIPMENT_NAME_LENGTH}
            required
          />
          <CharCount length={form.equipment_name.length} max={MAX_EQUIPMENT_NAME_LENGTH} />
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
            รหัสครุภัณฑ์
            <RequiredMark />
          </span>
          <input
            name="equipment_code"
            value={form.equipment_code}
            onChange={updateEquipmentCode}
            placeholder={
              editing
                ? undefined
                : 'เลือกหมวดหมู่ก่อนเพื่อให้ระบบออกรหัสให้ หรือพิมพ์เอง ตัวอย่าง: STAT-PC-0001'
            }
            maxLength={MAX_EQUIPMENT_CODE_LENGTH}
            readOnly={editing}
            required
          />
          {!editing && (
            <CharCount length={form.equipment_code.length} max={MAX_EQUIPMENT_CODE_LENGTH} />
          )}
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
          ปีงบประมาณ (พ.ศ.)
          <input
            name="fiscal_year"
            type="number"
            min="2444"
            max="2698"
            placeholder="เช่น 2569"
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
            maxLength={MAX_LONG_TEXT_LENGTH}
            required
          />
          <CharCount length={form.description.length} max={MAX_LONG_TEXT_LENGTH} />
        </label>

        <label className="field-wide">
          คุณสมบัติ
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
          <span>รูปครุภัณฑ์</span>
          <ImageInput
            currentUrl={equipment?.image_url}
            value={imageChange}
            onChange={setImageChange}
            onProcessingChange={setImageProcessing}
            disabled={submitting}
          />
        </div>
      </div>

      {formError && <p className="error-message">{formError}</p>}

      <div className="form-actions">
        <button
          className="button-primary"
          type="submit"
          disabled={submitting || imageProcessing}
        >
          {submitting
            ? 'กำลังบันทึก...'
            : imageProcessing
              ? 'กำลังเตรียมรูป...'
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
