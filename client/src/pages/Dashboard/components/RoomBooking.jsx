import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  cancelRoomBooking,
  createRoomBooking,
  getRoomBookings,
  getRooms,
} from '../../../api/rooms.js';
import ThaiDateInput from '../../../components/ThaiDateInput.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import RoomManager from './RoomManager.jsx';
import RoomTimeline from './RoomTimeline.jsx';

// ต้องตรงกับ OPEN_TIME/CLOSE_TIME ใน server (room.validator.js): 08:00, 08:30, ... , 20:00
const TIME_OPTIONS = [];
for (let hour = 8; hour <= 20; hour += 1) {
  const hh = String(hour).padStart(2, '0');
  TIME_OPTIONS.push(`${hh}:00`);
  if (hour < 20) TIME_OPTIONS.push(`${hh}:30`);
}

// วันนี้แบบ YYYY-MM-DD (ใช้เป็นค่าเริ่มต้นและวันแรกที่เลือกได้ในช่องวันที่)
function todayDateInput() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

// เวลาจาก server เป็น UTC เช่น "2026-10-18T03:00:00.000Z" -> "10:00" ตามเวลาไทย
function formatTime(value) {
  return new Date(value).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

export default function RoomBooking({ user }) {
  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: getRooms,
  });
  const rooms = roomsQuery.data?.rooms ?? [];
  const [roomId, setRoomId] = useState('');
  const [date, setDate] = useState(todayDateInput);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [purpose, setPurpose] = useState('');
  // 20:00 คือเวลาปิด เริ่มตอนนั้นไม่ได้ ส่วนเวลาจบต้องหลังเวลาเริ่มเสมอ
  const startTimeOptions = TIME_OPTIONS.filter((time) => time < '20:00');
  const endTimeOptions = TIME_OPTIONS.filter((time) => time > startTime);

  const bookingsQuery = useQuery({
    queryKey: ['room-bookings', date],
    queryFn: () => getRoomBookings(date),
  });
  const bookings = bookingsQuery.data?.bookings ?? [];

  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();

  const bookMutation = useMutation({
    mutationFn: createRoomBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-bookings'] });
      showSuccess('จองห้องสำเร็จ');
      setStartTime('');
      setEndTime('');
      setPurpose('');
    },
    onError: (error) => showError(error.message),
  });

  // เจ้าของยกเลิกของตัวเองได้ Admin ยกเลิกให้ใครก็ได้ (server เช็คสิทธิ์ซ้ำอีกชั้น)
  const cancelMutation = useMutation({
    mutationFn: cancelRoomBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-bookings'] });
      showSuccess('ยกเลิกการจองแล้ว');
    },
    onError: (error) => showError(error.message),
  });

  // เปลี่ยนเวลาเริ่มแล้วเวลาจบที่เลือกไว้ไม่อยู่หลังเวลาเริ่มอีกต่อไป -> ล้างทิ้งให้เลือกใหม่
  function changeStartTime(event) {
    const newStartTime = event.target.value;
    setStartTime(newStartTime);
    if (endTime <= newStartTime) setEndTime('');
  }

  function submitForm(event) {
    event.preventDefault();
    bookMutation.mutate({
      roomId: Number(roomId),
      date: date,
      startTime: startTime,
      endTime: endTime,
      purpose: purpose,
    });
  }

  return (
    <section className="admin-section">
      <h2>จองห้อง</h2>

      <RoomTimeline
        rooms={rooms}
        bookings={bookings}
        date={date}
        minDate={todayDateInput()}
        userId={user.user_id}
        onChangeDate={setDate}
      />
      <form className="equipment-form" onSubmit={submitForm}>
        <div className="form-grid">
          <label>
            ห้อง
            <select value={roomId} onChange={(event) => setRoomId(event.target.value)} required>
              <option value="">-- เลือกห้อง --</option>
              {rooms.map((room) => (
                <option key={room.room_id} value={room.room_id}>{room.room_name}</option>
              ))}
            </select>
          </label>
          <label>
            วันที่
            <ThaiDateInput
              value={date}
              min={todayDateInput()}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <label>
            เวลาเริ่ม
            <select value={startTime} onChange={changeStartTime} required>
              <option value="">-- เลือกเวลา --</option>
              {startTimeOptions.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </label>
          <label>
            เวลาสิ้นสุด
            <select value={endTime} onChange={(event) => setEndTime(event.target.value)} required>
              <option value="">-- เลือกเวลา --</option>
              {endTimeOptions.map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>
          </label>
          <label className="field-wide">
            วัตถุประสงค์ (ไม่บังคับ)
            <textarea rows="2" value={purpose} onChange={(event) => setPurpose(event.target.value)} />
          </label>
        </div>
        <div className="form-actions">
          <button className="button-primary" type="submit" disabled={bookMutation.isPending}>
            {bookMutation.isPending ? 'กำลังจอง...' : 'จองห้อง'}
          </button>
        </div>
      </form>

      <h3>การจองวันที่เลือก</h3>
      {bookings.length === 0 ? (
        <p className="loading-message">ยังไม่มีการจองในวันที่เลือก</p>
      ) : (
        <div className="table-wrap">
          <table className="equipment-table responsive-table">
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>เวลา</th>
                <th>ผู้จอง</th>
                <th>วัตถุประสงค์</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.booking_id}>
                  <td data-label="ห้อง">{booking.room_name}</td>
                  <td data-label="เวลา">{formatTime(booking.start_at)}–{formatTime(booking.end_at)}</td>
                  <td data-label="ผู้จอง">{booking.user_name}</td>
                  <td data-label="วัตถุประสงค์">{booking.purpose || '-'}</td>
                  <td data-label="จัดการ">
                    {(booking.user_id === user.user_id || user.role === 'admin') && (
                      <div className="row-actions">
                        <button
                          className="button-danger"
                          type="button"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(booking.booking_id)}
                        >
                          ยกเลิก
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {user.role === 'admin' && <RoomManager />}
    </section>
  );
}
