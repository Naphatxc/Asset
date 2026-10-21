// จัดการห้องจอง (Admin เท่านั้น) — เพิ่มห้อง, แก้ชื่อ, เปิด/ปิดให้จอง, ลบ
// ลบได้เฉพาะห้องที่ไม่เคยถูกจอง (server เช็ค) ห้องที่มีประวัติการจองต้องอ้างอิงได้ จึงให้ปิดแทน
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { createRoom, deleteRoom, getRooms, updateRoom } from '../../../api/rooms.js';
import { useToast } from '../../../components/ToastProvider.jsx';

export default function RoomManager() {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  // popup เพิ่มห้อง เปิดอยู่ไหม กับชื่อที่พิมพ์ในนั้น
  const [addOpen, setAddOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  // ห้องที่กำลังแก้ชื่อ (null = ไม่มี) กับชื่อที่พิมพ์อยู่
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  // ห้องที่กำลังรอให้กดยืนยันลบ (null = ไม่ได้เปิด popup)
  const [confirmDelete, setConfirmDelete] = useState(null);

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: getRooms,
  });
  const rooms = roomsQuery.data?.rooms ?? [];

  // ห้องเปลี่ยนแล้วต้องโหลดใหม่: รายชื่อห้อง (ตารางนี้ + ดรอปดาวน์ + ตารางเวลา ใช้ query เดียวกัน) และการจอง (แสดงชื่อห้อง)
  function refreshRooms() {
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
    queryClient.invalidateQueries({ queryKey: ['room-bookings'] });
  }

  const createMutation = useMutation({
    mutationFn: createRoom,
    onSuccess: () => {
      refreshRooms();
      showSuccess('เพิ่มห้องสำเร็จ');
      closeAdd();
    },
    // ไม่ปิด popup ตอนพลาด (เช่นชื่อซ้ำ) ให้แก้ชื่อแล้วกดใหม่ได้เลย
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

  // ลบไม่ได้ (ห้องมีประวัติการจอง) server ตอบ 409 พร้อมข้อความให้ปิดห้องแทน แสดงเป็น toast แล้วปิด popup
  const deleteMutation = useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => {
      refreshRooms();
      showSuccess('ลบห้องแล้ว');
    },
    onError: (error) => showError(error.message),
    onSettled: () => setConfirmDelete(null),
  });

  function closeAdd() {
    setAddOpen(false);
    setRoomName('');
  }

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
      <div className="section-heading equipment-toolbar">
        <h3>จัดการห้อง</h3>
        <button className="button-primary" type="button" onClick={() => setAddOpen(true)}>
          + เพิ่มห้อง
        </button>
      </div>

      {roomsQuery.error && <p className="error-message">{roomsQuery.error.message}</p>}

      {/* popup เพิ่มห้อง รูปแบบเดียวกับ CreateUserDialog (เพิ่มผู้ใช้งาน) */}
      {addOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeAdd}>
          <section
            className="withdraw-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-room-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="form-heading">
              <div>
                <p className="section-kicker">Room</p>
                <h2 id="add-room-title">เพิ่มห้อง</h2>
              </div>
            </div>

            <form onSubmit={submitForm}>
              <div className="form-grid">
                <label className="field-wide">
                  ชื่อห้อง
                  <input
                    value={roomName}
                    onChange={(event) => setRoomName(event.target.value)}
                    maxLength={100}
                    placeholder="เช่น ห้องประชุม 301"
                    required
                    autoFocus
                  />
                </label>
              </div>

              <div className="form-actions">
                <button className="button-primary" type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'กำลังบันทึก...' : 'เพิ่มห้อง'}
                </button>
                <button className="button-secondary" type="button" onClick={closeAdd}>
                  ยกเลิก
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {roomsQuery.isLoading ? (
        <p className="loading-message">กำลังโหลดรายชื่อห้อง...</p>
      ) : (
        <div className="table-wrap">
          <table className="equipment-table responsive-table room-manager-table">
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
                      {/* ปิดห้องใช้สีปกติ เก็บสีแดงไว้ให้ "ลบ" ที่ย้อนคืนไม่ได้
                          room-toggle ล็อกความกว้าง "ปิดห้อง"/"เปิดห้อง" ให้เท่ากัน ปุ่มข้างๆ จะได้ไม่ขยับตอนสลับ */}
                      <button
                        className={`room-toggle${room.is_active ? '' : ' button-restore'}`}
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
                      <button
                        className="button-danger"
                        type="button"
                        disabled={deleteMutation.isPending}
                        onClick={() => setConfirmDelete(room)}
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="loading-message">
        ปิดห้อง = จองใหม่ไม่ได้ แต่การจองที่มีอยู่แล้วยังอยู่ครบ · ลบได้เฉพาะห้องที่ยังไม่เคยมีใครจอง
      </p>

      {confirmDelete && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setConfirmDelete(null)}>
          <section
            className="withdraw-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-room-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="delete-room-title">ยืนยันการลบห้อง</h2>
            <p>
              ลบ {confirmDelete.room_name} ออกจากระบบใช่หรือไม่? ลบแล้วย้อนคืนไม่ได้
              ถ้าแค่ไม่อยากให้จองชั่วคราว ให้ใช้ &quot;ปิดห้อง&quot; แทน
            </p>
            <div className="form-actions">
              <button
                className="button-primary"
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDelete.room_id)}
              >
                {deleteMutation.isPending ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
              <button className="button-secondary" type="button" onClick={() => setConfirmDelete(null)}>
                กลับ
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
