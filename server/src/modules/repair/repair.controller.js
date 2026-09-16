import * as repairService from './repair.service.js';

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

export async function getRepairDetail(request, response, next) {
  try {
    const { repairId } = request.validated;
    const repair = await repairService.getRepairDetail(repairId);

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
    const file = await repairService.getFile(fileId);

    response.download(file.absolutePath, file.file_name);
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
