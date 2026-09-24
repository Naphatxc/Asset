import * as optionsService from './options.service.js';

export async function getCategories(_request, response, next) {
  try {
    const categories = await optionsService.getCategories();

    response.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
}

export async function getLocations(_request, response, next) {
  try {
    const locations = await optionsService.getLocations();

    response.status(200).json({ locations });
  } catch (error) {
    next(error);
  }
}

export async function getAvailableEquipment(_request, response, next) {
  try {
    const equipment = await optionsService.getAvailableEquipment();

    response.status(200).json({ equipment });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(request, response, next) {
  try {
    const { categoryName, codePrefix } = request.validated;
    const category = await optionsService.createCategory(
      categoryName,
      codePrefix,
    );

    response.status(201).json({ message: 'เพิ่มหมวดหมู่สำเร็จ', category });
  } catch (error) {
    next(error);
  }
}

export async function createLocation(request, response, next) {
  try {
    const { locationName, building, room } = request.validated;
    const location = await optionsService.createLocation({
      locationName,
      building,
      room,
    });

    response.status(201).json({ message: 'เพิ่มสถานที่สำเร็จ', location });
  } catch (error) {
    next(error);
  }
}
