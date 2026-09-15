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
