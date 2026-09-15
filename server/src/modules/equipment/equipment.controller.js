import * as equipmentService from './equipment.service.js';

export async function getEquipmentList(_request, response, next) {
  try {
    const equipment = await equipmentService.getEquipmentList();

    response.status(200).json({ equipment });
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

export async function getDeletedEquipmentList(_request, response, next) {
  try {
    const equipment = await equipmentService.getDeletedEquipmentList();

    response.status(200).json({ equipment });
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
