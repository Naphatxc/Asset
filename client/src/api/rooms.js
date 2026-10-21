// รวมคำสั่งติดต่อ Room API — จองห้องแล้วได้ทันที ไม่มีขั้นตอนอนุมัติ (server กันเวลาชนกันให้เอง)
// getAllRooms/createRoom/updateRoom สงวนให้ Admin ที่เหลือผู้ใช้ทุกคนเรียกได้
import { request } from './http.js';

// ห้องที่เปิดให้จอง
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

// slot = 'morning' | 'afternoon' | 'evening' (ช่วงเวลาจริงกำหนดที่ SLOTS ใน room.validator.js)
export function createRoomBooking({ roomId, date, slot, purpose }) {
  return request('/api/room-bookings', {
    method: 'POST',
    body: {
      room_id: roomId,
      date,
      slot,
      purpose,
    },
  });
}

export function cancelRoomBooking(bookingId) {
  return request(`/api/room-bookings/${bookingId}`, {
    method: 'DELETE',
  });
}

export function getAllRooms() {
  return request('/api/admin/rooms');
}

export function createRoom(roomName) {
  return request('/api/admin/rooms', {
    method: 'POST',
    body: { room_name: roomName },
  });
}

// changes = { room_name?, is_active? } ส่งมาเฉพาะช่องที่จะเปลี่ยน
export function updateRoom(roomId, changes) {
  return request(`/api/admin/rooms/${roomId}`, {
    method: 'PATCH',
    body: changes,
  });
}
