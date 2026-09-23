// แปลง ?sort=<key>&dir=asc|desc จาก query string เป็น Prisma orderBy ของรายการที่แบ่งหน้าฝั่ง server
// รับเฉพาะ key ที่อยู่ใน columns (whitelist) ค่าอื่นคืน undefined ให้ repository ใช้ลำดับเริ่มต้นเอง
// ไม่เอาชื่อ field จาก client ไปใส่ orderBy ตรงๆ กันเรียงด้วย field ที่ไม่ได้ตั้งใจเปิดให้เรียง
//
// columns: { key: (dir) => orderBy } เช่น { price: (dir) => ({ price: { sort: dir, nulls: 'last' } }) }
export function parseSort(query, columns) {
  const key = String(query.sort ?? '');
  if (!Object.prototype.hasOwnProperty.call(columns, key)) return undefined;

  const dir = query.dir === 'desc' ? 'desc' : 'asc';
  return columns[key](dir);
}

// ค่าว่าง (ไม่มีราคา/วันหมดอายุ) ไปท้ายเสมอไม่ว่าจะเรียงทางไหน ตรงกับการเรียงฝั่ง client (ListFilters.jsx)
export function nullsLast(field) {
  return (dir) => ({ [field]: { sort: dir, nulls: 'last' } });
}

export function plain(field) {
  return (dir) => ({ [field]: dir });
}
