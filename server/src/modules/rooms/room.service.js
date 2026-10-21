// Business Logic สำหรับจองห้อง — จองแล้วได้ทันที ไม่มีขั้นตอนอนุมัติ ระบบกันเวลาชนกันเอง
// เช็คชน + สร้างการจองต้องอยู่ใน transaction เดียวกัน ไม่งั้นสองคนกดจองช่วงเดียวกันพร้อมกันจะผ่านทั้งคู่
import * as roomRepository from './room.repository.js';
import { toBangkokDateTime } from './room.validator.js';
import { AppError } from '../../utils/AppError.js';
import { runSerializableTransaction } from '../../utils/transaction.js';

// "13:00" ตามเวลาไทย ไว้ใส่ในข้อความแจ้งว่าชนกับการจองช่วงไหน
function formatBangkokTime(date) {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(11, 16);
}

function serializeBooking(booking) {
  return {
    booking_id: booking.booking_id,
    room_id: booking.room_id,
    room_name: booking.rooms?.room_name ?? null,
    user_id: booking.user_id,
    user_name: booking.users?.name ?? null,
    start_at: booking.start_at,
    end_at: booking.end_at,
    purpose: booking.purpose,
    created_at: booking.created_at,
  };
}

export async function getRooms() {
  try {
    return await roomRepository.findRooms();
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดรายชื่อห้องได้', { cause: error });
  }
}

export async function createRoom(roomName) {
  try {
    return await roomRepository.createRoom(roomName);
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'มีห้องชื่อนี้อยู่แล้ว');
    }

    throw new AppError(500, 'ไม่สามารถเพิ่มห้องได้', { cause: error });
  }
}

// ปิดห้อง (is_active = false) แล้วการจองเดิมที่มีอยู่ยังอยู่ครบ แค่จองใหม่ไม่ได้
export async function updateRoom(roomId, changes) {
  try {
    return await roomRepository.updateRoom(roomId, changes);
  } catch (error) {
    if (error.code === 'P2025') {
      throw new AppError(404, 'ไม่พบห้อง');
    }
    if (error.code === 'P2002') {
      throw new AppError(409, 'มีห้องชื่อนี้อยู่แล้ว');
    }

    throw new AppError(500, 'ไม่สามารถแก้ไขห้องได้', { cause: error });
  }
}

// ลบได้เฉพาะห้องที่ไม่เคยถูกจองเลย (เช่น เพิ่มผิด) ห้องที่มีประวัติการจองต้องใช้ "ปิดห้อง" แทน
// ไม่งั้นประวัติว่าใครใช้ห้องไหนเมื่อไรจะหาย (FK fk_room_booking_room ก็ไม่ยอมให้ลบอยู่แล้ว)
// เช็คกับลบอยู่ใน transaction เดียวกัน กันมีคนจองห้องนี้แทรกเข้ามาระหว่างนั้น
export async function deleteRoom(roomId) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const room = await roomRepository.findRoomById(roomId, tx);
      if (!room) return { error: 'ไม่พบห้อง', status: 404 };

      const bookingCount = await roomRepository.countBookingsByRoomId(roomId, tx);
      if (bookingCount > 0) {
        return {
          error: 'ห้องนี้มีประวัติการจองแล้ว จึงลบไม่ได้ ให้ใช้ "ปิดห้อง" แทน',
          status: 409,
        };
      }

      await roomRepository.deleteRoom(roomId, tx);
      return {};
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถลบห้องได้', { cause: error });
  }
}

// การจองทุกห้องของวันหนึ่ง (00:00–24:00 เวลาไทย) ให้ทุกคนเห็นว่าช่วงไหนว่าง
export async function getBookingsByDate(date) {
  try {
    const from = toBangkokDateTime(date, '00:00');
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    const bookings = await roomRepository.findBookingsBetween(from, to);

    return bookings.map(serializeBooking);
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดตารางจองห้องได้', { cause: error });
  }
}

export async function getMyBookings(userId) {
  try {
    const bookings = await roomRepository.findBookingsByUserId(userId);
    return bookings.map(serializeBooking);
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดรายการจองของคุณได้', { cause: error });
  }
}

export async function createBooking(userId, { roomId, startAt, endAt, purpose }) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const room = await roomRepository.findRoomById(roomId, tx);

      if (!room) return { error: 'ไม่พบห้อง', status: 404 };
      if (!room.is_active) {
        return { error: 'ห้องนี้ปิดให้จองชั่วคราว', status: 400 };
      }

      const overlap = await roomRepository.findOverlappingBooking(
        roomId,
        startAt,
        endAt,
        tx,
      );

      if (overlap) {
        return {
          error: `ห้องนี้ถูกจองแล้วช่วง ${formatBangkokTime(overlap.start_at)}–${formatBangkokTime(overlap.end_at)} น.`,
          status: 409,
        };
      }

      const booking = await roomRepository.createBooking(
        {
          room_id: roomId,
          user_id: userId,
          start_at: startAt,
          end_at: endAt,
          purpose,
        },
        tx,
      );

      return { booking };
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return serializeBooking(result.booking);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถจองห้องได้', { cause: error });
  }
}

// เจ้าของยกเลิกของตัวเองได้ Admin ยกเลิกให้ใครก็ได้ (เช่น ต้องใช้ห้องจัดงาน)
// การจองที่ใช้ห้องเสร็จแล้วยกเลิกไม่ได้ เพื่อให้ยังเหลือเป็นประวัติว่าใครใช้ห้องเมื่อไร
export async function cancelBooking(bookingId, actorId, isAdmin) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const booking = await roomRepository.findBookingById(bookingId, tx);

      if (!booking) return { error: 'ไม่พบการจอง', status: 404 };
      if (booking.user_id !== actorId && !isAdmin) {
        return { error: 'คุณไม่มีสิทธิ์ยกเลิกการจองนี้', status: 403 };
      }
      if (booking.end_at <= new Date()) {
        return { error: 'การจองที่ใช้ห้องเสร็จไปแล้วยกเลิกไม่ได้', status: 400 };
      }

      await roomRepository.deleteBookingById(bookingId, tx);

      return {};
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถยกเลิกการจองได้', { cause: error });
  }
}
