'use client';

import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { TransferPayee } from '@/lib/bulk-transfer/types';

interface Props {
  payees: TransferPayee[];
  onAdd: () => void;
  onEdit: (p: TransferPayee) => void;
  onDelete: (p: TransferPayee) => void;
}

export function PayeeManager({ payees, onAdd, onEdit, onDelete }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">거래처 계좌</h3>
          <p className="mt-0.5 text-[12px] text-foreground-secondary">계좌번호는 암호화 저장되며, 이체 건 등록 시 재사용됩니다.</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 h-9 rounded-xl bg-primary px-4 text-[13px] font-medium text-white hover:bg-primary-dark transition-colors"
        >
          <Plus size={15} strokeWidth={1.5} />
          거래처 추가
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full table-fixed text-[13px]">
          <colgroup>
            <col className="w-[26%]" />
            <col className="w-[16%]" />
            <col className="w-[24%]" />
            <col className="w-[18%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="bg-surface-secondary">
              <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">거래처명</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">은행</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">계좌번호</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground-secondary">예금주</th>
              <th className="px-4 py-3 text-center font-semibold text-foreground-secondary">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {payees.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-14 text-center text-[13px] text-foreground-tertiary">
                  등록된 거래처가 없습니다. 거래처 추가 버튼을 눌러 계좌를 등록해 주세요.
                </td>
              </tr>
            ) : (
              payees.map((p) => (
                <tr key={p.id} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground truncate">{p.name}</td>
                  <td className="px-4 py-3 text-foreground-secondary truncate">{p.bank_name}</td>
                  <td className="px-4 py-3 font-mono text-foreground-tertiary tracking-wider truncate">{p.account_masked}</td>
                  <td className="px-4 py-3 text-foreground-secondary truncate">{p.account_holder || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => onEdit(p)} className="text-foreground-secondary hover:text-primary transition-colors" title="수정">
                        <Pencil size={14} strokeWidth={1.5} />
                      </button>
                      <button onClick={() => onDelete(p)} className="text-foreground-secondary hover:text-red-500 transition-colors" title="삭제">
                        <Trash2 size={14} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
