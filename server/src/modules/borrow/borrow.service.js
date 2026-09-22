// Business Logic สำหรับยืม-คืนครุภัณฑ์ — คุม transaction เอง (เหมือน equipment.service.js) เพราะต้องเช็คว่า
// ครุภัณฑ์ทุกชิ้นในใบยืมว่างพร้อมกันแบบ atomic ถ้าชิ้นใดชิ้นหนึ่งไม่ว่างต้อง rollback ทั้งใบ ไม่ใช่สำเร็จบางส่วน
//
// Flow ตาม spec: User ส่งคำขอ (requestBorrow) -> status 'pending' ครุภัณฑ์ยังไม่ถูกล็อก ->
// Admin อนุมัติ (approveBorrow) -> ครุภัณฑ์เปลี่ยนเป็น borrowed หรือ ปฏิเสธ (rejectBorrow) -> จบ ไม่แตะครุภัณฑ์
// ส่วน Admin สร้างใบยืมเอง (createBorrow) ถือว่าอนุมัติทันที ข้าม pending ไปเลย
import * as borrowRepository from './borrow.repository.js';
import { AppError } from '../../utils/AppError.js';
import { runSerializableTransaction } from '../../utils/transaction.js';
import * as equipmentHistoryRepository from '../equipment/equipment-history.repository.js';
import * as equipmentRepository from '../equipment/equipment.repository.js';
import * as userRepository from '../users/user.repository.js';

// return_date เก็บเป็น 00:00:00 UTC ของ "วันที่ครบกำหนด" (ดู utils/parsing.js: toDate ตัด T00:00:00.000Z ต่อท้าย)
// แต่ผู้ใช้ทุกคนอยู่ที่ไทย (UTC+7) วันครบกำหนดจริงๆ จึงสิ้นสุดตอนเที่ยงคืนเวลาไทย = 17:00 UTC ของวันเดียวกัน
// ถ้าเทียบกับ UTC midnight ตรงๆ จะกลายเป็นเกินกำหนดตั้งแต่ 07:00 เวลาไทยของวันครบกำหนดเอง (เร็วไป 17 ชม.)
const THAILAND_UTC_OFFSET_HOURS = 7;

function isPastDueDate(returnDate) {
  const endOfDueDateUtc = new Date(
    returnDate.getTime() + (24 - THAILAND_UTC_OFFSET_HOURS) * 60 * 60 * 1000,
  );

  return new Date() > endOfDueDateUtc;
}

// สถานะต่อชิ้นขึ้นกับสถานะใบยืมก่อน (pending/rejected ยังไม่มีอะไรให้ derive จาก return_date/returned_at)
// approved แล้วค่อย derive จาก return_date/return_requested_at/returned_at ไม่เก็บเป็น column แยกกันข้อมูลไม่ตรงกัน
function deriveDetailStatus(borrow, detail) {
  if (borrow.status === 'pending') return 'pending';
  if (borrow.status === 'rejected') return 'rejected';
  if (detail.returned_at) return 'returned';
  if (detail.return_requested_at) return 'pending_return';
  return isPastDueDate(detail.return_date) ? 'overdue' : 'borrowed';
}

function serializeDetail(borrow, detail) {
  return {
    borrow_detail_id: detail.borrow_detail_id,
    item_id: detail.item_id,
    equipment_code: detail.equipment_items?.equipment_code ?? null,
    equipment_name: detail.equipment_items?.equipment_name ?? null,
    return_date: detail.return_date,
    return_requested_at: detail.return_requested_at,
    returned_at: detail.returned_at,
    returned_by_name: detail.returned_user?.name ?? null,
    returned_by_email: detail.returned_user?.email ?? null,
    status: deriveDetailStatus(borrow, detail),
  };
}

function serializeBorrow(borrow) {
  return {
    borrow_id: borrow.borrow_id,
    user_id: borrow.user_id,
    user_name: borrow.users?.name ?? null,
    user_email: borrow.users?.email ?? null,
    borrow_date: borrow.borrow_date,
    status: borrow.status,
    remark: borrow.remark,
    details: borrow.borrow_details.map((detail) =>
      serializeDetail(borrow, detail),
    ),
  };
}

export async function getBorrowList() {
  try {
    const borrows = await borrowRepository.findMany();
    return borrows.map(serializeBorrow);
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดรายการยืมได้', { cause: error });
  }
}

export async function getMyBorrowList(userId) {
  try {
    const borrows = await borrowRepository.findManyByUserId(userId);
    return borrows.map(serializeBorrow);
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดรายการยืมของคุณได้', {
      cause: error,
    });
  }
}

// เช็คว่าทุกชิ้นว่างอยู่ก่อนสร้างอะไรเลย คืน error object ถ้าเจอชิ้นไหนไม่ว่าง (ไม่ throw เพื่อให้ caller ตัดสินใจ rollback เอง)
// query รวดเดียวแทนวนทีละชิ้น เพราะอยู่ใน Serializable transaction ยิ่งถือ lock นานยิ่งเสี่ยงชนกัน/timeout
async function checkItemsAvailable(itemIds, tx) {
  const items = await equipmentRepository.findManyByItemIds(itemIds, tx);
  const itemById = new Map(items.map((item) => [item.item_id, item]));

  for (const itemId of itemIds) {
    const item = itemById.get(itemId);

    if (!item) {
      return { error: `ไม่พบครุภัณฑ์รหัส ${itemId}`, status: 404 };
    }
    // ลบครุภัณฑ์ไม่ได้เช็คคำขอยืมที่ยังรออนุมัติ คำขอจึงค้างอยู่ได้ ต้องกันตอนอนุมัติ ไม่งั้นของที่ลบไปแล้วจะถูกยืมออกไป
    if (item.deleted_at) {
      return {
        error: `ครุภัณฑ์ ${item.equipment_name} ถูกลบออกจากระบบแล้ว`,
        status: 409,
      };
    }
    if (item.status !== 'available') {
      return {
        error: `ครุภัณฑ์ ${item.equipment_name} ไม่ว่างให้ยืม`,
        status: 409,
      };
    }
  }

  return null;
}

async function lockItemsAsBorrowed(itemIds, borrowId, actorId, tx) {
  await equipmentRepository.updateManyStatus(itemIds, 'borrowed', tx);

  await equipmentHistoryRepository.createMany(
    itemIds.map((itemId) => ({
      itemId,
      action: 'status_changed',
      oldData: { status: 'available' },
      newData: { status: 'borrowed', borrow_id: borrowId },
      changedBy: actorId,
    })),
    tx,
  );
}

// Admin สร้างใบยืมแทนผู้ใช้ ถือว่าอนุมัติทันที (ข้าม pending) ครุภัณฑ์ถูกล็อกเป็น borrowed ทันที
export async function createBorrow(userId, returnDate, itemIds, actorId, remark) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const availabilityError = await checkItemsAvailable(itemIds, tx);
      if (availabilityError) return availabilityError;

      const borrow = await borrowRepository.create(
        { user_id: userId, borrow_date: new Date(), status: 'approved', remark },
        tx,
      );

      await borrowRepository.createManyDetails(
        itemIds.map((itemId) => ({
          borrow_id: borrow.borrow_id,
          item_id: itemId,
          return_date: returnDate,
        })),
        tx,
      );

      await lockItemsAsBorrowed(itemIds, borrow.borrow_id, actorId, tx);

      return { borrow: await borrowRepository.findById(borrow.borrow_id, tx) };
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return serializeBorrow(result.borrow);
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error.code === 'P2003') {
      throw new AppError(400, 'ไม่พบผู้ยืมหรือครุภัณฑ์ที่เลือก');
    }

    throw new AppError(500, 'ไม่สามารถบันทึกการยืมได้', { cause: error });
  }
}

// User ส่งคำขอยืมเอง -> status 'pending' ไม่แตะสถานะครุภัณฑ์ รอ Admin อนุมัติก่อนถึงจะล็อกเป็น borrowed
export async function requestBorrow(userId, returnDate, itemIds, remark) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const availabilityError = await checkItemsAvailable(itemIds, tx);
      if (availabilityError) return availabilityError;

      const borrow = await borrowRepository.create(
        { user_id: userId, borrow_date: new Date(), status: 'pending', remark },
        tx,
      );

      await borrowRepository.createManyDetails(
        itemIds.map((itemId) => ({
          borrow_id: borrow.borrow_id,
          item_id: itemId,
          return_date: returnDate,
        })),
        tx,
      );

      return { borrow: await borrowRepository.findById(borrow.borrow_id, tx) };
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return serializeBorrow(result.borrow);
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error.code === 'P2003') {
      throw new AppError(400, 'ไม่พบผู้ยืมหรือครุภัณฑ์ที่เลือก');
    }

    throw new AppError(500, 'ไม่สามารถส่งคำขอยืมได้', { cause: error });
  }
}

// Admin อนุมัติคำขอ -> เช็คความพร้อมของครุภัณฑ์อีกครั้ง (เวลาผ่านไปตั้งแต่ส่งคำขออาจมีคนอื่นยืมไปก่อน) แล้วค่อยล็อกเป็น borrowed
export async function approveBorrow(borrowId, actorId) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const borrow = await borrowRepository.findById(borrowId, tx);

      if (!borrow) return { error: 'ไม่พบคำขอยืม', status: 404 };
      if (borrow.status !== 'pending') {
        return { error: 'คำขอนี้ถูกดำเนินการไปแล้ว', status: 400 };
      }

      const itemIds = borrow.borrow_details.map((detail) => detail.item_id);
      const availabilityError = await checkItemsAvailable(itemIds, tx);
      if (availabilityError) return availabilityError;

      await lockItemsAsBorrowed(itemIds, borrowId, actorId, tx);
      await borrowRepository.updateStatus(borrowId, 'approved', tx);

      return { borrow: await borrowRepository.findById(borrowId, tx) };
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return serializeBorrow(result.borrow);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถอนุมัติคำขอยืมได้', { cause: error });
  }
}

// Admin ปฏิเสธคำขอ -> ไม่เคยแตะสถานะครุภัณฑ์มาก่อน จึงแค่เปลี่ยน status ใบยืมพอ
export async function rejectBorrow(borrowId) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const borrow = await borrowRepository.findById(borrowId, tx);

      if (!borrow) return { error: 'ไม่พบคำขอยืม', status: 404 };
      if (borrow.status !== 'pending') {
        return { error: 'คำขอนี้ถูกดำเนินการไปแล้ว', status: 400 };
      }

      await borrowRepository.updateStatus(borrowId, 'rejected', tx);

      return { borrow: await borrowRepository.findById(borrowId, tx) };
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return serializeBorrow(result.borrow);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถปฏิเสธคำขอยืมได้', { cause: error });
  }
}

// เจ้าของใบยืมกดคืนเอง -> แค่ตั้ง return_requested_at รอ Admin ยืนยัน (ยังไม่แตะสถานะครุภัณฑ์)
// Admin คืนแทนใครก็ได้ (เช่น รับของคืนหน้าเคาน์เตอร์ หรือยืนยันคำขอคืนที่ user ส่งมา) -> ถือว่าคืนจริงทันที
export async function returnBorrowDetail(borrowDetailId, actorId) {
  try {
    const actor = await userRepository.findRoleById(actorId);
    const isAdmin = actor?.role === 'admin';

    const result = await runSerializableTransaction(async (tx) => {
      const detail = await borrowRepository.findDetailById(
        borrowDetailId,
        tx,
      );

      if (!detail) return { error: 'ไม่พบรายการยืม', status: 404 };
      if (!isAdmin && detail.borrows.user_id !== actorId) {
        return { error: 'คุณไม่มีสิทธิ์คืนรายการนี้', status: 403 };
      }
      if (detail.borrows.status !== 'approved') {
        return { error: 'รายการนี้ยังไม่ได้รับการอนุมัติ', status: 400 };
      }
      if (detail.returned_at) {
        return { error: 'รายการนี้คืนแล้ว', status: 400 };
      }

      if (!isAdmin) {
        if (detail.return_requested_at) {
          return { error: 'คุณส่งคำขอคืนไปแล้ว รอผู้ดูแลระบบยืนยัน', status: 400 };
        }

        await borrowRepository.requestReturn(borrowDetailId, tx);

        return { borrow: await borrowRepository.findById(detail.borrow_id, tx) };
      }

      await borrowRepository.markReturned(borrowDetailId, actorId, tx);
      await equipmentRepository.updateEquipmentItem(
        detail.item_id,
        { status: 'available' },
        tx,
      );

      await equipmentHistoryRepository.create(
        {
          itemId: detail.item_id,
          action: 'status_changed',
          oldData: { status: 'borrowed', borrow_id: detail.borrow_id },
          newData: { status: 'available' },
          changedBy: actorId,
        },
        tx,
      );

      return { borrow: await borrowRepository.findById(detail.borrow_id, tx) };
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return serializeBorrow(result.borrow);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถบันทึกการคืนได้', { cause: error });
  }
}
