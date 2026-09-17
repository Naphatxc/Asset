import * as equipmentService from './equipment.service.js';
import { allowedStatuses } from './equipment.validator.js';

// page/limit กันค่าแปลกจาก query string (NaN, ติดลบ, limit ใหญ่เกินไป) และ status ต้องอยู่ใน allowedStatuses เท่านั้น
// ไม่งั้น Prisma throw เพราะ status เป็น enum ฝั่ง DB
// เพดานตั้งไว้ 500 ให้พอกับตอน client ขอทั้งหมดมาทำ picklist เลือกยืม/แจ้งซ่อม (ดู BorrowManager/RepairManager/
// MyBorrows.jsx ที่ยิง limit:500) ไม่งั้นจะโดนตัดเงียบๆ เหลือ 100 ชิ้นแรกโดยไม่มีอะไรแจ้งว่าข้อมูลไม่ครบ
function parseListQuery(query) {
  const page = Math.max(1, Math.trunc(Number(query.page)) || 1);
  const limit = Math.min(500, Math.max(1, Math.trunc(Number(query.limit)) || 20));
  const search = String(query.search ?? '').trim() || undefined;
  const statusInput = String(query.status ?? '').trim();
  const status = allowedStatuses.includes(statusInput) ? statusInput : undefined;

  return { page, limit, search, status };
}

export async function getEquipmentList(request, response, next) {
  try {
    const result = await equipmentService.getEquipmentList(
      parseListQuery(request.query),
    );

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getEquipmentByCode(request, response, next) {
  try {
    const equipmentCode = String(request.params.code ?? '')
      .trim()
      .toUpperCase();
    const equipment =
      await equipmentService.getEquipmentByCode(equipmentCode);

    response.status(200).json({ equipment });
  } catch (error) {
    next(error);
  }
}

export async function getDeletedEquipmentList(request, response, next) {
  try {
    const result = await equipmentService.getDeletedEquipmentList(
      parseListQuery(request.query),
    );

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getEquipmentHistory(request, response, next) {
  try {
    const { itemId } = request.validated;
    const history = await equipmentService.getEquipmentHistory(itemId);

    response.status(200).json({ history });
  } catch (error) {
    next(error);
  }
}

export async function createEquipment(request, response, next) {
  try {
    const equipment = await equipmentService.createEquipment(
      request.validated,
      Number(request.user.sub),
    );

    response.status(201).json({
      message: 'เพิ่มครุภัณฑ์สำเร็จ',
      equipment,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEquipmentStatus(request, response, next) {
  try {
    const { itemId, status } = request.validated;
    const result = await equipmentService.updateEquipmentStatus(
      itemId,
      status,
      Number(request.user.sub),
    );

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function restoreEquipment(request, response, next) {
  try {
    const { itemId } = request.validated;
    const equipment = await equipmentService.restoreEquipment(
      itemId,
      Number(request.user.sub),
    );

    response.status(200).json({
      message: 'กู้คืนครุภัณฑ์สำเร็จ',
      equipment,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteEquipment(request, response, next) {
  try {
    const { itemId } = request.validated;
    const equipment = await equipmentService.deleteEquipment(
      itemId,
      Number(request.user.sub),
    );

    response.status(200).json({
      message: 'ลบครุภัณฑ์สำเร็จ',
      equipment,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEquipment(request, response, next) {
  try {
    const { itemId, body } = request.validated;
    const equipment = await equipmentService.updateEquipment(
      itemId,
      body,
      Number(request.user.sub),
    );

    response.status(200).json({
      message: 'แก้ไขครุภัณฑ์สำเร็จ',
      equipment,
    });
  } catch (error) {
    next(error);
  }
}
