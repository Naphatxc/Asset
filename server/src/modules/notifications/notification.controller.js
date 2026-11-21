import * as userRepository from '../users/user.repository.js';
import { AppError } from '../../utils/AppError.js';
import * as notificationService from './notification.service.js';

export async function getSettings(_request, response, next) {
  try {
    response.status(200).json(await notificationService.getSettings());
  } catch (error) {
    next(error);
  }
}

export async function updateSetting(request, response, next) {
  try {
    const { eventKey, ...input } = request.validated;
    const event = await notificationService.updateSetting(
      eventKey,
      input,
      Number(request.user.sub),
    );

    response.status(200).json({ message: `บันทึกการตั้งค่า "${event.label}" แล้ว`, event });
  } catch (error) {
    next(error);
  }
}

export async function resetSetting(request, response, next) {
  try {
    const event = await notificationService.resetSetting(request.validated.eventKey);

    response.status(200).json({ message: `คืนค่าเริ่มต้นของ "${event.label}" แล้ว`, event });
  } catch (error) {
    next(error);
  }
}

export function previewTemplate(request, response, next) {
  try {
    const { eventKey, subject, body } = request.validated;

    response.status(200).json({ preview: notificationService.previewTemplate(eventKey, { subject, body }) });
  } catch (error) {
    next(error);
  }
}

// ส่งอีเมลทดสอบถึง Admin ที่กดปุ่มเอง (ไม่รับอีเมลปลายทางจาก request กันใช้หน้านี้ยิงอีเมลหาคนอื่น)
export async function sendTestEmail(request, response, next) {
  try {
    const { eventKey, subject, body } = request.validated;
    const admin = await userRepository.findById(Number(request.user.sub));
    if (!admin) throw new AppError(401, 'ไม่พบบัญชีผู้ใช้');

    const result = await notificationService.sendTestEmail(eventKey, { subject, body }, admin);

    response.status(200).json({
      message: result.live
        ? `ส่งอีเมลทดสอบไปที่ ${result.to} แล้ว`
        : 'โหมดพัฒนา: ยังไม่ได้ตั้งค่า Brevo จึงพิมพ์อีเมลทดสอบลง console ของเซิร์ฟเวอร์แทน',
      ...result,
    });
  } catch (error) {
    next(error);
  }
}
