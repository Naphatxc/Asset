// การจองของฉัน — ทุกการจองของคนที่ login อยู่ ไม่ต้องไล่เปลี่ยนวันในตารางเพื่อหาเอง
// แบ่งเป็น "กำลังจะมาถึง" (ใกล้สุดก่อน ยกเลิกได้) กับ "ที่ผ่านมา" (ล่าสุดก่อน โชว์แค่ PAST_LIMIT รายการ)
// ปุ่มยกเลิกไม่ยิง API เอง ส่งการจองกลับไปให้ RoomBooking.jsx เปิด popup ยืนยันตัวเดียวกับตารางรายวัน
import { useQuery } from '@tanstack/react-query';

import { getMyRoomBookings } from '../../../api/rooms.js';
import { formatDate, formatSlot } from '../../../utils/roomBooking.js';

const PAST_LIMIT = 10;

export default function MyRoomBookings({ cancelPending, onRequestCancel, onShowDate }) {
  // key ขึ้นต้นด้วย 'room-bookings' จองใหม่/ยกเลิก/Admin แก้ชื่อห้องแล้วรายการนี้จึงโหลดใหม่ตามไปด้วย
  const myBookingsQuery = useQuery({
    queryKey: ['room-bookings', 'mine'],
    queryFn: getMyRoomBookings,
  });
  const bookings = myBookingsQuery.data?.bookings ?? [];

  // server เรียงใหม่ไปเก่าอยู่แล้ว ฝั่งกำลังจะมาถึงกลับลำดับให้ใกล้สุดขึ้นก่อน
  const now = new Date();
  const upcoming = bookings.filter((booking) => new Date(booking.end_at) > now).reverse();
  const past = bookings.filter((booking) => new Date(booking.end_at) <= now).slice(0, PAST_LIMIT);

  return (
    <div className="my-room-bookings">
      <h3>การจองของฉัน</h3>

      {myBookingsQuery.isLoading ? (
        <p className="loading-message">กำลังโหลดการจองของคุณ...</p>
      ) : myBookingsQuery.isError ? (
        <p className="error-message">{myBookingsQuery.error.message}</p>
      ) : (
        <>
          <h4>กำลังจะมาถึง ({upcoming.length})</h4>
          {upcoming.length === 0 ? (
            <p className="loading-message">ยังไม่มีการจองที่กำลังจะมาถึง</p>
          ) : (
            <div className="table-wrap">
              <table className="equipment-table responsive-table">
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>ห้อง</th>
                    <th>ช่วงเวลา</th>
                    <th>วัตถุประสงค์</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((booking) => (
                    <tr key={booking.booking_id}>
                      <td data-label="วันที่">{formatDate(booking.start_at)}</td>
                      <td data-label="ห้อง">{booking.room_name}</td>
                      <td data-label="ช่วงเวลา">{formatSlot(booking.start_at, booking.end_at)}</td>
                      <td data-label="วัตถุประสงค์">{booking.purpose || '-'}</td>
                      <td data-label="จัดการ">
                        <div className="row-actions">
                          <button type="button" onClick={() => onShowDate(booking.start_at)}>
                            ดูในตาราง
                          </button>
                          <button
                            className="button-danger"
                            type="button"
                            disabled={cancelPending}
                            onClick={() => onRequestCancel(booking)}
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {past.length > 0 && (
            <>
              <h4>ที่ผ่านมา (ล่าสุด {past.length} รายการ)</h4>
              <div className="table-wrap">
                <table className="equipment-table responsive-table">
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>ห้อง</th>
                      <th>ช่วงเวลา</th>
                      <th>วัตถุประสงค์</th>
                    </tr>
                  </thead>
                  <tbody>
                    {past.map((booking) => (
                      <tr key={booking.booking_id}>
                        <td data-label="วันที่">{formatDate(booking.start_at)}</td>
                        <td data-label="ห้อง">{booking.room_name}</td>
                        <td data-label="ช่วงเวลา">{formatSlot(booking.start_at, booking.end_at)}</td>
                        <td data-label="วัตถุประสงค์">{booking.purpose || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
