// Business Logic สำหรับตรวจนับครุภัณฑ์ประจำปี — คุม transaction เอง (เหมือน repair.service.js)
//
// Flow: เปิดรอบ (openRound) -> ระบบสร้าง audit_records ครบทุกชิ้นที่ยังไม่ถูกลบ ผลเป็น null (ยังไม่ตรวจ) ->
// admin เดินสแกนทีละชิ้น (checkItem) ผลมีผลกับข้อมูลจริงทันที ไม่ต้องกดยืนยันซ้ำตอนท้าย:
//   - เลือกห้องไว้แล้วครุภัณฑ์อยู่ห้องอื่น/ยังไม่มีห้อง -> ย้ายห้องให้เลย
//   - ผลชำรุด -> เปิดใบแจ้งซ่อมให้ (ถ้าครุภัณฑ์ว่างอยู่) ตาม flow เดียวกับ repair.service.js
// กดผิดแก้ได้ด้วยการตรวจซ้ำ หรือล้างผล (resetRecord) ซึ่งย้ายห้องคืน/ยกเลิกใบซ่อมที่รอบนี้เปิดไว้ให้
// ปิดรอบ (closeRound) -> ชิ้นที่ยังไม่ได้ตรวจนับเป็น "ไม่พบ" และแก้ผลไม่ได้อีก
import * as auditRepository from './audit.repository.js';
import { AppError } from '../../utils/AppError.js';
import { runSerializableTransaction } from '../../utils/transaction.js';
import * as equipmentHistoryRepository from '../equipment/equipment-history.repository.js';
import * as equipmentRepository from '../equipment/equipment.repository.js';
import { getSerializedByItemId } from '../equipment/equipment.service.js';
import * as repairRepository from '../repair/repair.repository.js';

function serializeRound(round, counts = null) {
  return {
    round_id: round.round_id,
    title: round.title,
    status: round.status,
    opened_by_name: round.opened_user?.name ?? null,
    opened_at: round.opened_at,
    closed_by_name: round.closed_user?.name ?? null,
    closed_at: round.closed_at,
    ...(counts ? { counts } : {}),
  };
}

function serializeRecord(record) {
  const item = record.equipment_items;

  return {
    item_id: record.item_id,
    equipment_code: item.equipment_code,
    equipment_name: item.equipment_name,
    category_name: item.equipment.categories?.category_name ?? null,
    status: item.status,
    deleted: item.deleted_at !== null,
    current_location_id: item.equipment.location_id,
    expected_location_id: record.expected_location_id,
    result: record.result,
    note: record.note,
    found_location_id: record.found_location_id,
    location_moved: record.location_moved,
    moved_from_location_id: record.moved_from_location_id,
    repair_id: record.repair_id,
    repair_status: record.repairs?.status ?? null,
    checked_by_name: record.users?.name ?? null,
    checked_at: record.checked_at,
    closing_outcome: record.closing_outcome,
  };
}

// unchecked = ชิ้นที่ไม่ได้ตรวจทั้งหมด ส่วน missing/borrowed/in_repair/deleted แยกย่อยให้เฉพาะรอบที่ปิดแล้ว
function emptyCounts() {
  return {
    total: 0,
    normal: 0,
    damaged: 0,
    unchecked: 0,
    missing: 0,
    borrowed: 0,
    in_repair: 0,
    deleted: 0,
  };
}

export async function getRounds() {
  try {
    const [rounds, grouped] = await Promise.all([
      auditRepository.findRounds(),
      auditRepository.countRecordsByRound(),
    ]);

    const countsByRound = new Map();
    for (const row of grouped) {
      const counts = countsByRound.get(row.round_id) ?? emptyCounts();
      counts.total += row._count._all;
      counts[row.result ?? 'unchecked'] += row._count._all;
      if (row.closing_outcome) counts[row.closing_outcome] += row._count._all;
      countsByRound.set(row.round_id, counts);
    }

    return rounds.map((round) =>
      serializeRound(round, countsByRound.get(round.round_id) ?? emptyCounts()),
    );
  } catch (error) {
    throw new AppError(500, 'ไม่สามารถโหลดรายการรอบตรวจนับได้', { cause: error });
  }
}

export async function getRound(roundId) {
  try {
    const round = await auditRepository.findRoundById(roundId);
    if (!round) throw new AppError(404, 'ไม่พบรอบตรวจนับ');

    const records = await auditRepository.findRecordsByRound(roundId);

    return {
      round: serializeRound(round),
      records: records.map(serializeRecord),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถโหลดข้อมูลรอบตรวจนับได้', { cause: error });
  }
}

export async function openRound(title, actorId) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const openRound = await auditRepository.findOpenRound(tx);
      if (openRound) {
        return {
          error: `ยังมีรอบ "${openRound.title}" เปิดอยู่ ต้องปิดรอบเดิมก่อน`,
          status: 409,
        };
      }

      const round = await auditRepository.createRound(
        { title, opened_by: actorId },
        tx,
      );
      const items = await auditRepository.findActiveItemsForSnapshot(tx);

      await auditRepository.createRecords(
        items.map((item) => ({
          round_id: round.round_id,
          item_id: item.item_id,
          expected_location_id: item.equipment.location_id,
        })),
        tx,
      );

      return { roundId: round.round_id };
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return getRound(result.roundId);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถเปิดรอบตรวจนับได้', { cause: error });
  }
}

export async function closeRound(roundId, actorId) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const { round, ...roundError } = await loadOpenRound(roundId, tx);
      if (!round) return roundError;

      await auditRepository.settleUncheckedRecords(roundId, tx);
      await auditRepository.updateRound(
        roundId,
        { status: 'closed', closed_by: actorId, closed_at: new Date() },
        tx,
      );

      return {};
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return getRound(roundId);
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถปิดรอบตรวจนับได้', { cause: error });
  }
}

// ยกเลิกรอบที่ยังเปิดอยู่ = ย้อนทุกอย่างที่รอบนี้ทำไว้แล้วลบทิ้ง (เหมือนกดล้างผลทุกชิ้น) ใช้ลบรอบทดสอบได้สะอาด
// ส่วนรอบที่ปิดแล้วถือว่าผลเป็นข้อสรุปจริงไปแล้ว ลบแค่รายงาน ไม่ย้อนห้อง/ใบซ่อม
// ย้อนแบบ bulk ไม่วนทีละชิ้นแบบ resetRecord เพราะรอบจริงอาจย้ายห้องไปหลายร้อยชิ้น ทำทีละชิ้นใน transaction
// เดียวจะเกิน timeout ของ runSerializableTransaction
export async function deleteRound(roundId, actorId) {
  try {
    const result = await runSerializableTransaction(async (tx) => {
      const round = await auditRepository.findRoundById(roundId, tx);
      if (!round) return { error: 'ไม่พบรอบตรวจนับ', status: 404 };

      const summary = { reverted: round.status === 'open', moved_back: 0, repairs_cancelled: 0, repairs_kept: 0 };

      if (round.status === 'open') {
        const records = await auditRepository.findRecordsWithEffects(roundId, tx);
        const history = [];

        const pendingRepairs = records.filter((record) => record.repairs?.status === 'pending_repair');
        summary.repairs_kept = records.filter((record) => record.repairs?.status === 'repairing').length;

        if (pendingRepairs.length > 0) {
          await auditRepository.cancelRepairs(
            pendingRepairs.map((record) => record.repair_id),
            tx,
          );
          await equipmentRepository.updateManyStatus(
            pendingRepairs.map((record) => record.item_id),
            'available',
            tx,
          );
          for (const record of pendingRepairs) {
            history.push({
              itemId: record.item_id,
              action: 'status_changed',
              oldData: { status: 'pending_repair' },
              newData: { status: 'available', repair_id: record.repair_id, audit_round_id: roundId },
              changedBy: actorId,
            });
          }
          summary.repairs_cancelled = pendingRepairs.length;
        }

        const moves = records.filter(
          (record) =>
            record.location_moved &&
            record.equipment_items.equipment.location_id !== record.moved_from_location_id,
        );
        // จัดกลุ่มตามห้องเดิม แต่ละห้องสั่ง update ครั้งเดียว
        const byOrigin = new Map();
        for (const record of moves) {
          const group = byOrigin.get(record.moved_from_location_id) ?? [];
          group.push(record.equipment_items.equipment.equipment_id);
          byOrigin.set(record.moved_from_location_id, group);
          history.push({
            itemId: record.item_id,
            action: 'updated',
            oldData: { location_id: record.equipment_items.equipment.location_id },
            newData: { location_id: record.moved_from_location_id, audit_round_id: roundId },
            changedBy: actorId,
          });
        }
        for (const [locationId, equipmentIds] of byOrigin) {
          await auditRepository.setEquipmentLocation(equipmentIds, locationId, tx);
        }
        summary.moved_back = moves.length;

        await equipmentHistoryRepository.createMany(history, tx);
      }

      await auditRepository.deleteRound(roundId, tx);

      return { summary };
    });

    if (result.error) {
      throw new AppError(result.status, result.error);
    }

    return result.summary;
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถลบรอบตรวจนับได้', { cause: error });
  }
}

// ย้ายห้องแล้วบันทึก history แบบเดียวกับแก้ไขครุภัณฑ์ปกติ (snapshot ก่อน/หลังเต็มๆ) แนบรอบที่ทำให้ย้ายไว้ด้วย
async function moveLocation(itemId, equipmentId, locationId, roundId, actorId, tx) {
  const before = await getSerializedByItemId(itemId, { client: tx });

  await equipmentRepository.updateEquipmentDetails(
    equipmentId,
    { location_id: locationId },
    tx,
  );

  const after = await getSerializedByItemId(itemId, { client: tx });

  await equipmentHistoryRepository.create(
    {
      itemId,
      action: 'updated',
      oldData: before,
      newData: { ...after, audit_round_id: roundId },
      changedBy: actorId,
    },
    tx,
  );
}

// เหมือน repair.service.js reportRepair แต่ทำใน transaction ของการตรวจ ให้บันทึกผลกับเปิดใบซ่อมสำเร็จ/ล้มพร้อมกัน
async function openRepair(itemId, issue, roundId, actorId, tx) {
  const repair = await repairRepository.create(
    { item_id: itemId, reported_by: actorId, issue, status: 'pending_repair' },
    tx,
  );

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
      newData: {
        status: 'pending_repair',
        repair_id: repair.repair_id,
        audit_round_id: roundId,
      },
      changedBy: actorId,
    },
    tx,
  );

  return repair.repair_id;
}

// ยกเลิกใบซ่อมที่การตรวจเปิดไว้เอง ทำได้เฉพาะตอนยังไม่เริ่มซ่อม
// คืน 'cancelled' | 'started' (เริ่มซ่อมแล้ว ยกเลิกไม่ได้) | 'closed' (ปิดงานไปแล้ว ไม่ต้องทำอะไร)
async function cancelAuditRepair(repairId, roundId, actorId, tx) {
  const repair = await repairRepository.findById(repairId, tx);
  if (!repair || repair.status === 'completed' || repair.status === 'cancelled') {
    return 'closed';
  }
  if (repair.status !== 'pending_repair') return 'started';

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
      oldData: { status: 'pending_repair' },
      newData: { status: 'available', repair_id: repairId, audit_round_id: roundId },
      changedBy: actorId,
    },
    tx,
  );

  return 'cancelled';
}

const repairNotices = {
  cancelled: 'ยกเลิกใบแจ้งซ่อมที่เปิดไว้ตอนตรวจแล้ว',
  started: 'ใบแจ้งซ่อมเริ่มซ่อมไปแล้ว จึงไม่ได้ยกเลิกให้',
};

async function loadOpenRound(roundId, tx) {
  const round = await auditRepository.findRoundById(roundId, tx);

  if (!round) return { error: 'ไม่พบรอบตรวจนับ', status: 404 };
  if (round.status !== 'open') {
    return { error: 'รอบนี้ปิดไปแล้ว แก้ผลการตรวจไม่ได้', status: 409 };
  }

  return { round };
}

export async function checkItem(
  roundId,
  itemId,
  { result, note, locationId, moveLocation: shouldMove },
  actorId,
) {
  try {
    const outcome = await runSerializableTransaction(async (tx) => {
      const { round, ...roundError } = await loadOpenRound(roundId, tx);
      if (!round) return roundError;

      const item = await equipmentRepository.findByItemId(itemId, { client: tx });
      if (!item) return { error: 'ไม่พบครุภัณฑ์', status: 404 };

      // ครุภัณฑ์ที่เพิ่มเข้าระบบหลังเปิดรอบจะยังไม่มีแถว ให้สร้างตอนสแกนเจอเลย
      const record =
        (await auditRepository.findRecord(roundId, itemId, tx)) ??
        (await auditRepository.createRecord(
          {
            round_id: roundId,
            item_id: itemId,
            expected_location_id: item.equipment.location_id,
          },
          tx,
        ));

      const notices = [];
      let locationMoved = record.location_moved;
      let movedFrom = record.moved_from_location_id;
      const currentLocationId = item.equipment.location_id;

      if (shouldMove && locationId !== null && locationId !== currentLocationId) {
        await moveLocation(itemId, item.equipment_id, locationId, roundId, actorId, tx);

        // ย้ายซ้ำหลายครั้งในรอบเดียว ต้องจำห้องแรกสุดไว้ ไม่ใช่ห้องล่าสุด ไม่งั้นล้างผลแล้วย้ายคืนผิดห้อง
        if (!locationMoved) {
          locationMoved = true;
          movedFrom = currentLocationId;
        } else if (movedFrom === locationId) {
          locationMoved = false;
          movedFrom = null;
        }
      }

      let repairId = record.repair_id;

      if (result === 'damaged') {
        const linkedRepair = repairId
          ? await repairRepository.findById(repairId, tx)
          : null;
        const hasOpenAuditRepair =
          linkedRepair &&
          (linkedRepair.status === 'pending_repair' ||
            linkedRepair.status === 'repairing');

        if (!hasOpenAuditRepair) {
          if (item.status === 'available') {
            repairId = await openRepair(
              itemId,
              note || `พบชำรุดจากการตรวจนับ (${round.title})`,
              roundId,
              actorId,
              tx,
            );
            notices.push('เปิดใบแจ้งซ่อมให้แล้ว');
          } else if (item.status === 'borrowed') {
            notices.push('ครุภัณฑ์ถูกยืมอยู่ จึงยังเปิดใบแจ้งซ่อมไม่ได้');
          } else {
            notices.push('ครุภัณฑ์มีใบแจ้งซ่อมค้างอยู่แล้ว');
          }
        }
      } else if (repairId) {
        const repairOutcome = await cancelAuditRepair(repairId, roundId, actorId, tx);
        if (repairOutcome === 'cancelled') repairId = null;
        if (repairNotices[repairOutcome]) notices.push(repairNotices[repairOutcome]);
      }

      await auditRepository.updateRecord(
        record.record_id,
        {
          result,
          note,
          // ตรวจซ้ำโดยไม่เลือกห้อง ไม่ควรลบห้องที่เคยย้ายไปทิ้ง ไม่งั้นหน้าสรุปไม่รู้ว่าย้ายไปไหน
          found_location_id: locationId ?? (locationMoved ? record.found_location_id : null),
          location_moved: locationMoved,
          moved_from_location_id: movedFrom,
          repair_id: repairId,
          checked_by: actorId,
          checked_at: new Date(),
        },
        tx,
      );

      return { notices };
    });

    if (outcome.error) {
      throw new AppError(outcome.status, outcome.error);
    }

    const record = await auditRepository.findRecord(roundId, itemId);

    return { record: serializeRecord(record), notices: outcome.notices };
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error.code === 'P2003') {
      throw new AppError(400, 'ไม่พบห้องที่เลือก');
    }

    throw new AppError(500, 'ไม่สามารถบันทึกผลการตรวจได้', { cause: error });
  }
}

export async function resetRecord(roundId, itemId, actorId) {
  try {
    const outcome = await runSerializableTransaction(async (tx) => {
      const { round, ...roundError } = await loadOpenRound(roundId, tx);
      if (!round) return roundError;

      const record = await auditRepository.findRecord(roundId, itemId, tx);
      if (!record) return { error: 'ครุภัณฑ์นี้ไม่อยู่ในรอบตรวจนับนี้', status: 404 };

      const notices = [];

      if (record.repair_id) {
        const repairOutcome = await cancelAuditRepair(
          record.repair_id,
          roundId,
          actorId,
          tx,
        );
        if (repairNotices[repairOutcome]) notices.push(repairNotices[repairOutcome]);
      }

      if (record.location_moved) {
        const item = await equipmentRepository.findByItemId(itemId, { client: tx });

        if (item && item.equipment.location_id !== record.moved_from_location_id) {
          await moveLocation(
            itemId,
            item.equipment_id,
            record.moved_from_location_id,
            roundId,
            actorId,
            tx,
          );
          notices.push('ย้ายกลับห้องเดิมแล้ว');
        }
      }

      await auditRepository.updateRecord(
        record.record_id,
        {
          result: null,
          note: null,
          found_location_id: null,
          location_moved: false,
          moved_from_location_id: null,
          repair_id: null,
          checked_by: null,
          checked_at: null,
        },
        tx,
      );

      return { notices };
    });

    if (outcome.error) {
      throw new AppError(outcome.status, outcome.error);
    }

    const record = await auditRepository.findRecord(roundId, itemId);

    return { record: serializeRecord(record), notices: outcome.notices };
  } catch (error) {
    if (error instanceof AppError) throw error;

    throw new AppError(500, 'ไม่สามารถล้างผลการตรวจได้', { cause: error });
  }
}
