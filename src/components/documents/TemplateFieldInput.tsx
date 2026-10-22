'use client';

import { formatSalaryAmount, formatPhoneNumber } from '@/lib/templates/standard-labor-contract';

interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'checkbox' | 'select';
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  autoFill?: 'user' | 'source' | 'document';
  aiAssist?: boolean;
  options?: string[];
  showWhen?: { field: string; equals?: string; notEquals?: string };
  format?: 'currency' | 'phone';
}

interface TemplateFieldInputProps {
  field: TemplateField;
  value: string;
  onChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  extracted?: boolean;
}

export function TemplateFieldInput({ field, value, onChange, extracted }: TemplateFieldInputProps) {
  // textarea·checkbox 등 긴 입력은 2칼럼 그리드에서 한 줄 전체를 차지한다.
  const fullWidth = field.type === 'textarea' || field.type === 'checkbox';
  return (
    <div className={fullWidth ? 'sm:col-span-2' : undefined}>
      <label className="flex items-center gap-1.5 text-xs text-foreground-secondary" style={{ marginBottom: 6 }}>
        {field.label} {field.required && <span className="text-danger">*</span>}
        {extracted && (
          <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">참조파일에서 추출</span>
        )}
      </label>
      {field.type === 'textarea' ? (
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange((prev) => ({ ...prev, [field.key]: e.target.value }))}
          rows={3}
          placeholder={field.placeholder}
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      ) : field.type === 'checkbox' ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2 px-1 py-1">
          {(field.options ?? []).map((option) => {
            const selected = (value ?? '').split(',').map((v) => v.trim()).filter(Boolean);
            const checked = selected.includes(option);
            return (
              <label key={option} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selected, option]
                      : selected.filter((v) => v !== option);
                    onChange((prev) => ({ ...prev, [field.key]: next.join(',') }));
                  }}
                  className="rounded border-border text-primary focus:ring-primary"
                />
                {option}
              </label>
            );
          })}
        </div>
      ) : field.type === 'select' ? (
        <select
          value={value ?? ''}
          onChange={(e) => onChange((prev) => ({ ...prev, [field.key]: e.target.value }))}
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">선택하세요</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : field.format === 'currency' ? (
        <div>
          <input
            type="text"
            inputMode="numeric"
            value={(value ?? '').replace(/[^0-9]/g, '')
              ? Number((value ?? '').replace(/[^0-9]/g, '')).toLocaleString('en-US')
              : ''}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, '');
              onChange((prev) => ({ ...prev, [field.key]: digits }));
            }}
            placeholder={field.placeholder}
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {(value ?? '').replace(/[^0-9]/g, '') && (
            <p className="mt-1 text-xs text-primary">{formatSalaryAmount(value ?? '')}</p>
          )}
        </div>
      ) : field.format === 'phone' ? (
        <input
          type="text"
          inputMode="numeric"
          value={formatPhoneNumber(value ?? '')}
          onChange={(e) => onChange((prev) => ({ ...prev, [field.key]: e.target.value.replace(/[^0-9]/g, '') }))}
          placeholder={field.placeholder}
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      ) : (
        <input
          type={field.type === 'date' ? 'date' : 'text'}
          value={value ?? ''}
          onChange={(e) => onChange((prev) => ({ ...prev, [field.key]: e.target.value }))}
          placeholder={field.placeholder}
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm text-foreground placeholder:text-foreground-quaternary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      )}
    </div>
  );
}
