import * as auditService from './audit.service.js';

export async function getRounds(_request, response, next) {
  try {
    const rounds = await auditService.getRounds();

    response.status(200).json({ rounds });
  } catch (error) {
    next(error);
  }
}

export async function getRound(request, response, next) {
  try {
    const { roundId } = request.validated;
    const data = await auditService.getRound(roundId);

    response.status(200).json(data);
  } catch (error) {
    next(error);
  }
}

export async function openRound(request, response, next) {
  try {
    const { title } = request.validated;
    const data = await auditService.openRound(title, Number(request.user.sub));

    response.status(201).json({ message: 'เปิดรอบตรวจนับแล้ว', ...data });
  } catch (error) {
    next(error);
  }
}

export async function closeRound(request, response, next) {
  try {
    const { roundId } = request.validated;
    const data = await auditService.closeRound(roundId, Number(request.user.sub));

    response.status(200).json({ message: 'ปิดรอบตรวจนับแล้ว', ...data });
  } catch (error) {
    next(error);
  }
}

export async function deleteRound(request, response, next) {
  try {
    const { roundId } = request.validated;
    const summary = await auditService.deleteRound(roundId, Number(request.user.sub));

    response.status(200).json({ message: 'ลบรอบตรวจนับแล้ว', summary });
  } catch (error) {
    next(error);
  }
}

export async function checkItem(request, response, next) {
  try {
    const { roundId, itemId, result, note, locationId, moveLocation } =
      request.validated;
    const data = await auditService.checkItem(
      roundId,
      itemId,
      { result, note, locationId, moveLocation },
      Number(request.user.sub),
    );

    response.status(200).json({ message: 'บันทึกผลการตรวจแล้ว', ...data });
  } catch (error) {
    next(error);
  }
}

export async function resetRecord(request, response, next) {
  try {
    const { roundId, itemId } = request.validated;
    const data = await auditService.resetRecord(
      roundId,
      itemId,
      Number(request.user.sub),
    );

    response.status(200).json({ message: 'ล้างผลการตรวจแล้ว', ...data });
  } catch (error) {
    next(error);
  }
}
