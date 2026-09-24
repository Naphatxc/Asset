import ItemThumbnail from '../../../components/ItemThumbnail.jsx';
import { SortableTh } from '../../../components/ListFilters.jsx';

// คอลัมน์ที่คลิกเรียงได้ key ต้องตรงกับ sortColumns ใน equipment.controller.js (เรียงที่ server)
// หมวดหมู่/สถานที่/สถานะมีตัวกรองอยู่แล้ว ไม่ต้องเรียง
export const equipmentSortColumns = {
  code: { label: 'รหัส', type: 'text', dirLabels: { asc: 'A→Z', desc: 'Z→A' } },
  name: { label: 'ชื่อครุภัณฑ์', type: 'text' },
  price: { label: 'ราคา', type: 'number' },
};

// ค่าฝั่ง API คงเป็นภาษาอังกฤษ ส่วนข้อความบน UI แปลที่จุดเดียวตรงนี้
const statusLabels = {
  available: 'พร้อมใช้งาน',
  borrowed: 'ถูกยืม',
  pending_repair: 'รอซ่อม',
  repairing: 'กำลังซ่อม',
  damaged: 'ชำรุด',
  disposed: 'จำหน่ายออก',
};

// dropdown เปลี่ยนสถานะไม่มี "จำหน่ายออก" — ต้องกดปุ่มจำหน่ายออกเท่านั้น (server ตั้ง deleted_at ไปพร้อมกัน)
const editableStatuses = Object.entries(statusLabels).filter(([value]) => value !== 'disposed');

// MySQL ส่ง DECIMAL เป็น string จึงแปลงเป็น number ก่อนจัดรูปแบบเงินบาท
function formatPrice(price) {
  if (price === null || price === undefined || price === '') {
    return '-';
  }

  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2,
  }).format(Number(price));
}

// เวลาที่กดจำหน่ายออก (deleted_at) — locale th-TH ใช้ปฏิทินพุทธ จึงได้ปี พ.ศ. เอง เช่น "24 ก.ย. 2569 14:30"
function formatDisposedAt(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

// รวมชื่อสถานที่ อาคาร และห้องให้เป็นข้อความหนึ่งช่องในตาราง
function formatLocation(item) {
  const room = item.room ? `ห้อง ${item.room}` : '';
  const parts = [item.location_name, item.building, room].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'ยังไม่ระบุสถานที่';
}

export default function EquipmentTable({
  equipment,
  admin = false,
  mode = 'active',
  busyItemId,
  confirmingDeleteId,
  onViewDetails,
  onShowQr,
  onEdit,
  onStatusChange,
  locationOptions = [],
  onLocationChange,
  onHistory,
  onDelete,
  onCancelDelete,
  onRestore,
  sort,
  onSortChange,
}) {
  // Component นี้รองรับทั้งรายการปัจจุบันและรายการที่ถูก Soft Delete
  if (equipment.length === 0) {
    return (
      <div className="empty-state">
        <p>
          {mode === 'deleted'
            ? 'ไม่มีครุภัณฑ์ที่จำหน่ายออก'
            : 'ยังไม่มีรายการครุภัณฑ์'}
        </p>
      </div>
    );
  }

  const sortProps = { sortColumns: equipmentSortColumns, sort, onSortChange };

  return (
    <div className="table-wrap">
      <table className="equipment-table responsive-table">
        <thead>
          <tr>
            <th>รูป</th>
            <SortableTh sortKey="code" {...sortProps}>รหัส</SortableTh>
            <SortableTh sortKey="name" {...sortProps}>ชื่อครุภัณฑ์</SortableTh>
            <th>หมวดหมู่</th>
            <th>สถานที่</th>
            <SortableTh sortKey="price" {...sortProps}>ราคา</SortableTh>
            <th>สถานะ</th>
            {mode === 'deleted' && <th>จำหน่ายออกเมื่อ</th>}
            {mode === 'active' && <th>ข้อมูลและ QR</th>}
            {admin && <th>จัดการ</th>}
          </tr>
        </thead>
        <tbody>
          {equipment.map((item) => {
            // busy ใช้ปิดปุ่มของแถวที่กำลังรอ API ป้องกันการกดซ้ำ
            const busy = busyItemId === item.item_id;
            const confirming = confirmingDeleteId === item.item_id;

            return (
              <tr key={item.item_id}>
                <td className="cell-thumbnail" data-label="รูป">
                  <ItemThumbnail imageUrl={item.image_url} alt={item.equipment_name} />
                </td>
                <td data-label="รหัส">
                  <span className="equipment-code">
                    {item.equipment_code}
                  </span>
                </td>
                <td data-label="ชื่อครุภัณฑ์">{item.equipment_name}</td>
                <td data-label="หมวดหมู่">{item.category_name}</td>
                <td data-label="สถานที่">
                  {admin && mode === 'active' ? (
                    // Admin เปลี่ยนสถานที่ได้ในตารางเลย ไม่ต้องเปิดฟอร์มแก้ไขทั้งหน้า
                    <select
                      className="status-select"
                      value={item.location_id ? String(item.location_id) : ''}
                      disabled={busy}
                      onChange={(event) =>
                        onLocationChange(item, event.target.value)
                      }
                    >
                      <option value="">ยังไม่ระบุสถานที่</option>
                      {locationOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    formatLocation(item)
                  )}
                </td>
                <td className="cell-number" data-label="ราคา">{formatPrice(item.price)}</td>
                <td data-label="สถานะ">
                  {admin && mode === 'active' ? (
                    // Admin เปลี่ยนสถานะได้ ส่วน User เห็นเป็น badge อย่างเดียว
                    <select
                      className="status-select"
                      value={item.status}
                      disabled={busy}
                      onChange={(event) =>
                        onStatusChange(item, event.target.value)
                      }
                    >
                      {editableStatuses.map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  ) : (
                    <span
                      className={`status-badge status-${item.status}`}
                    >
                      {statusLabels[item.status] ?? item.status}
                    </span>
                  )}
                </td>
                {mode === 'deleted' && (
                  <td data-label="จำหน่ายออกเมื่อ">{formatDisposedAt(item.deleted_at)}</td>
                )}

                {mode === 'active' && (
                  <td className="stack-actions">
                    <div className="row-actions qr-row-actions">
                      <button
                        type="button"
                        onClick={() => onViewDetails(item)}
                        disabled={busy}
                      >
                        รายละเอียด
                      </button>
                      {admin && (
                        <button
                          type="button"
                          onClick={() => onShowQr(item)}
                          disabled={busy}
                        >
                          QR Code
                        </button>
                      )}
                    </div>
                  </td>
                )}

                {admin && (
                  <td className="stack-actions">
                    <div className="row-actions">
                      {mode === 'active' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            disabled={busy}
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => onHistory(item)}
                            disabled={busy}
                          >
                            ประวัติ
                          </button>
                          <button
                            className="button-danger"
                            type="button"
                            onClick={() => onDelete(item)}
                            disabled={busy}
                          >
                            {/* ต้องกดสองครั้ง จึงลดโอกาสกดพลาด */}
                            {confirming ? 'ยืนยันจำหน่ายออก' : 'จำหน่ายออก'}
                          </button>
                          {confirming && (
                            <button
                              type="button"
                              onClick={onCancelDelete}
                            >
                              ยกเลิก
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onHistory(item)}
                            disabled={busy}
                          >
                            ประวัติ
                          </button>
                          <button
                            className="button-restore"
                            type="button"
                            onClick={() => onRestore(item)}
                            disabled={busy}
                          >
                            กู้คืน
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
