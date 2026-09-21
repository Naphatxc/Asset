// ค่าฝั่ง API คงเป็นภาษาอังกฤษ ส่วนข้อความบน UI แปลที่จุดเดียวตรงนี้
const statusLabels = {
  available: 'พร้อมใช้งาน',
  borrowed: 'ถูกยืม',
  pending_repair: 'รอซ่อม',
  repairing: 'กำลังซ่อม',
};

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
}) {
  // Component นี้รองรับทั้งรายการปัจจุบันและรายการที่ถูก Soft Delete
  if (equipment.length === 0) {
    return (
      <div className="empty-state">
        <p>
          {mode === 'deleted'
            ? 'ไม่มีครุภัณฑ์ที่ถูกลบ'
            : 'ยังไม่มีรายการครุภัณฑ์'}
        </p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="equipment-table responsive-table">
        <thead>
          <tr>
            <th>รหัส</th>
            <th>ชื่อครุภัณฑ์</th>
            <th>หมวดหมู่</th>
            <th>สถานที่</th>
            <th>ราคา</th>
            <th>สถานะ</th>
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
                <td data-label="ราคา">{formatPrice(item.price)}</td>
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
                      {Object.entries(statusLabels).map(
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
                            {/* ต้องกดลบสองครั้ง จึงลดโอกาสกดพลาด */}
                            {confirming ? 'ยืนยันลบ' : 'ลบ'}
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
