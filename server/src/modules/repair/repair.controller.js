import * as repairService from './repair.service.js';
import { AppError } from '../../utils/AppError.js';

export async function getRepairList(request, response, next) {
  try {
    const status = request.query.status || undefined;
    const itemId = request.query.item_id ? Number(request.query.item_id) : undefined;
    const repairs = await repairService.getRepairList({ status, itemId });

    response.status(200).json({ repairs });
  } catch (error) {
    next(error);
  }
}

// route ฝั่ง User (/api/repairs) ใส่ request.repairOwnerId ไว้ จำกัดให้เห็นเฉพาะรายการที่ตัวเองแจ้ง
export async function getMyRepairList(request, response, next) {
  try {
    const repairs = await repairService.getRepairList({ reportedBy: Number(request.user.sub) });

    response.status(200).json({ repairs });
  } catch (error) {
    next(error);
  }
}

export async function getRepairDetail(request, response, next) {
  try {
    const { repairId } = request.validated;
    const repair = await repairService.getRepairDetail(repairId, {
      ownerId: request.repairOwnerId,
    });

    response.status(200).json({ repair });
  } catch (error) {
    next(error);
  }
}

export async function reportRepair(request, response, next) {
  const files = request.files ?? [];

  try {
    const { itemId, issue } = request.validated;
    const repair = await repairService.reportRepair(
      itemId,
      issue,
      Number(request.user.sub),
      files,
    );

    response.status(201).json({ message: 'แจ้งซ่อมสำเร็จ', repair });
  } catch (error) {
    if (files.length > 0) await repairService.removeOrphanFiles(files);
    next(error);
  }
}

export async function addRepairFiles(request, response, next) {
  const files = request.files ?? [];

  try {
    const { repairId } = request.validated;
    const repair = await repairService.addRepairFiles(
      repairId,
      Number(request.user.sub),
      files,
    );

    response.status(200).json({ message: 'แนบไฟล์สำเร็จ', repair });
  } catch (error) {
    if (files.length > 0) await repairService.removeOrphanFiles(files);
    next(error);
  }
}

export async function downloadFile(request, response, next) {
  try {
    const { fileId } = request.validated;
    const file = await repairService.getFile(fileId, { ownerId: request.repairOwnerId });
    // client render เป็นลิงก์ target="_blank" ตั้งใจให้เปิดดูรูป/PDF ในแท็บใหม่ ไม่ใช่ดาวน์โหลด
    // ต้องใช้ inline แทน default ของ response.download() (attachment) ไม่งั้น browser เด้ง save ทุกครั้ง
    const safeFileName = String(file.file_name).replace(/["\r\n]/g, '');

    response.sendFile(file.absolutePath, {
      headers: {
        'Content-Disposition': `inline; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(file.file_name)}`,
        ...(file.file_type ? { 'Content-Type': file.file_type } : {}),
      },
    }, (sendError) => {
      // ผู้ใช้ปิดแท็บกลางทางก็เข้ามาตรงนี้ได้ ตอนนั้นส่ง header ไปแล้ว ไม่ต้องตอบอะไรอีก
      if (!sendError || response.headersSent) return;

      // ไม่ส่ง error ดิบของ send กลับไป เพราะข้อความมี path จริงบน server ติดมาด้วย
      next(
        sendError.code === 'ENOENT'
          ? new AppError(404, 'ไม่พบไฟล์แนบบนเซิร์ฟเวอร์ ไฟล์อาจถูกลบไปแล้ว')
          : new AppError(500, 'ไม่สามารถเปิดไฟล์แนบได้', { cause: sendError }),
      );
    });
  } catch (error) {
    next(error);
  }
}

export async function startRepair(request, response, next) {
  try {
    const { repairId } = request.validated;
    const repair = await repairService.startRepair(repairId, Number(request.user.sub));

    response.status(200).json({ message: 'เริ่มซ่อมแล้ว', repair });
  } catch (error) {
    next(error);
  }
}

export async function completeRepair(request, response, next) {
  try {
    const { repairId, repairDetail, repairCost } = request.validated;
    const repair = await repairService.completeRepair(
      repairId,
      { repairDetail, repairCost },
      Number(request.user.sub),
    );

    response.status(200).json({ message: 'บันทึกผลการซ่อมสำเร็จ', repair });
  } catch (error) {
    next(error);
  }
}

export async function cancelRepair(request, response, next) {
  try {
    const { repairId } = request.validated;
    const repair = await repairService.cancelRepair(repairId, Number(request.user.sub));

    response.status(200).json({ message: 'ยกเลิกการแจ้งซ่อมแล้ว', repair });
  } catch (error) {
    next(error);
  }
}
