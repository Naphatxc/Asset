// ตารางนี้รับข้อมูลผ่าน props เท่านั้น การเรียก API เปลี่ยน role อยู่ใน App.jsx
export default function UserTable({
  users,
  currentUserId,
  updatingUserId,
  onUpdateRole,
}) {
  return (
    <div className="table-wrap">
      <table className="user-table">
        <thead>
          <tr>
            <th>ชื่อ</th>
            <th>อีเมล</th>
            <th>สิทธิ์</th>
          </tr>
        </thead>
        <tbody>
          {users.map((item) => (
            <tr key={item.user_id}>
              <td>{item.name}</td>
              <td>{item.email}</td>
              <td>
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
