import { SortableTh } from '../../../components/ListFilters.jsx';

// คอลัมน์ที่คลิกเรียงได้ (เรียงฝั่ง client ใน Dashboard.jsx เพราะรายชื่อผู้ใช้โหลดมาครบ) สิทธิ์ไม่ต้องเรียง มีแค่ 2 ค่า
export const userSortColumns = {
  name: { label: 'ชื่อ', type: 'text', get: (user) => user.name },
  email: { label: 'อีเมล', type: 'text', get: (user) => user.email, dirLabels: { asc: 'A→Z', desc: 'Z→A' } },
};

// ตารางนี้รับข้อมูลผ่าน props เท่านั้น การเรียก API เปลี่ยน role อยู่ใน App.jsx
export default function UserTable({
  users,
  currentUserId,
  updatingUserId,
  onUpdateRole,
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
          </tr>
        </thead>
        <tbody>
          {users.map((item) => (
            <tr key={item.user_id}>
              <td data-label="ชื่อ">{item.name}</td>
              <td data-label="อีเมล">{item.email}</td>
              <td data-label="สิทธิ์">
                <select
                  value={item.role}
                  disabled={
                    // ห้าม Admin ลดสิทธิ์ตัวเอง และล็อกแถวระหว่างรอ API
                    item.user_id === currentUserId ||
                    updatingUserId === item.user_id
                  }
                  onChange={(event) =>
                    onUpdateRole(item.user_id, event.target.value)
                  }
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
