// Popup จองต่อเนื่อง (เฉพาะ Admin) เช่น วิชาที่เรียนทุกวันจันทร์ 09:00–12:00 ห้องเดิมตลอดภาคเรียน
// ขั้นตอน: กรอกห้อง/ช่วงวันที่/วันในสัปดาห์/เวลา -> "ตรวจสอบวันว่าง" ดูว่าจองได้กี่ครั้ง วันไหนชน
// -> "ยืนยันจอง" จองทุกวันที่ว่างในครั้งเดียว วันที่มีคนจองไว้แล้วข้ามไป (ไม่จองทับ)
// แก้ช่องไหนก็ตามหลังตรวจสอบแล้ว ผลตรวจสอบเดิมจะถูกล้าง ต้องตรวจใหม่ก่อนจอง จะได้ไม่จองจากผลที่ไม่ตรงกับฟอร์ม
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { createRoomBookingSeries, previewRoomBookingSeries } from '../../../api/rooms.js';
import CharCount from '../../../components/CharCount.jsx';
import ThaiDateInput from '../../../components/ThaiDateInput.jsx';
import { useToast } from '../../../components/ToastProvider.jsx';
import { useModal } from '../../../hooks/useModal.js';
import {
  CLOSE_HOUR,
  HOURS,
  addDays,
  formatDate,
  formatSlot,
  hourLabel,
  todayDateInput,
} from '../../../utils/roomBooking.js';

// ต้องตรงกับ server (room.validator.js): จองต่อเนื่องล่วงหน้าได้ไม่เกิน 183 วัน วัตถุประสงค์ไม่เกิน 2000 ตัวอักษร
const MAX_SERIES_DAYS_AHEAD = 183;
const MAX_PURPOSE_LENGTH = 2000;

// เรียงจันทร์ -> อาทิตย์ตามปฏิทินไทย ค่า value ตาม Date.getDay() (0 = อาทิตย์) ที่ server ใช้
const WEEKDAYS = [
  { value: 1, label: 'จ.' },
  { value: 2, label: 'อ.' },
  { value: 3, label: 'พ.' },
  { value: 4, label: 'พฤ.' },
  { value: 5, label: 'ศ.' },
  { value: 6, label: 'ส.' },
  { value: 0, label: 'อา.' },
];

export default function RoomSeriesDialog({ rooms, onClose }) {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  const today = todayDateInput();
  const maxDate = addDays(today, MAX_SERIES_DAYS_AHEAD);

  const [roomId, setRoomId] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [weekdays, setWeekdays] = useState([]);
  const [startHour, setStartHour] = useState('');
  const [endHour, setEndHour] = useState('');
  const [purpose, setPurpose] = useState('');
  // ผลตรวจสอบวันว่างของค่าในฟอร์มตอนนี้ (null = ยังไม่ได้ตรวจ หรือแก้ฟอร์มหลังตรวจ)
  const [preview, setPreview] = useState(null);

  // ระหว่างตรวจสอบ/จองอยู่ไม่ให้ Esc ปิด (เหมือนปุ่มปิดที่ถูกปิดไว้) จะได้ไม่เสียผลกลางทาง
  const dialogRef = useModal(() => {
    if (!busy) onClose();
  });

  function series() {
    return {
      roomId: Number(roomId),
      startDate,
      endDate,
      weekdays,
      start: hourLabel(Number(startHour)),
      end: hourLabel(Number(endHour)),
      purpose,
    };
  }

  // ทุกช่องเรียกผ่านตัวนี้ เปลี่ยนค่าแล้วผลตรวจสอบเดิมใช้ไม่ได้อีก
  function change(setter) {
    return (value) => {
      setter(value);
      setPreview(null);
    };
  }

  function toggleWeekday(value) {
    change(setWeekdays)(
      weekdays.includes(value) ? weekdays.filter((day) => day !== value) : [...weekdays, value],
    );
  }

  const previewMutation = useMutation({
    mutationFn: () => previewRoomBookingSeries(series()),
    onSuccess: (data) => setPreview(data),
    onError: (error) => showError(error.message),
  });

  const createMutation = useMutation({
    mutationFn: () => createRoomBookingSeries(series()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['room-bookings'] });
      showSuccess(data.message);
      onClose();
    },
    onError: (error) => {
      // ระหว่างดูตัวอย่างกับกดยืนยันอาจมีคนจองแทรกเข้ามา ล้างผลเดิมให้ตรวจใหม่
      setPreview(null);
      showError(error.message);
    },
  });

  function submitPreview(event) {
    event.preventDefault();
    if (weekdays.length === 0) {
      showError('กรุณาเลือกวันในสัปดาห์อย่างน้อย 1 วัน');
      return;
    }
    previewMutation.mutate();
  }

  const busy = previewMutation.isPending || createMutation.isPending;
  const activeRooms = rooms.filter((room) => room.is_active);
  // เวลาสิ้นสุดต้องหลังเวลาเริ่ม ตัวเลือกจึงเริ่มจากชั่วโมงถัดไป
  const endHourOptions = HOURS.map((hour) => hour + 1).filter(
    (hour) => startHour === '' || hour > Number(startHour),
  );

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={busy ? undefined : onClose}>
      <section
        className="repair-dialog"
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
        tabIndex={-1}
        aria-labelledby="room-series-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="form-heading">
          <div>
            <p className="section-kicker">Recurring booking</p>
            <h2 id="room-series-title">จองต่อเนื่อง</h2>
          </div>
          <button className="button-secondary" type="button" onClick={onClose} disabled={busy}>
            ปิด
          </button>
        </div>

        <form onSubmit={submitPreview}>
          <div className="form-grid">
            <label className="field-wide">
              ห้อง
              <select
                value={roomId}
                onChange={(event) => change(setRoomId)(event.target.value)}
                required
              >
                <option value="">-- เลือกห้อง --</option>
                {activeRooms.map((room) => (
                  <option key={room.room_id} value={room.room_id}>
                    {room.room_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              ตั้งแต่วันที่
              <ThaiDateInput
                value={startDate}
                min={today}
                max={maxDate}
                onChange={(event) => change(setStartDate)(event.target.value)}
                required
              />
            </label>

            <label>
              ถึงวันที่
              <ThaiDateInput
                value={endDate}
                min={startDate || today}
                max={maxDate}
                onChange={(event) => change(setEndDate)(event.target.value)}
                required
              />
            </label>

            <fieldset className="field-wide weekday-picker">
              <legend>ทุกวัน (เลือกได้หลายวัน)</legend>
              {WEEKDAYS.map((day) => (
                <label key={day.value} className="weekday-option">
                  <input
                    type="checkbox"
                    checked={weekdays.includes(day.value)}
                    onChange={() => toggleWeekday(day.value)}
                  />
                  {day.label}
                </label>
              ))}
            </fieldset>

            <label>
              เวลาเริ่ม
              <select
                value={startHour}
                onChange={(event) => {
                  const next = event.target.value;
                  change(setStartHour)(next);
                  // เวลาสิ้นสุดเดิมไม่หลังเวลาเริ่มใหม่แล้ว ให้เลือกใหม่
                  if (endHour !== '' && Number(endHour) <= Number(next)) setEndHour('');
                }}
                required
              >
                <option value="">-- เลือก --</option>
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {hourLabel(hour)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              เวลาสิ้นสุด
              <select
                value={endHour}
                onChange={(event) => change(setEndHour)(event.target.value)}
                required
              >
                <option value="">-- เลือก --</option>
                {endHourOptions.map((hour) => (
                  <option key={hour} value={hour}>
                    {hourLabel(hour)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-wide">
              วัตถุประสงค์ (ไม่บังคับ เช่น รหัสและชื่อวิชา)
              <textarea
                rows="2"
                value={purpose}
                onChange={(event) => change(setPurpose)(event.target.value)}
                maxLength={MAX_PURPOSE_LENGTH}
              />
              <CharCount length={purpose.length} max={MAX_PURPOSE_LENGTH} />
            </label>
          </div>

          <p className="user-note">
            จองได้ระหว่าง {hourLabel(HOURS[0])}–{hourLabel(CLOSE_HOUR)} น. ล่วงหน้าไม่เกิน 6 เดือน
            วันที่มีคนจองไว้แล้วจะข้ามไป ไม่จองทับ
          </p>

          {!preview && (
            <div className="form-actions">
              <button className="button-primary" type="submit" disabled={busy}>
                {previewMutation.isPending ? 'กำลังตรวจสอบ...' : 'ตรวจสอบวันว่าง'}
              </button>
            </div>
          )}
        </form>

        {preview && (
          <div className="series-preview">
            <p className="series-preview-summary">
              {preview.room_name} จองได้ <strong>{preview.bookable.length} ครั้ง</strong>
              {preview.conflicts.length > 0 && (
                <>
                  {' '}
                  · ข้าม <strong>{preview.conflicts.length} วัน</strong> ที่มีการจองอยู่แล้ว
                </>
              )}
            </p>

            {preview.bookable.length > 0 && (
              <ul className="series-date-list" aria-label="วันที่จะจอง">
                {preview.bookable.map((occurrence) => (
                  <li key={occurrence.date}>{formatDate(occurrence.start_at)}</li>
                ))}
              </ul>
            )}

            {preview.conflicts.length > 0 && (
              <>
                <h3 className="series-conflict-heading">วันที่ข้าม (มีการจองอยู่แล้ว)</h3>
                <ul className="series-conflict-list">
                  {preview.conflicts.map((conflict) => (
                    <li key={conflict.date}>
                      {formatDate(conflict.booking.start_at)}{' '}
                      {formatSlot(conflict.booking.start_at, conflict.booking.end_at)} —{' '}
                      {conflict.booking.user_name}
                      {conflict.booking.purpose && ` (${conflict.booking.purpose})`}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="form-actions">
              <button
                className="button-primary"
                type="button"
                disabled={busy || preview.bookable.length === 0}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending
                  ? 'กำลังจอง...'
                  : `ยืนยันจอง ${preview.bookable.length} ครั้ง`}
              </button>
              <button
                className="button-secondary"
                type="button"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                แก้ไข
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
