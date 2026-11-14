import type { ContractSchema } from '@/lib/contract-fields';

interface NewDocumentContractStepProps {
  contractSchema: ContractSchema;
  contractFormData: Record<string, string>;
  dateErrors: Record<string, string>;
  onSetContractFormData: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onHandleDateInput: (key: string, raw: string) => void;
}

/**
 * 새 문서 생성 폼의 "계약서 입력" step.
 * 계약서 스키마의 그룹별 필드를 입력받아 표준계약서 양식에 반영한다(AI 미사용).
 */
export function NewDocumentContractStep({
  contractSchema,
  contractFormData,
  dateErrors,
  onSetContractFormData,
  onHandleDateInput,
}: NewDocumentContractStepProps) {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-primary-tint border border-primary/30">
        <div>
          <p className="text-sm font-semibold text-foreground">계약서 자동 작성</p>
          <p className="text-xs text-foreground-secondary">아래 항목을 입력하면 표준계약서 양식에 자동으로 반영됩니다. AI 토큰을 사용하지 않습니다.</p>
        </div>
      </div>
      {[...new Set(contractSchema.fields.map((field) => field.group))].map((group) => {
        const fields = contractSchema.fields.filter((field) => field.group === group);
        return (
          <div key={group}>
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2" style={{ marginTop: 10 }}>
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {group}
            </h4>
            <div className="mb-[10px] grid grid-cols-1 gap-x-4 md:grid-cols-2">
              {fields.map((field) => (
                <div key={field.key} className={field.half ? '' : 'md:col-span-2'} style={{ paddingTop: 5, paddingBottom: 15 }}>
                  <label className="block text-xs text-foreground-secondary" style={{ marginBottom: 8 }}>
                    {field.label} {field.required && <span className="text-danger">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select value={contractFormData[field.key] ?? ''} onChange={(e) => onSetContractFormData((prev) => ({ ...prev, [field.key]: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow cursor-pointer">
                      <option value="">선택하세요</option>
                      {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : field.placeholder === 'yyyy/mm/dd' ? (
                    <>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={contractFormData[field.key] ?? ''}
                        onChange={(e) => onHandleDateInput(field.key, e.target.value)}
                        placeholder="yyyy/mm/dd"
                        maxLength={10}
                        className={`w-full px-4 py-2.5 rounded-xl border text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 transition-shadow ${dateErrors[field.key] ? 'border-danger focus:ring-danger/30 bg-danger/5' : 'border-border focus:ring-primary bg-white'}`}
                      />
                      {dateErrors[field.key] && <p className="text-[11px] text-danger mt-0.5">{dateErrors[field.key]}</p>}
                    </>
                  ) : (
                    <input
                      type="text"
                      inputMode={field.type === 'number' ? 'numeric' : undefined}
                      value={field.type === 'number' && contractFormData[field.key] ? Number(contractFormData[field.key]).toLocaleString('ko-KR') : (contractFormData[field.key] ?? '')}
                      onChange={(e) => {
                        let value = e.target.value;
                        if (field.type === 'number') value = value.replace(/[^0-9]/g, '');
                        onSetContractFormData((prev) => {
                          const next = { ...prev, [field.key]: value };
                          if (field.key === 'totalAmount' && value) {
                            const total = Number(value);
                            next.supplyAmount = String(Math.round(total / 1.1));
                            next.vatAmount = String(total - Math.round(total / 1.1));
                          }
                          return next;
                        });
                      }}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
