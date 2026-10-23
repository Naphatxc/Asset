import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import {
  cancelRoomBooking,
  createRoomBooking,
  getRoomBookings,
  getRooms,
} from '../../../api/rooms.js';
import CharCount from '../../../components/CharCount.jsx';
import ThaiDateInput from '../../../components/ThaiDateInput.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import {
  HOURS,
  findBookingAt,
  formatDate,
  formatTime,
  hourLabel,
  isHourStarted,
} from '../../../utils/roomBooking.js';
import MyRoomBookings from './MyRoomBookings.jsx';
import RoomManager from './RoomManager.jsx';
import RoomTimeline from './RoomTimeline.jsx';

// ต้องตรงกับ server (room.validator.js): จองล่วงหน้าได้ไม่เกิน 30 วัน, วัตถุประสงค์ไม่เกิน 2000 ตัวอักษร
const MAX_DAYS_AHEAD = 30;
const MAX_PURPOSE_LENGTH = 2000;

// วันนี้แบบ YYYY-MM-DD (ใช้เป็นค่าเริ่มต้นและวันแรกที่เลือกได้ในช่องวันที่)
function todayDateInput() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

// "2026-10-21" + 30 วัน -> "2026-11-20" (คำนวณแบบ UTC กันวันเพี้ยนตามเขตเวลาของเครื่อง)
function addDays(date, days) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

// เวลาเริ่มของการจอง (UTC) -> วันที่ตามเวลาไทยแบบ YYYY-MM-DD ไว้สั่งให้ตารางเวลาเลื่อนไปวันนั้น
function bangkokDateOf(value) {
  return new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function RoomBooking({ user }) {
  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: getRooms,
  });
  const rooms = roomsQuery.data?.rooms ?? [];
  const [roomId, setRoomId] = useState('');
  const [date, setDate] = useState(todayDateInput);
  // ช่วงชั่วโมงที่เลือกด้วยปุ่มชั่วโมงในฟอร์ม (ตัวเลข 9..19, เช่น 14 ถึง 17 = 14:00–17:00) '' = ยังไม่ได้เลือก
  const [startHour, setStartHour] = useState('');
  const [endHour, setEndHour] = useState('');
  const [purpose, setPurpose] = useState('');
  // การจองที่กำลังรอให้กดยืนยันยกเลิก (null = ไม่ได้เปิด popup)
  const [confirmBooking, setConfirmBooking] = useState(null);
  const timelineRef = useRef(null);

  const today = todayDateInput();
  const maxDate = addDays(today, MAX_DAYS_AHEAD);

  const bookingsQuery = useQuery({
    queryKey: ['room-bookings', date],
    queryFn: () => getRoomBookings(date),
  });
  const bookings = bookingsQuery.data?.bookings ?? [];
  // โหลดไม่สำเร็จต้องบอกตรงๆ ไม่งั้นหน้าจะขึ้นว่า "ไม่มีห้อง/ไม่มีการจอง" ให้เข้าใจผิดว่าว่าง
  const loadError = roomsQuery.error?.message || bookingsQuery.error?.message;

  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();

  const bookMutation = useMutation({
    mutationFn: createRoomBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['room-bookings'] });
      showSuccess('จองห้องสำเร็จ');
      clearSelection();
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
    onSettled: () => setConfirmBooking(null),
  });

  function clearSelection() {
    setStartHour('');
    setEndHour('');
  }

  // เปลี่ยนวันแล้วช่วงที่เลือกไว้อาจเริ่มไปแล้วหรือชนการจองของวันใหม่ -> ล้างให้เลือกใหม่
  function changeDate(nextDate) {
    setDate(nextDate);
    clearSelection();
  }

  // เปลี่ยนห้องแล้วล้างช่วงที่เลือก เพราะแต่ละห้องว่างไม่ตรงกัน
  function changeRoom(nextRoomId) {
    setRoomId(nextRoomId);
    clearSelection();
  }

  // กดปุ่มชั่วโมง: เลือกได้เฉพาะชั่วโมงที่ต่อเนื่องกัน
  // - ยังไม่ได้เลือก หรือกดชั่วโมงที่ไม่ติดกับช่วงที่เลือก = เริ่มเลือกใหม่ที่ชั่วโมงนั้น
  // - กดชั่วโมงถัดจากท้ายช่วง/ก่อนต้นช่วง = ขยายช่วง
  // - กดชั่วโมงหัว/ท้ายช่วงที่เลือกอยู่ = ตัดชั่วโมงนั้นออก (เหลือชั่วโมงเดียวแล้วกดซ้ำ = ยกเลิกทั้งหมด)
  function toggleHour(hour) {
    if (startHour === '') {
      setStartHour(hour);
      setEndHour(hour + 1);
    } else if (hour === startHour && endHour === startHour + 1) {
      clearSelection();
    } else if (hour === endHour) {
      setEndHour(hour + 1);
    } else if (hour === startHour - 1) {
      setStartHour(hour);
    } else if (hour === startHour) {
      setStartHour(hour + 1);
    } else if (hour === endHour - 1) {
      setEndHour(hour);
    } else {
      setStartHour(hour);
      setEndHour(hour + 1);
    }
  }

  // "ดูในตาราง" จากการจองของฉัน: เลื่อนตารางเวลาไปวันนั้นแล้วเลื่อนจอขึ้นไปให้เห็นตาราง
  function showDate(startAt) {
    changeDate(bangkokDateOf(startAt));
    timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ปุ่มยกเลิกโชว์เฉพาะการจองที่ยังไม่จบ และเป็นของตัวเองหรือเป็น Admin (เงื่อนไขเดียวกับ cancelBooking ใน server)
  function canCancel(booking) {
    const ended = new Date(booking.end_at) <= new Date();
    return !ended && (booking.user_id === user.user_id || user.role === 'admin');
  }

  function submitForm(event) {
    event.preventDefault();
    if (startHour === '') {
      showError('กรุณาเลือกเวลาที่ต้องการจอง');
      return;
    }

    bookMutation.mutate({
      roomId: Number(roomId),
      date: date,
      start: hourLabel(startHour),
      end: hourLabel(endHour),
      purpose: purpose,
    });
  }

  return (
    <section className="admin-section">
      <h2>จองห้อง</h2>

      {loadError && <p className="error-message">{loadError}</p>}

      <div ref={timelineRef}>
        <RoomTimeline
          rooms={rooms}
          bookings={bookings}
          date={date}
          minDate={today}
          maxDate={maxDate}
          loading={roomsQuery.isLoading || bookingsQuery.isLoading}
          failed={Boolean(loadError)}
          userId={user.user_id}
          selection={
            startHour === '' ? null : { roomId: Number(roomId), startHour, endHour }
          }
          onChangeDate={changeDate}
        />
      </div>
      <form className="equipment-form" onSubmit={submitForm}>
        <div className="form-grid">
          <label>
            ห้อง
            <select value={roomId} onChange={(event) => changeRoom(event.target.value)} required>
              <option value="">-- เลือกห้อง --</option>
              {/* รายชื่อห้องมีห้องที่ปิดอยู่ด้วย (ไว้โชว์ในตารางเวลา) แต่จองได้เฉพาะห้องที่เปิด */}
              {rooms.filter((room) => room.is_active).map((room) => (
                <option key={room.room_id} value={room.room_id}>{room.room_name}</option>
              ))}
            </select>
          </label>
          <label>
            วันที่
            <ThaiDateInput
              value={date}
              min={today}
              max={maxDate}
              onChange={(event) => changeDate(event.target.value)}
              required
            />
          </label>
          <div className="field-wide hour-picker">
            <span className="hour-picker-label">เวลา (กดเลือกได้หลายชั่วโมงที่ติดกัน)</span>
            {roomId === '' ? (
              <p className="hour-picker-hint">เลือกห้องก่อน แล้วจะแสดงชั่วโมงที่ว่าง</p>
            ) : (
              <>
                <div className="hour-picker-grid" role="group" aria-label="เลือกชั่วโมงที่ต้องการจอง">
                  {HOURS.map((hour) => {
                    const booked = findBookingAt(bookings, Number(roomId), hour);
                    const started = isHourStarted(date, hour);
                    const selected = startHour !== '' && hour >= startHour && hour < endHour;

                    return (
                      <button
                        className={`hour-chip${selected ? ' selected' : ''}${booked ? ' booked' : ''}`}
                        type="button"
                        key={hour}
                        disabled={Boolean(booked) || started}
                        aria-pressed={selected}
                        onClick={() => toggleHour(hour)}
                      >
                        {hourLabel(hour)}–{hourLabel(hour + 1)}
                        {booked && <small>จองแล้ว</small>}
                        {!booked && started && <small>เลยเวลา</small>}
                      </button>
                    );
                  })}
                </div>
                <p className="hour-picker-summary">
                  {startHour === ''
                    ? 'ยังไม่ได้เลือกเวลา'
                    : `เลือกแล้ว ${hourLabel(startHour)}–${hourLabel(endHour)} น. (${endHour - startHour} ชั่วโมง)`}
                </p>
              </>
            )}
          </div>
          <label className="field-wide">
            วัตถุประสงค์ (ไม่บังคับ)
            <textarea
              rows="2"
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              maxLength={MAX_PURPOSE_LENGTH}
            />
            <CharCount length={purpose.length} max={MAX_PURPOSE_LENGTH} />
          </label>
        </div>
        <div className="form-actions">
          <button className="button-primary" type="submit" disabled={bookMutation.isPending}>
            {bookMutation.isPending ? 'กำลังจอง...' : 'จองห้อง'}
          </button>
        </div>
      </form>

      <MyRoomBookings
        cancelPending={cancelMutation.isPending}
        onRequestCancel={setConfirmBooking}
        onShowDate={showDate}
      />

      {/* ตารางการจองทั้งหมดของวันที่เลือก ข้อมูลชุดเดียวกับตารางเวลาด้านบน แต่มีปุ่มให้ Admin ยกเลิกการจองของใครก็ได้
          ผู้ใช้ทั่วไปดูวันนั้นจากตารางเวลา และดู/ยกเลิกของตัวเองจาก "การจองของฉัน" จึงโชว์เฉพาะ Admin */}
      {user.role === 'admin' && (
        <>
          <h3>การจองวันที่เลือก</h3>
          {bookingsQuery.isLoading ? (
            <p className="loading-message">กำลังโหลดการจอง...</p>
          ) : bookingsQuery.isError ? null : bookings.length === 0 ? (
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
                        {canCancel(booking) ? (
                          <div className="row-actions">
                            <button
                              className="button-danger"
                              type="button"
                              disabled={cancelMutation.isPending}
                              onClick={() => setConfirmBooking(booking)}
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ถามยืนยันก่อนยกเลิก เพราะยกเลิกแล้วการจองหายเลย ย้อนคืนไม่ได้ (รูปแบบเดียวกับ popup ยืนยันเบิกวัสดุ) */}
      {confirmBooking && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setConfirmBooking(null)}>
          <section
            className="withdraw-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-booking-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="cancel-booking-title">ยืนยันการยกเลิกการจอง</h2>
            <p>
              ยกเลิกการจอง {confirmBooking.room_name} วันที่ {formatDate(confirmBooking.start_at)} เวลา{' '}
              {formatTime(confirmBooking.start_at)}–{formatTime(confirmBooking.end_at)} น.
              {confirmBooking.user_id !== user.user_id && ` ของ ${confirmBooking.user_name}`} ใช่หรือไม่?
            </p>
            <div className="form-actions">
              <button
                className="button-primary"
                type="button"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(confirmBooking.booking_id)}
              >
                {cancelMutation.isPending ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
              </button>
              <button className="button-secondary" type="button" onClick={() => setConfirmBooking(null)}>
                กลับ
              </button>
            </div>
          </section>
        </div>
      )}

      {user.role === 'admin' && <RoomManager />}
    </section>
  );
}
