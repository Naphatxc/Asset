import { SortableTh } from '../../../components/ListFilters.jsx';

// คอลัมน์ที่คลิกเรียงได้ (เรียงฝั่ง client ใน Dashboard.jsx เพราะรายชื่อผู้ใช้โหลดมาครบ) สิทธิ์ไม่ต้องเรียง มีแค่ 2 ค่า
export const userSortColumns = {
  name: { label: 'ชื่อ', type: 'text', get: (user) => user.name },
  email: { label: 'อีเมล', type: 'text', get: (user) => user.email, dirLabels: { asc: 'A→Z', desc: 'Z→A' } },
};

// ตารางนี้รับข้อมูลผ่าน props เท่านั้น การเรียก API เปลี่ยน role/ลบผู้ใช้อยู่ใน Dashboard.jsx
export default function UserTable({
  users,
  currentUserId,
  updatingUserId,
  onUpdateRole,
  confirmingDeleteId,
  deletingUserId,
  onDelete,
  onCancelDelete,
  sort,
  onSortChange,
}) {
  const sortProps = { sortColumns: userSortColumns, sort, onSortChange };

  return (
    <div className="table-wrap">
      <table className="user-table responsive-table">
        <thead>
          <tr>
            <SortableTh sortKey="name" {...sortProps}>ชื่อ</SortableTh>
            <SortableTh sortKey="email" {...sortProps}>อีเมล</SortableTh>
            <th>สิทธิ์</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {users.map((item) => {
            const self = item.user_id === currentUserId;
            const busy = updatingUserId === item.user_id || deletingUserId === item.user_id;
            const confirming = confirmingDeleteId === item.user_id;

            return (
              <tr key={item.user_id}>
                <td data-label="ชื่อ">{item.name}</td>
                <td data-label="อีเมล">{item.email}</td>
                <td data-label="สิทธิ์">
                  <select
                    value={item.role}
                    // ห้าม Admin ลดสิทธิ์ตัวเอง และล็อกแถวระหว่างรอ API
                    disabled={self || busy}
                    onChange={(event) =>
                      onUpdateRole(item.user_id, event.target.value)
                    }
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="stack-actions" data-label="จัดการ">
                  {/* ห้ามลบบัญชีตัวเอง (server ก็กันไว้อีกชั้น) */}
                  {!self && (
                    <div className="row-actions">
                      <button
                        className="button-danger"
                        type="button"
                        onClick={() => onDelete(item)}
                        disabled={busy}
                      >
                        {/* ต้องกดสองครั้ง จึงลดโอกาสกดพลาด */}
                        {deletingUserId === item.user_id
                          ? 'กำลังลบ...'
                          : confirming
                            ? 'ยืนยันลบ'
                            : 'ลบ'}
                      </button>
                      {confirming && !busy && (
                        <button type="button" onClick={onCancelDelete}>
                          ยกเลิก
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
