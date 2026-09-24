// นำเข้าครุภัณฑ์/วัสดุหลายรายการจากไฟล์ Excel (.xlsx ตามแม่แบบที่ดาวน์โหลดจากหน้าต่างนี้)
// ครุภัณฑ์รับไฟล์ JSON ได้ด้วย (สร้างด้วย npm --workspace server run export:equipment ใช้ย้ายข้อมูลระหว่างระบบ)
// ขั้นตอน: เลือกไฟล์ -> ดูสรุปก่อนนำเข้า -> นำเข้า -> ดูผล (สร้างกี่รายการ / ข้ามรหัสที่มีอยู่แล้วกี่รายการ)
// ไฟล์ผิดรูปแบบตรวจเจอตั้งแต่เลือกไฟล์ ส่วนข้อมูลรายแถว server ตรวจทั้งไฟล์ก่อน ผิดแถวเดียวก็ไม่นำเข้าเลย
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getCategories, getLocations, importEquipment } from '../../../api/equipment.js';
import { importMaterials } from '../../../api/materials.js';
import {
  EQUIPMENT_IMPORT,
  MATERIAL_IMPORT,
  downloadImportTemplate,
  readImportExcel,
} from '../../../utils/importExcel.js';

const EXPECTED_JSON_FORMAT = 'asset-equipment-v1';

// invalidate = query ที่ต้องโหลดใหม่หลังนำเข้า (หมวดหมู่/สถานที่อาจถูกสร้างเพิ่ม รายการและตัวเลือกในฟอร์มอื่นเปลี่ยน)
const KINDS = {
  equipment: {
    noun: 'ครุภัณฑ์',
    spec: EQUIPMENT_IMPORT,
    importItems: importEquipment,
    acceptJson: true,
    withLocations: true,
    invalidate: ['equipment', 'categories', 'locations'],
    note: 'ของที่นำเข้าจะมีสถานะ "พร้อมใช้งาน" ทั้งหมด',
  },
  material: {
    noun: 'วัสดุ',
    spec: MATERIAL_IMPORT,
    importItems: importMaterials,
    acceptJson: false,
    withLocations: false,
    invalidate: ['materials', 'categories'],
    note: 'จำนวนของรหัสที่มีอยู่แล้วจะไม่ถูกบวกเพิ่ม ถ้าจะรับของเข้าสต๊อกให้แก้จำนวนที่รายการนั้น',
  },
};

async function readJsonFile(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์ .json ที่ได้จากการ export ครุภัณฑ์');
  }

  if (parsed?.format !== EXPECTED_JSON_FORMAT || !Array.isArray(parsed.items)) {
    throw new Error('ไฟล์นี้ไม่ใช่ไฟล์ export ครุภัณฑ์ของระบบนี้');
  }

  return { items: parsed.items, exportedAt: parsed.exported_at };
}

// sourceRows (มีเฉพาะ Excel) = เลขแถวจริงในชีต เพราะข้ามหัวตารางและแถวว่าง เลขแถวที่ server บอกจึงไม่ตรง
async function readImportFile(file, config) {
  const isJson = config.acceptJson && file.name.toLowerCase().endsWith('.json');
  const { items, exportedAt, sourceRows } = isJson
    ? await readJsonFile(file)
    : await readImportExcel(file, config.spec);

  if (items.length === 0) {
    throw new Error(`ไฟล์นี้ไม่มีรายการ${config.noun}`);
  }

  const categories = new Map();
  for (const item of items) {
    const name = String(item?.category_name ?? '').trim() || '(ไม่มีหมวดหมู่)';
    categories.set(name, (categories.get(name) ?? 0) + 1);
  }

  return {
    items,
    exportedAt,
    sourceRows,
    categories: [...categories.entries()].sort((a, b) => b[1] - a[1]),
    withLocation: items.filter((item) => item?.location_name).length,
    returnable: items.filter((item) => item?.is_returnable === true).length,
  };
}

export default function ImportDialog({ kind, onClose }) {
  const config = KINDS[kind];
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [fileError, setFileError] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // ใส่ชื่อหมวดหมู่/สถานที่ที่มีอยู่เป็น dropdown ในแม่แบบ (query เดียวกับหน้ารายการ จึงมักมีใน cache แล้ว)
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: getLocations,
    enabled: config.withLocations,
  });

  const mutation = useMutation({
    mutationFn: () => config.importItems(preview.items),
    onSuccess: () => {
      for (const queryKey of config.invalidate) {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
    },
  });

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFileName(file.name);
    setPreview(null);
    setFileError('');
    mutation.reset();

    try {
      setPreview(await readImportFile(file, config));
    } catch (error) {
      setFileError(error.message);
    }
  }

  async function downloadTemplate() {
    setTemplateError('');
    setDownloadingTemplate(true);
    try {
      await downloadImportTemplate(config.spec, {
        categories: (categoriesQuery.data?.categories ?? []).map((category) => category.category_name),
        locations: (locationsQuery.data?.locations ?? []).map((location) => location.location_name),
      });
    } catch {
      setTemplateError('สร้างไฟล์แม่แบบไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setDownloadingTemplate(false);
    }
  }

  const result = mutation.data;
  const rowErrors = mutation.error?.data?.errors ?? [];
  const sheetRow = (row) => preview?.sourceRows?.[row - 1] ?? row;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <section
        className="repair-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <p className="section-kicker">Import</p>
            <h2 id="import-dialog-title">นำเข้า{config.noun}จากไฟล์</h2>
          </div>
          <button
            className="button-secondary"
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            ปิด
          </button>
        </div>

        {result ? (
          <div className="import-result">
            <p className="success-message">{result.message}</p>
            <ul>
              <li>สร้างใหม่ {result.created} รายการ</li>
              {result.skipped.length > 0 && (
                <li>
                  ข้าม {result.skipped.length} รายการ เพราะมีรหัสนี้ในระบบอยู่แล้ว
                  {result.skipped.length <= 20 && `: ${result.skipped.join(', ')}`}
                </li>
              )}
              {result.categories_created.length > 0 && (
                <li>สร้างหมวดหมู่ใหม่: {result.categories_created.join(', ')}</li>
              )}
              {result.locations_created?.length > 0 && (
                <li>สร้างสถานที่ใหม่: {result.locations_created.join(', ')}</li>
              )}
            </ul>
            <div className="form-actions">
              <button className="button-primary" type="button" onClick={onClose}>
                เสร็จสิ้น
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="user-note">
              ดาวน์โหลดแม่แบบ Excel ไปกรอก แล้วเลือกไฟล์ที่กรอกเสร็จเพื่อนำเข้า (ครั้งละไม่เกิน 5,000 รายการ)
              รหัสที่มีในระบบอยู่แล้วจะถูกข้าม นำเข้าไฟล์เดิมซ้ำจึงไม่เกิดของซ้ำ {config.note}
            </p>

            <div className="import-template">
              <button
                className="button-secondary"
                type="button"
                onClick={downloadTemplate}
                disabled={downloadingTemplate}
              >
                {downloadingTemplate ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลดแม่แบบ Excel'}
              </button>
              {templateError && <p className="error-message">{templateError}</p>}
            </div>

            <label className="import-file-picker">
              <input
                type="file"
                accept={
                  config.acceptJson
                    ? '.xlsx,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json'
                    : '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
                onChange={chooseFile}
                disabled={mutation.isPending}
              />
              <span className="button-secondary">เลือกไฟล์</span>
              <span className="import-file-name">{fileName || 'ยังไม่ได้เลือกไฟล์'}</span>
            </label>

            {fileError && <p className="error-message">{fileError}</p>}

            {preview && (
              <div className="import-preview">
                <p>
                  <strong>{preview.items.length.toLocaleString('th-TH')}</strong> รายการ
                  {preview.exportedAt &&
                    ` · export เมื่อ ${new Date(preview.exportedAt).toLocaleString('th-TH')}`}
                  {config.withLocations &&
                    (preview.withLocation > 0
                      ? ` · มีสถานที่ ${preview.withLocation} รายการ`
                      : ' · ไม่มีข้อมูลสถานที่ (ไปตั้งตอนตรวจนับได้)')}
                  {preview.returnable > 0 && ` · ต้องคืน ${preview.returnable} รายการ`}
                </p>
                <ul className="import-category-list">
                  {preview.categories.map(([name, count]) => (
                    <li key={name}>
                      {name} <strong>{count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mutation.error && (
              <div className="error-message">
                {mutation.error.message}
                {rowErrors.length > 0 && (
                  <ul className="import-errors">
                    {rowErrors.slice(0, 20).map((rowError) => (
                      <li key={rowError.row}>
                        แถว {sheetRow(rowError.row)}
                        {rowError.code ? ` (${rowError.code})` : ''}: {rowError.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="form-actions">
              <button
                className="button-primary"
                type="button"
                disabled={!preview || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending
                  ? 'กำลังนำเข้า... (อาจใช้เวลาสักครู่)'
                  : preview
                    ? `นำเข้า ${preview.items.length.toLocaleString('th-TH')} รายการ`
                    : 'นำเข้า'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
