// จัดการห้องจอง (Admin เท่านั้น) — เพิ่มห้อง, แก้ชื่อ, เปิด/ปิดให้จอง, ลบ
// ลบได้เฉพาะห้องที่ไม่เคยถูกจอง (server เช็ค) ห้องที่มีประวัติการจองต้องอ้างอิงได้ จึงให้ปิดแทน
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { createRoom, deleteRoom, getRooms, updateRoom } from '../../../api/rooms.js';
import { useToast } from '../../../components/ToastProvider.jsx';

export default function RoomManager() {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  // popup ชื่อห้องตัวเดียวใช้ทั้งเพิ่มและแก้ชื่อ: null = ปิด, { room: null } = เพิ่ม, { room } = แก้ชื่อห้องนั้น
  const [nameDialog, setNameDialog] = useState(null);
  const [nameInput, setNameInput] = useState('');
  const nameInputRef = useRef(null);
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
      closeNameDialog();
    },
    // ไม่ปิด popup ตอนพลาด (เช่นชื่อซ้ำ) ให้แก้ชื่อแล้วกดใหม่ได้เลย
    onError: (error) => showError(error.message),
  });

  // ใช้ทั้งแก้ชื่อ (จาก popup) และเปิด/ปิดห้อง สำเร็จแล้วปิด popup (ถ้าไม่ได้เปิดอยู่ก็ไม่มีผลอะไร)
  // พลาดแล้ว popup แก้ชื่อยังเปิดค้างไว้ให้แก้ต่อได้ เหมือนตอนเพิ่มห้อง
  const updateMutation = useMutation({
    mutationFn: ({ roomId, changes }) => updateRoom(roomId, changes),
    onSuccess: (data) => {
      refreshRooms();
      showSuccess(data.message);
      closeNameDialog();
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

  // เปิด popup แล้ว focus ช่องชื่อ และเลือกข้อความเดิมไว้ทั้งหมด (ตอนแก้ชื่อ) จะได้พิมพ์ทับได้ทันที
  useEffect(() => {
    if (!nameDialog) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [nameDialog]);

  const renaming = nameDialog?.room ?? null;
  const namePending = createMutation.isPending || updateMutation.isPending;

  function openAdd() {
    setNameDialog({ room: null });
    setNameInput('');
  }

  function openRename(room) {
    setNameDialog({ room });
    setNameInput(room.room_name);
  }

  function closeNameDialog() {
    setNameDialog(null);
    setNameInput('');
  }

  function submitName(event) {
    event.preventDefault();
    if (renaming) {
      updateMutation.mutate({ roomId: renaming.room_id, changes: { room_name: nameInput } });
    } else {
      createMutation.mutate(nameInput);
    }
  }

  return (
    <section className="admin-section">
      <div className="section-heading equipment-toolbar">
        <h3>จัดการห้อง</h3>
        <button className="button-primary" type="button" onClick={openAdd}>
          + เพิ่มห้อง
        </button>
      </div>

      {roomsQuery.error && <p className="error-message">{roomsQuery.error.message}</p>}

      {/* popup เพิ่มห้อง/แก้ชื่อห้อง รูปแบบเดียวกับ CreateUserDialog (เพิ่มผู้ใช้งาน) */}
      {nameDialog && (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeNameDialog}>
          <section
            className="withdraw-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-name-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="form-heading">
              <div>
                <p className="section-kicker">Room</p>
                <h2 id="room-name-title">{renaming ? 'แก้ชื่อห้อง' : 'เพิ่มห้อง'}</h2>
              </div>
            </div>

            <form onSubmit={submitName}>
              <div className="form-grid">
                <label className="field-wide">
                  ชื่อห้อง
                  <input
                    value={nameInput}
                    onChange={(event) => setNameInput(event.target.value)}
                    ref={nameInputRef}
                    maxLength={100}
                    placeholder="เช่น ห้องประชุม 301"
                    required
                  />
                </label>
              </div>

              <div className="form-actions">
                <button
                  className="button-primary"
                  type="submit"
                  disabled={namePending || (renaming && nameInput.trim() === renaming.room_name)}
                >
                  {namePending ? 'กำลังบันทึก...' : renaming ? 'บันทึก' : 'เพิ่มห้อง'}
                </button>
                <button className="button-secondary" type="button" onClick={closeNameDialog}>
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
                    {room.room_name}
                    {!room.is_active && ' (ปิดอยู่)'}
                  </td>
                  <td data-label="จัดการ">
                    <div className="row-actions">
                      <button type="button" onClick={() => openRename(room)}>
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
