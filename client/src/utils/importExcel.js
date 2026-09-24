// อ่าน/สร้างไฟล์ Excel สำหรับนำเข้าครุภัณฑ์และวัสดุ (ใช้ใน ImportDialog.jsx)
// แต่ละชนิดมี spec บอกคอลัมน์ (EQUIPMENT_IMPORT / MATERIAL_IMPORT) แถวใน Excel ถูกแปลงเป็น item ที่มี key ตาม spec
// แล้วส่งไป endpoint นำเข้าของชนิดนั้น (ครุภัณฑ์ = รูปแบบเดียวกับไฟล์ JSON ของ server/scripts/export-equipment.js)
// ฝั่งนี้แค่แปลงรูปแบบ (พ.ศ. -> ค.ศ., วันที่ -> YYYY-MM-DD) ส่วนการตรวจข้อมูลรายแถวให้ server ทำที่เดียว
// exceljs ใหญ่ จึงโหลดตอนกดใช้จริงเท่านั้น (dynamic import) ไม่ให้หน้าอื่นช้าตาม

const BUDDHIST_ERA_OFFSET = 543;
const OPTIONS_SHEET_NAME = 'ตัวเลือก';
const MAX_ROWS = 5000; // ตรงกับ MAX_IMPORT_ROWS ของ server

// column: key = ชื่อ field ที่ส่งให้ server, label = หัวตาราง (ห้ามซ้ำกัน เพราะตอนอ่านจับคู่คอลัมน์ด้วยหัวตาราง
// ผู้ใช้จึงสลับคอลัมน์ได้), type = วิธีแปลงค่า (date/year/number ไม่ระบุ = ข้อความ),
// text = ตั้งเซลล์ในแม่แบบเป็นข้อความ ไม่ให้ Excel ตัดเลข 0 นำหน้าหรือแปลงวันที่เอง,
// options = ชื่อชุดตัวเลือก (ส่งมาตอนสร้างแม่แบบ) ใช้ทำ dropdown ที่ยังพิมพ์ค่าใหม่เองได้
const DATE_HOW = 'วว/ดด/ปปปป (พ.ศ. หรือ ค.ศ. ก็ได้)';

export const EQUIPMENT_IMPORT = {
  sheetName: 'ครุภัณฑ์',
  fileName: 'แม่แบบนำเข้าครุภัณฑ์.xlsx',
  columns: [
    { key: 'equipment_code', label: 'รหัสครุภัณฑ์', required: true, width: 22, text: true, how: 'ห้ามซ้ำกัน รหัสที่มีในระบบอยู่แล้วจะถูกข้าม', example: 'PC-2569-001' },
    { key: 'equipment_name', label: 'ชื่อครุภัณฑ์', required: true, width: 30, example: 'คอมพิวเตอร์ตั้งโต๊ะ' },
    { key: 'category_name', label: 'หมวดหมู่', required: true, width: 22, options: 'categories', how: 'เลือกจากรายการ หรือพิมพ์ชื่อใหม่ (ระบบสร้างหมวดหมู่ให้)', example: 'คอมพิวเตอร์' },
    { key: 'description', label: 'รายละเอียด', required: true, width: 40, example: 'Dell OptiPlex 7010' },
    { key: 'remark', label: 'คุณสมบัติ', width: 30, example: 'CPU i5 / RAM 16GB' },
    { key: 'fiscal_year', label: 'ปีงบประมาณ (พ.ศ.)', width: 18, type: 'year', aliases: ['ปีงบประมาณ'], how: 'ปี พ.ศ. 4 หลัก', example: '2569' },
    { key: 'price', label: 'ราคา', width: 14, type: 'number', how: 'ตัวเลข ไม่ต้องใส่หน่วย', example: '25000' },
    { key: 'receive_date', label: 'วันที่รับ', width: 16, text: true, type: 'date', how: DATE_HOW, example: '15/03/2569' },
    { key: 'warranty_expire', label: 'วันหมดประกัน', width: 16, text: true, type: 'date', how: DATE_HOW, example: '15/03/2572' },
    { key: 'location_name', label: 'สถานที่', width: 24, options: 'locations', how: 'เลือกจากรายการ หรือพิมพ์ชื่อใหม่ (ระบบสร้างสถานที่ให้) เว้นว่างได้', example: 'ห้องปฏิบัติการคอมพิวเตอร์' },
    { key: 'location_building', label: 'อาคาร', width: 18, how: 'ใส่ได้เมื่อมีสถานที่', example: 'อาคาร 1' },
    { key: 'location_room', label: 'ห้อง', width: 12, text: true, how: 'ใส่ได้เมื่อมีสถานที่ ชื่อสถานที่เดียวกันคนละห้องถือเป็นคนละสถานที่', example: '101' },
  ],
  notes: ['ของที่นำเข้าจะมีสถานะ "พร้อมใช้งาน" ทั้งหมด'],
};

export const MATERIAL_IMPORT = {
  sheetName: 'วัสดุ',
  fileName: 'แม่แบบนำเข้าวัสดุ.xlsx',
  columns: [
    { key: 'material_code', label: 'รหัสวัสดุ', required: true, width: 20, text: true, how: 'ห้ามซ้ำกัน รหัสที่มีในระบบอยู่แล้วจะถูกข้าม', example: 'MT-001' },
    { key: 'material_name', label: 'ชื่อวัสดุ', required: true, width: 30, example: 'กระดาษ A4 80 แกรม' },
    { key: 'category_name', label: 'หมวดหมู่', required: true, width: 22, options: 'categories', how: 'เลือกจากรายการ หรือพิมพ์ชื่อใหม่ (ระบบสร้างหมวดหมู่ให้)', example: 'วัสดุสำนักงาน' },
    { key: 'unit_name', label: 'หน่วยนับ', required: true, width: 14, example: 'รีม' },
    { key: 'quantity', label: 'จำนวนคงเหลือ', width: 16, type: 'number', how: 'จำนวนเต็ม เว้นว่าง = 0', example: '50' },
    { key: 'minimum_quantity', label: 'จำนวนขั้นต่ำ', width: 16, type: 'number', how: 'แจ้งเตือนเมื่อคงเหลือไม่เกินจำนวนนี้ เว้นว่าง = 0', example: '10' },
    { key: 'unit_price', label: 'ราคาต่อหน่วย', width: 16, type: 'number', how: 'ตัวเลข ไม่ต้องใส่หน่วย', example: '120' },
    { key: 'expire_date', label: 'วันหมดอายุ', width: 16, text: true, type: 'date', how: DATE_HOW, example: '31/12/2570' },
    { key: 'remark', label: 'หมายเหตุ', width: 30, example: '' },
  ],
  notes: ['รหัสที่มีอยู่แล้วจะถูกข้ามทั้งแถว จำนวนไม่ถูกบวกเพิ่ม ถ้าจะรับของเข้าสต๊อกให้แก้จำนวนที่รายการนั้นในระบบ'],
};

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/[*\s]/g, '')
    .toLowerCase();
}

// รับได้ทั้งหัวตารางภาษาไทยตามแม่แบบ ชื่อเรียกอื่น และชื่อ field ภาษาอังกฤษ
function headerMap(spec) {
  return new Map(
    spec.columns.flatMap((column) =>
      [column.label, column.key, ...(column.aliases ?? [])].map((name) => [
        normalizeHeader(name),
        column.key,
      ]),
    ),
  );
}

async function loadExcelJS() {
  const module = await import('exceljs');
  return module.default ?? module;
}

// ค่าในเซลล์ของ exceljs มีหลายรูป (ข้อความ, ตัวเลข, Date, rich text, hyperlink, สูตร) ทำให้เหลือค่าธรรมดา
function cellValue(value) {
  if (value == null) return null;
  if (value instanceof Date || typeof value !== 'object') return value;
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('');
  if ('result' in value) return cellValue(value.result);
  if ('text' in value) return cellValue(value.text);
  return null;
}

function isBlank(value) {
  return value == null || String(value).trim() === '';
}

function pad(number) {
  return String(number).padStart(2, '0');
}

function toCommonEraYear(year) {
  return year > 2400 ? year - BUDDHIST_ERA_OFFSET : year;
}

function formatDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? `${year}-${pad(month)}-${pad(day)}` : null;
}

// รับเซลล์วันที่ของ Excel หรือข้อความ วว/ดด/ปปปป, ปปปป-ดด-วว (ปีเป็น พ.ศ. หรือ ค.ศ. ก็ได้)
// แปลงไม่ได้ส่งค่าเดิมไป ให้ server ตอบกลับว่าแถวไหนวันที่ไม่ถูกต้อง
function toDateString(value) {
  if (isBlank(value)) return null;

  // วันที่ที่วางลงช่องซึ่งตั้งรูปแบบเป็นข้อความ/ทั่วไป อ่านได้เป็นเลขลำดับวันของ Excel (1 = 1 ม.ค. 1900)
  if (typeof value === 'number' && Number.isInteger(value) && value > 0 && value < 2958466) {
    value = new Date((value - 25569) * 86400000);
  }

  if (value instanceof Date) {
    // exceljs อ่านวันที่เป็นเวลา UTC เที่ยงคืน จึงใช้ getUTC* (ถ้าพิมพ์ปี พ.ศ. ลงเซลล์วันที่ Excel ก็เก็บเป็นปี 25xx)
    return formatDate(
      toCommonEraYear(value.getUTCFullYear()),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
    );
  }

  const text = String(value).trim();
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    return formatDate(toCommonEraYear(Number(match[1])), Number(match[2]), Number(match[3])) ?? text;
  }

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) {
    return formatDate(toCommonEraYear(Number(match[3])), Number(match[2]), Number(match[1])) ?? text;
  }

  return text;
}

function toYear(value) {
  if (isBlank(value)) return null;
  const year = Number(String(value).trim());
  return Number.isInteger(year) ? toCommonEraYear(year) : String(value).trim();
}

function toNumber(value) {
  if (isBlank(value)) return null;
  if (typeof value === 'number') return value;
  return String(value).replace(/[,\s฿]/g, '');
}

function toText(value) {
  if (isBlank(value)) return null;
  return String(value).trim();
}

const CONVERTERS = { date: toDateString, year: toYear, number: toNumber };

// หาแถวหัวตารางในสิบแถวแรก (เผื่อผู้ใช้เพิ่มหัวเรื่องไว้ด้านบน) ต้องเจอหัวตารางของคอลัมน์ที่บังคับกรอกครบ
function findHeader(worksheet, spec) {
  const headers = headerMap(spec);
  const requiredKeys = spec.columns.filter((column) => column.required).map((column) => column.key);
  const lastRow = Math.min(worksheet.rowCount, 10);

  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber += 1) {
    const columnKeys = new Map();
    worksheet.getRow(rowNumber).eachCell((cell, columnNumber) => {
      const key = headers.get(normalizeHeader(cellValue(cell.value)));
      if (key && ![...columnKeys.values()].includes(key)) columnKeys.set(columnNumber, key);
    });

    const keys = [...columnKeys.values()];
    if (requiredKeys.every((key) => keys.includes(key))) {
      return { rowNumber, columnKeys };
    }
  }

  return null;
}

// คืน { items, sourceRows } sourceRows[i] = เลขแถวใน Excel ของ items[i] ใช้แปลงเลขแถวที่ server บอกว่าผิด
export async function readImportExcel(file, spec) {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error('อ่านไฟล์ Excel ไม่ได้ ต้องเป็นไฟล์ .xlsx (ถ้าเป็น .xls ให้เปิดแล้วบันทึกเป็น .xlsx ก่อน)');
  }

  const worksheet = workbook.getWorksheet(spec.sheetName) ?? workbook.worksheets[0];
  const header = worksheet && findHeader(worksheet, spec);
  if (!header) {
    const required = spec.columns
      .filter((column) => column.required)
      .map((column) => `"${column.label}"`)
      .join(', ');
    throw new Error(`ไม่พบหัวตาราง ${required} ครบในไฟล์ กรุณาใช้แม่แบบของระบบ`);
  }

  const items = [];
  const sourceRows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= header.rowNumber) return;

    const raw = {};
    for (const [columnNumber, key] of header.columnKeys) {
      raw[key] = cellValue(row.getCell(columnNumber).value);
    }
    // แถวว่าง (หรือมีแค่รูปแบบเซลล์ค้างไว้) ข้ามไป ไม่นับเป็นแถวที่ผิด
    if (Object.values(raw).every(isBlank)) return;

    const item = {};
    for (const column of spec.columns) {
      const convert = CONVERTERS[column.type] ?? toText;
      item[column.key] = convert(raw[column.key]);
    }

    items.push(item);
    sourceRows.push(rowNumber);
  });

  return { items, sourceRows };
}

// แม่แบบว่างให้ดาวน์โหลดไปกรอก: ชีตข้อมูล + ชีตวิธีกรอก + ชีตตัวเลือก (ซ่อน) สำหรับ dropdown
// options = { categories: ['ชื่อ', ...], locations: [...] } dropdown แค่ช่วยเลือกชื่อที่มีอยู่ พิมพ์ชื่อใหม่ได้
// (ตอนนำเข้า server สร้างหมวดหมู่/สถานที่ใหม่ให้)
export async function downloadImportTemplate(spec, options = {}) {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet(spec.sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = spec.columns.map((column) => ({
    header: column.required ? `${column.label} *` : column.label,
    key: column.key,
    width: column.width,
    style: column.text ? { numFmt: '@' } : undefined,
  }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 22;
  spec.columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.font = { bold: true, color: { argb: column.required ? 'FF9D174D' : 'FF333333' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: column.required ? 'FFFCE7EF' : 'FFF3F4F6' },
    };
    cell.alignment = { vertical: 'middle' };
  });

  const listColumns = spec.columns.filter((column) => column.options);
  if (listColumns.length > 0) {
    const optionsSheet = workbook.addWorksheet(OPTIONS_SHEET_NAME, { state: 'hidden' });

    listColumns.forEach((column, index) => {
      const names = [...new Set(options[column.options] ?? [])].filter(Boolean);
      const optionsColumn = optionsSheet.getColumn(index + 1);
      optionsColumn.values = [column.label, ...names];
      if (names.length === 0) return;

      const letter = sheet.getColumn(column.key).letter;
      sheet.dataValidations.add(`${letter}2:${letter}${MAX_ROWS + 1}`, {
        type: 'list',
        allowBlank: true,
        formulae: [
          `'${OPTIONS_SHEET_NAME}'!$${optionsColumn.letter}$2:$${optionsColumn.letter}$${names.length + 1}`,
        ],
        showErrorMessage: false,
      });
    });
  }

  const guide = workbook.addWorksheet('วิธีกรอก');
  guide.columns = [
    { header: 'คอลัมน์', key: 'column', width: 22 },
    { header: 'จำเป็น', key: 'required', width: 10 },
    { header: 'วิธีกรอก', key: 'how', width: 60 },
    { header: 'ตัวอย่าง', key: 'example', width: 28 },
  ];
  guide.getRow(1).font = { bold: true };
  guide.addRows(
    spec.columns.map((column) => ({
      column: column.label,
      required: column.required ? 'ใช่' : '',
      how: column.how ?? '',
      example: column.example ?? '',
    })),
  );
  guide.addRow([]);
  guide.addRow(['หมายเหตุ']).font = { bold: true };
  guide.addRow([`กรอกในชีต "${spec.sheetName}" ครั้งละไม่เกิน ${MAX_ROWS.toLocaleString('th-TH')} แถว ห้ามแก้หัวตาราง`]);
  guide.addRow(['ถ้ามีแถวที่ผิด ระบบจะไม่นำเข้าเลยสักแถวและบอกเลขแถวที่ต้องแก้ แก้แล้วนำเข้าไฟล์เดิมซ้ำได้']);
  for (const note of spec.notes ?? []) guide.addRow([note]);
  guide.getColumn('how').alignment = { wrapText: true, vertical: 'top' };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = spec.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
