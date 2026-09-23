// แปลงชื่อ action จากฐานข้อมูลให้เป็นข้อความที่ผู้ใช้อ่านเข้าใจ
const actionLabels = {
  created: 'เพิ่มครุภัณฑ์',
  updated: 'แก้ไขข้อมูล',
  status_changed: 'เปลี่ยนสถานะ',
  deleted: 'จำหน่ายออก',
  restored: 'กู้คืนครุภัณฑ์',
};

// วันเวลาจาก MySQL ถูกจัดรูปแบบตามภาษาไทยก่อนแสดง
function formatDateTime(value) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value.replace(' ', 'T')));
}

// Snapshot เป็น JSON ของข้อมูลก่อน/หลัง จัดย่อหน้าให้อ่านง่ายใน <pre>
function formatSnapshot(snapshot) {
  if (!snapshot) return '-';

  return JSON.stringify(snapshot, null, 2);
}



export default function EquipmentHistory({
  equipment,
  history,
  loading,
  onClose,
}) {
  // History เป็น read-only ผู้ใช้เปิดดูรายละเอียดแต่แก้ไขไม่ได้
  return (
    <section className="history-panel">
      <div className="form-heading">
        <div>
          <p className="section-kicker">Audit history</p>
          <h3>ประวัติ {equipment.equipment_code}</h3>
        </div>
        <button
          className="button-secondary"
          type="button"
          onClick={onClose}
        >
          ปิด
        </button>
      </div>

      {loading ? (
        <p className="loading-message">กำลังโหลดประวัติ...</p>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <p>ยังไม่มีประวัติของครุภัณฑ์รายการนี้</p>
        </div>
      ) : (
        <ol className="history-list">
          {history.map((entry) => (
            <li key={entry.history_id}>
              <div className="history-summary">
                <div>
                  <strong>
                    {actionLabels[entry.action] ?? entry.action}
                  </strong>
                  <span>
                    โดย {entry.changed_by_name ?? 'ระบบ'}
                  </span>
                </div>
                <time>{formatDateTime(entry.created_at)}</time>
              </div>

              <details>
                <summary>ดูข้อมูลก่อนและหลัง</summary>
                <div className="history-snapshots">
                  <div>
                    <h4>ข้อมูลเดิม</h4>
                    <pre>{formatSnapshot(entry.old_data)}</pre>
                  </div>
                  <div>
                    <h4>ข้อมูลใหม่</h4>
                    <pre>{formatSnapshot(entry.new_data)}</pre>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
