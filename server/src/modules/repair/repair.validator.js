// ตรวจรูปแบบ input สำหรับ endpoint แจ้งซ่อมครุภัณฑ์
import { AppError } from '../../utils/AppError.js';

export function validateReportRepair(request, _response, next) {
  const body = request.body ?? {};
  const itemId = Number(body.item_id);
  const issue = String(body.issue ?? '').trim();

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return next(new AppError(400, 'กรุณาเลือกครุภัณฑ์ที่จะแจ้งซ่อม'));
  }

  if (!issue) {
    return next(new AppError(400, 'กรุณาระบุอาการ/ปัญหาที่พบ'));
  }

  request.validated = { ...request.validated, itemId, issue };
  next();
}

export function validateCompleteRepair(request, _response, next) {
  const body = request.body ?? {};
  const repairDetail = String(body.repair_detail ?? '').trim();
  const costValue = body.repair_cost;
  const repairCost =
    costValue == null || costValue === '' ? null : Number(costValue);

  if (!repairDetail) {
    return next(new AppError(400, 'กรุณาระบุรายละเอียดผลการซ่อม'));
  }

  if (repairCost !== null && (Number.isNaN(repairCost) || repairCost < 0)) {
    return next(new AppError(400, 'ค่าใช้จ่ายในการซ่อมไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, repairDetail, repairCost };
  next();
}

export function validateRepairIdParam(request, _response, next) {
  const repairId = Number(request.params.id);

  if (!Number.isInteger(repairId) || repairId <= 0) {
    return next(new AppError(400, 'รหัสรายการแจ้งซ่อมไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, repairId };
  next();
}

export function validateFileIdParam(request, _response, next) {
  const fileId = Number(request.params.fileId);

  if (!Number.isInteger(fileId) || fileId <= 0) {
    return next(new AppError(400, 'รหัสไฟล์ไม่ถูกต้อง'));
  }

  request.validated = { ...request.validated, fileId };
  next();
}
