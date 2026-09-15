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
