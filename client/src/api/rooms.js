// รวมคำสั่งติดต่อ Room API — จองห้องแล้วได้ทันที ไม่มีขั้นตอนอนุมัติ (server กันเวลาชนกันให้เอง)
// createRoom/updateRoom/deleteRoom สงวนให้ Admin ที่เหลือผู้ใช้ทุกคนเรียกได้
import { request } from './http.js';

// ทุกห้องรวมที่ปิดอยู่ (ดู is_active) ใช้ทั้งฟอร์มจอง ตารางเวลา และหน้าจัดการห้อง
export function getRooms() {
  return request('/api/rooms');
}

// การจองทุกห้องของวันนั้น date = "YYYY-MM-DD" (เวลาไทย)
export function getRoomBookings(date) {
  return request(`/api/room-bookings?date=${encodeURIComponent(date)}`);
}

export function getMyRoomBookings() {
  return request('/api/room-bookings/mine');
}

// start/end = "HH:00" ชั่วโมงเต็มตามเวลาไทย ระหว่าง 09:00–19:00 (กติกาอยู่ที่ room.validator.js)
export function createRoomBooking({ roomId, date, start, end, purpose }) {
  return request('/api/room-bookings', {
    method: 'POST',
    body: {
      room_id: roomId,
      date,
      start,
      end,
      purpose,
    },
  });
}

export function cancelRoomBooking(bookingId) {
  return request(`/api/room-bookings/${bookingId}`, {
    method: 'DELETE',
  });
}

export function createRoom(roomName) {
  return request('/api/admin/rooms', {
    method: 'POST',
    body: { room_name: roomName },
  });
}

// ลบได้เฉพาะห้องที่ไม่เคยถูกจอง ห้องที่มีประวัติ server ตอบ 409 ให้ปิดห้องแทน
export function deleteRoom(roomId) {
  return request(`/api/admin/rooms/${roomId}`, {
    method: 'DELETE',
  });
}

// changes = { room_name?, is_active? } ส่งมาเฉพาะช่องที่จะเปลี่ยน
export function updateRoom(roomId, changes) {
  return request(`/api/admin/rooms/${roomId}`, {
    method: 'PATCH',
    body: changes,
  });
}

// ===== จองต่อเนื่อง (Admin) =====
// series = { roomId, startDate, endDate, weekdays: [0-6] (0 = อาทิตย์), start: "HH:00", end: "HH:00", purpose }
function seriesBody({ roomId, startDate, endDate, weekdays, start, end, purpose }) {
  return {
    room_id: roomId,
    start_date: startDate,
    end_date: endDate,
    weekdays,
    start,
    end,
    purpose,
  };
}

// ดูตัวอย่างก่อนจองจริง: { bookable: [{ date, start_at, end_at }], conflicts: [{ date, booking }] }
export function previewRoomBookingSeries(series) {
  return request('/api/admin/rooms/series/preview', { method: 'POST', body: seriesBody(series) });
}

// จองทุกวันที่ว่าง วันที่ชนข้ามไป: { series_id, created, skipped, message }
export function createRoomBookingSeries(series) {
  return request('/api/admin/rooms/series', { method: 'POST', body: seriesBody(series) });
}

// ยกเลิกทุกรายการในชุดที่ยังไม่จบ
export function cancelRoomBookingSeries(seriesId) {
  return request(`/api/admin/rooms/series/${seriesId}`, { method: 'DELETE' });
}
