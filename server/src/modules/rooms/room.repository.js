// Data Access Layer สำหรับ rooms / room_bookings — ทุกฟังก์ชันรับ Prisma transaction client ได้ (default = prisma)
import { prisma } from '../../config/prisma.js';

const bookingInclude = {
  rooms: { select: { room_name: true } },
  users: { select: { name: true } },
};

export async function findRooms({ activeOnly }, client = prisma) {
  return client.rooms.findMany({
    where: activeOnly ? { is_active: true } : undefined,
    orderBy: { room_id: 'asc' },
  });
}

export async function findRoomById(roomId, client = prisma) {
  return client.rooms.findUnique({ where: { room_id: roomId } });
}

export async function createRoom(roomName, client = prisma) {
  return client.rooms.create({ data: { room_name: roomName } });
}

export async function updateRoom(roomId, changes, client = prisma) {
  return client.rooms.update({ where: { room_id: roomId }, data: changes });
}

// การจองทุกห้องที่เริ่มในช่วง [from, to) ใช้แสดงตารางของวันหนึ่ง
export async function findBookingsBetween(from, to, client = prisma) {
  return client.room_bookings.findMany({
    where: { start_at: { gte: from, lt: to } },
    include: bookingInclude,
    orderBy: [{ room_id: 'asc' }, { start_at: 'asc' }],
  });
}

export async function findBookingsByUserId(userId, client = prisma) {
  return client.room_bookings.findMany({
    where: { user_id: userId },
    include: bookingInclude,
    orderBy: { start_at: 'desc' },
  });
}

// ช่วงเวลาสองช่วงทับกันเมื่อ "อันเก่าเริ่มก่อนอันใหม่จบ และอันเก่าจบหลังอันใหม่เริ่ม"
// จบ 13:00 กับเริ่ม 13:00 ไม่นับว่าชน (ใช้ lt/gt ไม่ใช่ lte/gte) จองต่อกันพอดีได้
export async function findOverlappingBooking(roomId, startAt, endAt, client = prisma) {
  return client.room_bookings.findFirst({
    where: {
      room_id: roomId,
      start_at: { lt: endAt },
      end_at: { gt: startAt },
    },
  });
}

export async function findBookingById(bookingId, client = prisma) {
  return client.room_bookings.findUnique({
    where: { booking_id: bookingId },
    include: bookingInclude,
  });
}

export async function createBooking(data, client = prisma) {
  return client.room_bookings.create({ data, include: bookingInclude });
}

export async function deleteBookingById(bookingId, client = prisma) {
  return client.room_bookings.delete({ where: { booking_id: bookingId } });
}
