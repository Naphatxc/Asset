// roomRouter (mount ที่ /api/rooms): รายชื่อทุกห้อง (รวมที่ปิดอยู่ ดู is_active)
// roomBookingRouter (mount ที่ /api/room-bookings): ทุกคนที่ login ดูตาราง/จอง/ยกเลิกการจองของตัวเองได้
// adminRoomRouter (mount ที่ /api/admin/rooms): Admin เพิ่ม/แก้ชื่อ/เปิด-ปิด/ลบห้อง
import express from 'express';

import * as roomController from './room.controller.js';
import {
  validateBookingDateQuery,
  validateBookingIdParam,
  validateCreateBooking,
  validateCreateRoom,
  validateRoomIdParam,
  validateUpdateRoom,
} from './room.validator.js';
import {
  authenticate,
  requireAdmin,
} from '../../middlewares/auth.middleware.js';
import { verifyCsrfToken } from '../../middlewares/csrf.middleware.js';

const roomRouter = express.Router();
const roomBookingRouter = express.Router();
const adminRoomRouter = express.Router();

roomRouter.use(authenticate);
roomBookingRouter.use(authenticate);
adminRoomRouter.use(authenticate, verifyCsrfToken, requireAdmin);

// GET /api/rooms - ทุกห้องรวมที่ปิดอยู่ ดรอปดาวน์จองกรองเฉพาะ is_active ฝั่ง client
roomRouter.get('/', roomController.getRooms);

// GET /api/room-bookings?date=YYYY-MM-DD - การจองทุกห้องของวันนั้น (ไม่ส่ง date = วันนี้)
roomBookingRouter.get(
  '/',
  validateBookingDateQuery,
  roomController.getBookingsByDate,
);

// GET /api/room-bookings/mine - การจองของตัวเองทั้งหมด (ใหม่สุดก่อน)
roomBookingRouter.get('/mine', roomController.getMyBookings);

// POST /api/room-bookings - จองห้องให้ตัวเอง (ไม่รับ user_id จาก body) ได้ทันทีถ้าเวลาไม่ชน
roomBookingRouter.post(
  '/',
  verifyCsrfToken,
  validateCreateBooking,
  roomController.createBooking,
);

// DELETE /api/room-bookings/:id - ยกเลิกการจอง (เจ้าของ หรือ Admin เช็คสิทธิ์ใน service)
roomBookingRouter.delete(
  '/:id',
  verifyCsrfToken,
  validateBookingIdParam,
  roomController.cancelBooking,
);

// POST /api/admin/rooms - เพิ่มห้อง
adminRoomRouter.post('/', validateCreateRoom, roomController.createRoom);

// PATCH /api/admin/rooms/:id - แก้ชื่อ และ/หรือ เปิด-ปิดห้อง ({ room_name?, is_active? })
adminRoomRouter.patch('/:id', validateUpdateRoom, roomController.updateRoom);

// DELETE /api/admin/rooms/:id - ลบได้เฉพาะห้องที่ไม่เคยถูกจอง (เช็คใน service) ห้องที่มีประวัติให้ปิดแทน
adminRoomRouter.delete('/:id', validateRoomIdParam, roomController.deleteRoom);

export { adminRoomRouter, roomBookingRouter };
export default roomRouter;
