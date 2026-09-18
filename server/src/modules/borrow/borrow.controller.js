import * as borrowService from './borrow.service.js';

export async function getBorrowList(_request, response, next) {
  try {
    const borrows = await borrowService.getBorrowList();

    response.status(200).json({ borrows });
  } catch (error) {
    next(error);
  }
}

export async function getMyBorrowList(request, response, next) {
  try {
    const borrows = await borrowService.getMyBorrowList(
      Number(request.user.sub),
    );

    response.status(200).json({ borrows });
  } catch (error) {
    next(error);
  }
}

// Admin สร้างใบยืมแทนผู้ใช้ ถือว่าอนุมัติทันที
export async function createBorrow(request, response, next) {
  try {
    const { userId, returnDate, itemIds, remark } = request.validated;
    const borrow = await borrowService.createBorrow(
      userId,
      returnDate,
      itemIds,
      Number(request.user.sub),
      remark,
    );

    response.status(201).json({ message: 'บันทึกการยืมสำเร็จ', borrow });
  } catch (error) {
    next(error);
  }
}

// User ส่งคำขอยืมให้ตัวเอง -> รอ Admin อนุมัติ
export async function requestBorrow(request, response, next) {
  try {
    const { returnDate, itemIds, remark } = request.validated;
    const userId = Number(request.user.sub);
    const borrow = await borrowService.requestBorrow(
      userId,
      returnDate,
      itemIds,
      remark,
    );

    response
      .status(201)
      .json({ message: 'ส่งคำขอยืมสำเร็จ รอการอนุมัติจากผู้ดูแลระบบ', borrow });
  } catch (error) {
    next(error);
  }
}

export async function approveBorrow(request, response, next) {
  try {
    const { borrowId } = request.validated;
    const borrow = await borrowService.approveBorrow(
      borrowId,
      Number(request.user.sub),
    );

    response.status(200).json({ message: 'อนุมัติคำขอยืมสำเร็จ', borrow });
  } catch (error) {
    next(error);
  }
}

export async function rejectBorrow(request, response, next) {
  try {
    const { borrowId } = request.validated;
    const borrow = await borrowService.rejectBorrow(borrowId);

    response.status(200).json({ message: 'ปฏิเสธคำขอยืมแล้ว', borrow });
  } catch (error) {
    next(error);
  }
}

export async function returnBorrowDetail(request, response, next) {
  try {
    const { borrowDetailId } = request.validated;
    const borrow = await borrowService.returnBorrowDetail(
      borrowDetailId,
      Number(request.user.sub),
    );
    const detail = borrow.details.find(
      (item) => item.borrow_detail_id === borrowDetailId,
    );
    // ผู้ยืมกดคืนเองจะได้แค่ status 'pending_return' (รอ Admin ยืนยัน) ส่วน Admin กดจะได้ 'returned' เสมอ
    const message =
      detail?.status === 'pending_return'
        ? 'ส่งคำขอคืนแล้ว รอผู้ดูแลระบบยืนยัน'
        : 'บันทึกการคืนสำเร็จ';

    response.status(200).json({ message, borrow });
  } catch (error) {
    next(error);
  }
}
