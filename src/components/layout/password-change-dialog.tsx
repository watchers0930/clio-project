'use client';

import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { usePasswordChange } from '@/hooks/use-password-change';
import { PASSWORD_MIN } from '@/lib/auth/password-change-rules';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PasswordChangeDialog({ open, onClose }: Props) {
  const toast = useToast();
  const { submit, submitting, error, setError } = usePasswordChange();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const close = () => {
    if (submitting) return;
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
    onClose();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < PASSWORD_MIN) return setError(`새 비밀번호는 ${PASSWORD_MIN}자 이상이어야 합니다.`);
    if (next !== confirm) return setError('새 비밀번호 확인이 일치하지 않습니다.');
    if (await submit(current, next)) {
      toast.success('비밀번호가 변경되었습니다. 다른 기기에서는 다시 로그인해야 합니다.');
      setCurrent('');
      setNext('');
      setConfirm('');
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={close} title="비밀번호 변경" size="sm">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Input
          label="현재 비밀번호"
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <Input
          label="새 비밀번호"
          id="new-password"
          type="password"
          autoComplete="new-password"
          hint={`${PASSWORD_MIN}자 이상`}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
        <Input
          label="새 비밀번호 확인"
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="secondary" size="sm" onClick={close} disabled={submitting}>
            취소
          </Button>
          <Button type="submit" size="sm" loading={submitting}>
            변경
          </Button>
        </div>
      </form>
    </Modal>
  );
}
