// จัดการห้องจอง (Admin เท่านั้น) — เพิ่มห้อง, แก้ชื่อ, เปิด/ปิดให้จอง ไม่มีปุ่มลบ เพราะห้องที่เคยถูกจองต้องอ้างอิงจากประวัติได้
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { createRoom, getAllRooms, updateRoom } from '../../../api/rooms.js';
import { useToast } from '../../../components/ToastProvider.jsx';

export default function RoomManager() {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  const [roomName, setRoomName] = useState('');
  // ห้องที่กำลังแก้ชื่อ (null = ไม่มี) กับชื่อที่พิมพ์อยู่
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const roomsQuery = useQuery({
    queryKey: ['admin-rooms'],
    queryFn: getAllRooms,
  });
  const rooms = roomsQuery.data?.rooms ?? [];

  // ห้องเปลี่ยนแล้วต้องโหลดใหม่ 3 ที่: ตารางนี้, ดรอปดาวน์ในฟอร์มจอง และตารางการจอง (แสดงชื่อห้อง)
  function refreshRooms() {
    queryClient.invalidateQueries({ queryKey: ['admin-rooms'] });
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    queryClient.invalidateQueries({ queryKey: ['room-bookings'] });
  }

  const createMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: () => {
      refreshRooms();
      showSuccess('เพิ่มห้องสำเร็จ');
      setRoomName('');
    },
    onError: (error) => showError(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ roomId, changes }) => updateRoom(roomId, changes),
    onSuccess: (data) => {
      refreshRooms();
      showSuccess(data.message);
      setEditingId(null);
    },
    onError: (error) => showError(error.message),
  });

  function submitForm(event) {
    event.preventDefault();
    createMutation.mutate(roomName);
  }

  function startEdit(room) {
    setEditingId(room.room_id);
    setEditName(room.room_name);
  }

  function saveEdit(event) {
    event.preventDefault();
    updateMutation.mutate({ roomId: editingId, changes: { room_name: editName } });
  }

  return (
    <section className="admin-section">
      <h3>จัดการห้อง</h3>

      <form className="equipment-form" onSubmit={submitForm}>
        <div className="form-grid">
          <label>
            ชื่อห้องใหม่
            <input
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              maxLength={100}
              required
            />
          </label>
        </div>
        <div className="form-actions">
          <button className="button-primary" type="submit" disabled={createMutation.isPending}>
            + เพิ่มห้อง
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="equipment-table responsive-table">
          <thead>
            <tr>
              <th>ชื่อห้อง</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.room_id}>
                <td data-label="ชื่อห้อง">
                  {editingId === room.room_id ? (
                    <form className="row-actions" onSubmit={saveEdit}>
                      <input
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        maxLength={100}
                        required
                        autoFocus
                      />
                      <button type="submit" disabled={updateMutation.isPending}>บันทึก</button>
                      <button type="button" onClick={() => setEditingId(null)}>ยกเลิก</button>
                    </form>
                  ) : (
                    <>
                      {room.room_name}
                      {!room.is_active && ' (ปิดอยู่)'}
                    </>
                  )}
                </td>
                <td data-label="จัดการ">
                  <div className="row-actions">
                    <button type="button" onClick={() => startEdit(room)}>
                      แก้ชื่อ
                    </button>
                    <button
                      className={room.is_active ? 'button-danger' : 'button-restore'}
                      type="button"
                      disabled={updateMutation.isPending}
                      onClick={() =>
                        updateMutation.mutate({
                          roomId: room.room_id,
                          changes: { is_active: !room.is_active },
                        })
                      }
                    >
                      {room.is_active ? 'ปิดห้อง' : 'เปิดห้อง'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="loading-message">ปิดห้อง = จองใหม่ไม่ได้ แต่การจองที่มีอยู่แล้วยังอยู่ครบ</p>
    </section>
  );
}
