import * as roomService from './room.service.js';

// ทุกคนเห็นทุกห้องรวมที่ปิดอยู่ (ตารางเวลาโชว์ห้องที่ปิดเป็นสีเทา, หน้าจัดการห้องใช้เปิดกลับ)
export async function getRooms(_request, response, next) {
  try {
    const rooms = await roomService.getRooms();

    response.status(200).json({ rooms });
  } catch (error) {
    next(error);
  }
}

export async function createRoom(request, response, next) {
  try {
    const room = await roomService.createRoom(request.validated.roomName);

    response.status(201).json({ message: 'เพิ่มห้องสำเร็จ', room });
  } catch (error) {
    next(error);
  }
}

export async function updateRoom(request, response, next) {
  try {
    const { roomId, changes } = request.validated;
    const room = await roomService.updateRoom(roomId, changes);

    response.status(200).json({ message: 'บันทึกข้อมูลห้องแล้ว', room });
  } catch (error) {
    next(error);
  }
}

export async function deleteRoom(request, response, next) {
  try {
    await roomService.deleteRoom(request.validated.roomId);

    response.status(200).json({ message: 'ลบห้องแล้ว' });
  } catch (error) {
    next(error);
  }
}

export async function getBookingsByDate(request, response, next) {
  try {
    const bookings = await roomService.getBookingsByDate(request.validated.date);

    response.status(200).json({ bookings });
  } catch (error) {
    next(error);
  }
}

export async function getMyBookings(request, response, next) {
  try {
    const bookings = await roomService.getMyBookings(Number(request.user.sub));

    response.status(200).json({ bookings });
  } catch (error) {
    next(error);
  }
}

export async function createBooking(request, response, next) {
  try {
    const booking = await roomService.createBooking(
      Number(request.user.sub),
      request.validated,
    );

    response.status(201).json({ message: 'จองห้องสำเร็จ', booking });
  } catch (error) {
    next(error);
  }
}

export async function cancelBooking(request, response, next) {
  try {
    // authenticate โหลด role ล่าสุดจาก DB ไว้ใน request.account แล้ว ไม่ต้อง query ซ้ำ
    const isAdmin = request.account?.role === 'admin';
    await roomService.cancelBooking(
      request.validated.bookingId,
      Number(request.user.sub),
      isAdmin,
    );

    response.status(200).json({ message: 'ยกเลิกการจองแล้ว' });
  } catch (error) {
    next(error);
  }
}
