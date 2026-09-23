// แถวตัวกรองเหนือตาราง (ช่องค้นหา + เลือกสถานะ) หน้าตาเดียวกับแท็บครุภัณฑ์ ใช้ในแท็บยืม-คืน/แจ้งซ่อม
// กรองและเรียงฝั่ง client ทั้งหมด เพราะรายการเหล่านี้ server ส่งมาครบอยู่แล้ว (แบ่งหน้าฝั่ง client ด้วย paginateRows)
//
// การเรียง: คลิกหัวคอลัมน์ (SortableTh) สลับ น้อย→มาก / มาก→น้อย ส่วนโหมดการ์ด (จอแคบ) ไม่มีหัวตารางให้กด
// จึงมีช่องเลือกเรียงลำดับแทน ซึ่ง CSS แสดงเฉพาะตอนเป็นการ์ด (.sort-select-cards)
//
// sortColumns: { key: { label, type: 'date' | 'number' | 'text', get?: (row) => value, dirLabels?, firstDir? } }
//   get ใช้เฉพาะตอนเรียงฝั่ง client (sortRows) ตารางที่แบ่งหน้าฝั่ง server ส่ง key ไปให้ server เรียงแทน
// sort: { key, dir: 'asc' | 'desc' } — key เป็น null = ลำดับเริ่มต้นของ server ยังไม่ได้เลือกคอลัมน์

// ค้นหาแบบไม่สนตัวพิมพ์เล็ก/ใหญ่ ใน field ไหนก็ได้ที่ส่งมา (field ที่เป็น null ข้ามไป)
export function matchesSearch(query, ...fields) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return fields.some((field) => String(field ?? '').toLowerCase().includes(normalized));
}

function compareValues(type, left, right) {
  if (type === 'date') {
    return new Date(left).getTime() - new Date(right).getTime();
  }
  if (type === 'number') return Number(left) - Number(right);
  // เรียงแบบภาษาไทย ก–ฮ และนับเลขในข้อความเป็นตัวเลข (PC-2 มาก่อน PC-010)
  return String(left).localeCompare(String(right), 'th', { numeric: true });
}

// คืนรายการใหม่ ไม่แก้ array เดิม ค่าว่างไปท้ายเสมอไม่ว่าจะเรียงทางไหน
export function sortRows(rows, sortColumns, sort) {
  const column = sortColumns[sort.key];
  if (!column) return rows;

  const direction = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = column.get(a);
    const right = column.get(b);
    const leftEmpty = left == null || left === '';
    const rightEmpty = right == null || right === '';
    if (leftEmpty || rightEmpty) return Number(leftEmpty) - Number(rightEmpty);
    return compareValues(column.type, left, right) * direction;
  });
}

// ทิศที่ได้เมื่อคลิกคอลัมน์ครั้งแรก: วันที่เริ่มจากใหม่→เก่า (ที่คนดูบ่อยสุด) ข้อความเริ่มจาก ก→ฮ
// คอลัมน์กำหนดเองได้ด้วย firstDir เช่น กำหนดคืนเริ่มจากใกล้→ไกล จะได้เห็นของที่ใกล้ถึงกำหนดก่อน
function firstDirection(column) {
  return column.firstDir ?? (column.type === 'date' ? 'desc' : 'asc');
}

// คลิกคอลัมน์ใหม่ได้ทิศแรกของคอลัมน์นั้น คลิกซ้ำสลับทิศ
export function nextSort(sortColumns, sort, key) {
  if (sort.key === key) return { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' };
  return { key, dir: firstDirection(sortColumns[key]) };
}

// คำอธิบายทิศในช่องเลือก (โหมดการ์ด) คอลัมน์กำหนดเองได้ด้วย dirLabels: { asc, desc } เช่น กำหนดคืน ใกล้→ไกล
function directionLabel(column, dir) {
  if (column.dirLabels) return column.dirLabels[dir];
  if (column.type === 'date') return dir === 'desc' ? 'ใหม่→เก่า' : 'เก่า→ใหม่';
  if (column.type === 'number') return dir === 'asc' ? 'น้อย→มาก' : 'มาก→น้อย';
  return dir === 'asc' ? 'ก→ฮ' : 'ฮ→ก';
}

// หัวคอลัมน์ที่คลิกเรียงได้ แสดง ▲/▼ ตามทิศที่เรียงอยู่ คอลัมน์ที่ยังไม่ได้เลือกแสดงลูกศรจางๆ ให้รู้ว่ากดได้
export function SortableTh({ sortKey, sortColumns, sort, onSortChange, children }) {
  const active = sort.key === sortKey;
  const ascending = sort.dir === 'asc';

  return (
    <th aria-sort={active ? (ascending ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={active ? 'sort-header active' : 'sort-header'}
        onClick={() => onSortChange(nextSort(sortColumns, sort, sortKey))}
      >
        {children}
        <span className="sort-arrow" aria-hidden="true">
          {active ? (ascending ? '▲' : '▼') : '▲▼'}
        </span>
      </button>
    </th>
  );
}

export default function ListFilters({
  search,
  onSearchChange,
  searchPlaceholder,
  status,
  onStatusChange,
  statusLabels, // { value: label } — แสดงตามลำดับ key พร้อมตัวเลือก "ทุกสถานะ" ด้านบน
  sort,
  onSortChange,
  sortColumns, // ไม่ส่งมา = ไม่มีช่องเรียงลำดับในโหมดการ์ด
}) {
  return (
    <div className="equipment-filters">
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
      />
      <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
        <option value="">ทุกสถานะ</option>
        {Object.entries(statusLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {sortColumns && (
        <SortSelect sortColumns={sortColumns} sort={sort} onSortChange={onSortChange} />
      )}
    </div>
  );
}

// ช่องเลือกเรียงลำดับสำหรับโหมดการ์ด ใส่ในแถวตัวกรองไหนก็ได้ (CSS ซ่อนไว้ตอนเป็นตาราง)
// defaultLabel: ใช้กับตารางที่ค่าเริ่มต้นคือลำดับของ server (sort.key เป็น null) เช่น "ล่าสุดที่เพิ่ม"
export function SortSelect({ sortColumns, sort, onSortChange, defaultLabel }) {
  return (
    <select
      className="sort-select-cards"
      value={sort.key ? `${sort.key}:${sort.dir}` : ''}
      onChange={(event) => {
        const [key, dir] = event.target.value.split(':');
        onSortChange(key ? { key, dir } : { key: null, dir: null });
      }}
      aria-label="เรียงตาม"
    >
      {defaultLabel && <option value="">{defaultLabel}</option>}
      {Object.entries(sortColumns).flatMap(([key, column]) =>
        (firstDirection(column) === 'desc' ? ['desc', 'asc'] : ['asc', 'desc']).map((dir) => (
          <option key={`${key}:${dir}`} value={`${key}:${dir}`}>
            {column.label} {directionLabel(column, dir)}
          </option>
        )),
      )}
    </select>
  );
}
