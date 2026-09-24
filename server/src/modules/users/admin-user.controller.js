import * as userService from './user.service.js';

export async function getUsers(_request, response, next) {
  try {
    const users = await userService.getUsers();

    response.status(200).json({ users });
  } catch (error) {
    next(error);
  }
}

export async function updateUserRole(request, response, next) {
  try {
    const { userId, role } = request.validated;
    const user = await userService.updateUserRole(
      userId,
      role,
      Number(request.user.sub),
    );

    response.status(200).json({
      message: 'อัปเดตสิทธิ์เรียบร้อยแล้ว',
      user,
    });
  } catch (error) {
    next(error);
  }
}

export async function createUser(request, response, next) {
  try {
    const user = await userService.createUser(request.validated);

    response.status(201).json({
      message: 'เพิ่มผู้ใช้เรียบร้อยแล้ว',
      user,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(request, response, next) {
  try {
    await userService.deleteUser(
      request.validated.userId,
      Number(request.user.sub),
    );

    response.status(200).json({ message: 'ลบผู้ใช้เรียบร้อยแล้ว' });
  } catch (error) {
    next(error);
  }
}
