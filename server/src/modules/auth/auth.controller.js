import * as authService from './auth.service.js';

export async function register(request, response, next) {
  try {
    const user = await authService.register(request.validated);

    response.status(201).json({
      message: 'ลงทะเบียนสำเร็จ',
      user,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(request, response, next) {
  try {
    const { token, user } = await authService.login(request.validated);

    response.status(200).json({
      message: 'เข้าสู่ระบบสำเร็จ',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentUser(request, response, next) {
  try {
    const user = await authService.getCurrentUser(Number(request.user.sub));

    response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}
