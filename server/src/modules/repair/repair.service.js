// Business Logic สำหรับแจ้งซ่อมครุภัณฑ์ — คุม transaction เอง (เหมือน borrow.service.js)
//
// Flow: แจ้งซ่อม (reportRepair) ครุภัณฑ์ต้องว่าง (available) เท่านั้น -> equipment เปลี่ยนเป็น pending_repair ->
// เริ่มซ่อม (startRepair) -> equipment เปลี่ยนเป็น repairing -> ซ่อมเสร็จ (completeRepair) -> equipment กลับ
// เป็น available หรือยกเลิกแจ้งซ่อมได้ก่อนเสร็จ (cancelRepair) -> equipment กลับเป็น available เช่นกัน
import fs from 'node:fs/promises';
import path from 'node:path';

import * as repairRepository from './repair.repository.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import * as equipmentHistoryRepository from '../equipment/equipment-history.repository.js';
import * as equipmentRepository from '../equipment/equipment.repository.js';
import { repairUploadDir } from '../../middlewares/upload.middleware.js';

// Serializable ทดแทน SELECT ... FOR UPDATE เดิม และ retry เมื่อชนกัน (เหมือน borrow.service.js/equipment.service.js)
async function runSerializableTransaction(callback) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: 'Serializable',
        maxWait: 5_000,
        timeout: 10_000,
      });
    } catch (error) {
      if (error.code !== 'P2034' || attempt === 3) throw error;
    }
  }

  throw new Error(
    'Transaction failed after 3 attempts due to serialization conflicts (P2034)',
  );
}

function serializeFile(file) {
  return {
    file_id: file.file_id,
    file_name: file.file_name,
    file_type: file.file_type,
    url: `/api/admin/repairs/files/${file.file_id}`,
  };
}

function serializeRepair(repair) {
  return {
    repair_id: repair.repair_id,
    item_id: repair.item_id,
    equipment_code: repair.equipment_items?.equipment_code ?? null,
    equipment_name: repair.equipment_items?.equipment_name ?? null,
    reported_by: repair.reported_by,
    reporter_name: repair.users?.name ?? null,
    issue: repair.issue,
    repair_detail: repair.repair_detail,
    repair_cost: repair.repair_cost === null ? null : repair.repair_cost.toString(),
    repair_date: repair.repair_date,
    status: repair.status,
    files: (repair.repair_files ?? []).map(serializeFile),
  };
}

export async function getRepairList({ status, itemId } = {}) {
  try {
    const repairs = await repairRepository.findMany({ status, itemId });
    return repairs.map(serializeRepair);
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดรายการแจ้งซ่อมได้', { cause: error });
  }
}

async function getSerializedById(repairId) {
  const repair = await repairRepository.findById(repairId);
  if (!repair) throw new AppError(404, 'ไม่พบรายการแจ้งซ่อม');
  return serializeRepair(repair);
}

export async function getRepairDetail(repairId) {
  return getSerializedById(repairId);
}

function toFileRecords(repairId, files) {
  return files.map((file) => ({
    repair_id: repairId,
    file_name: file.originalname,
    file_path: file.filename,
    file_type: file.mimetype,
  }));
}

export async function reportRepair(itemId, issue, actorId, files = []) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const item = await equipmentRepository.findByItemId(itemId, {
        client: tx,
      });

      if (!item) return { error: 'ไม่พบครุภัณฑ์', status: 404 };
      if (item.status !== 'available') {
        return {
          error: 'แจ้งซ่อมได้เฉพาะครุภัณฑ์ที่มีสถานะพร้อมใช้งานเท่านั้น',
          status: 409,
        };
      }

      const repair = await repairRepository.create(
        { item_id: itemId, reported_by: actorId, issue, status: 'pending_repair' },
        tx,
      );

      if (files.length > 0) {
        await repairRepository.createFiles(toFileRecords(repair.repair_id, files), tx);
      }

      await equipmentRepository.updateEquipmentItem(
        itemId,
        { status: 'pending_repair' },
        tx,
      );

      await equipmentHistoryRepository.create(
        {
          itemId,
          action: 'status_changed',
          oldData: { status: 'available' },
          newData: { status: 'pending_repair', repair_id: repair.repair_id },
          changedBy: actorId,
        },
        tx,
      );

      return { repairId: repair.repair_id };
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return getSerializedById(result.repairId);
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error.code === 'P2003') {
      throw new AppError(400, 'ไม่พบครุภัณฑ์ที่เลือก');
    }

    throw new AppError(500, 'ไม่สามารถแจ้งซ่อมได้', { cause: error });
  }
}

export async function addRepairFiles(repairId, actorId, files) {
  try {
    const repair = await repairRepository.findById(repairId);
    if (!repair) throw new AppError(404, 'ไม่พบรายการแจ้งซ่อม');
    if (files.length === 0) {
      throw new AppError(400, 'กรุณาเลือกไฟล์ที่จะแนบ');
    }

    await repairRepository.createFiles(toFileRecords(repairId, files));

    return getSerializedById(repairId);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถแนบไฟล์ได้', { cause: error });
  }
}

export async function getFile(fileId) {
  const file = await repairRepository.findFileById(fileId);
  if (!file) throw new AppError(404, 'ไม่พบไฟล์แนบ');

  return { ...file, absolutePath: path.join(repairUploadDir, file.file_path) };
}

export async function startRepair(repairId, actorId) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const repair = await repairRepository.findById(repairId, tx);

      if (!repair) return { error: 'ไม่พบรายการแจ้งซ่อม', status: 404 };
      if (repair.status !== 'pending_repair') {
        return { error: 'รายการนี้ไม่ได้อยู่ในสถานะรอซ่อม', status: 400 };
      }

      await repairRepository.update(repairId, { status: 'repairing' }, tx);
      await equipmentRepository.updateEquipmentItem(
        repair.item_id,
        { status: 'repairing' },
        tx,
      );

      await equipmentHistoryRepository.create(
        {
          itemId: repair.item_id,
          action: 'status_changed',
          oldData: { status: 'pending_repair' },
          newData: { status: 'repairing', repair_id: repairId },
          changedBy: actorId,
        },
        tx,
      );

      return {};
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return getSerializedById(repairId);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถเริ่มซ่อมได้', { cause: error });
  }
}

export async function completeRepair(repairId, { repairDetail, repairCost }, actorId) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const repair = await repairRepository.findById(repairId, tx);

      if (!repair) return { error: 'ไม่พบรายการแจ้งซ่อม', status: 404 };
      if (repair.status !== 'repairing') {
        return { error: 'ต้องเริ่มซ่อมก่อนถึงจะบันทึกว่าซ่อมเสร็จได้', status: 400 };
      }

      await repairRepository.update(
        repairId,
        { status: 'completed', repair_detail: repairDetail, repair_cost: repairCost },
        tx,
      );
      await equipmentRepository.updateEquipmentItem(
        repair.item_id,
        { status: 'available' },
        tx,
      );

      await equipmentHistoryRepository.create(
        {
          itemId: repair.item_id,
          action: 'status_changed',
          oldData: { status: 'repairing' },
          newData: { status: 'available', repair_id: repairId },
          changedBy: actorId,
        },
        tx,
      );

      return {};
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return getSerializedById(repairId);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถบันทึกว่าซ่อมเสร็จได้', { cause: error });
  }
}

export async function cancelRepair(repairId, actorId) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const repair = await repairRepository.findById(repairId, tx);

      if (!repair) return { error: 'ไม่พบรายการแจ้งซ่อม', status: 404 };
      if (repair.status === 'completed' || repair.status === 'cancelled') {
        return { error: 'รายการนี้ถูกดำเนินการเสร็จสิ้นไปแล้ว', status: 400 };
      }

      const previousStatus = repair.status;

      await repairRepository.update(repairId, { status: 'cancelled' }, tx);
      await equipmentRepository.updateEquipmentItem(
        repair.item_id,
        { status: 'available' },
        tx,
      );

      await equipmentHistoryRepository.create(
        {
          itemId: repair.item_id,
          action: 'status_changed',
          oldData: { status: previousStatus },
          newData: { status: 'available', repair_id: repairId },
          changedBy: actorId,
        },
        tx,
      );

      return {};
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return getSerializedById(repairId);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถยกเลิกการแจ้งซ่อมได้', { cause: error });
  }
}

// เผื่อ multer เขียนไฟล์ลง disk สำเร็จแต่ transaction ก่อนหน้าล้มเหลว (เช่นครุภัณฑ์ไม่ว่างแล้ว) ต้องลบไฟล์กำพร้าทิ้ง
export async function removeOrphanFiles(files) {
  await Promise.all(
    files.map((file) =>
      fs.unlink(path.join(repairUploadDir, file.filename)).catch(() => {}),
    ),
  );
}
