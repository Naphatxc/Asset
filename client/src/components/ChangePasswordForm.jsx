// ฟอร์มเปลี่ยนรหัสผ่านของตัวเอง (หน้าต่างเปลี่ยนรหัสจากเมนูใน Dashboard) สำเร็จแล้วอัปเดต ['auth','me']
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { changePassword } from '../api/auth.js';
import PasswordInput from './PasswordInput.jsx';

export default function ChangePasswordForm({ onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: (data) => {
      queryClient.setQueryData(['auth', 'me'], { user: data.user });
      onSuccess?.(data);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
      return;
    }

    mutation.mutate({ currentPassword, newPassword });
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label>
        รหัสผ่านปัจจุบัน
        <PasswordInput
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          autoComplete="current-password"
          maxLength={72}
          required
        />
      </label>

      <label>
        รหัสผ่านใหม่
        <PasswordInput
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="อย่างน้อย 8 ตัวอักษร"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
      </label>

      <label>
        ยืนยันรหัสผ่านใหม่
        <PasswordInput
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
      </label>

      {error && <p className="error-message">{error}</p>}

      <button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
      </button>
      {onCancel && (
        <button type="button" className="auth-switch" onClick={onCancel}>
          ยกเลิก
        </button>
      )}
    </form>
  );
}
