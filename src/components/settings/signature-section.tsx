import Image from 'next/image';
import type * as React from 'react';
import { Building2, PenLine, Upload, X } from 'lucide-react';
import { Spinner } from '@/components/ui';

interface SignatureSectionProps {
  sigLoading: boolean;
  sigUploading: boolean;
  sigUrl: string | null;
  logoLoading: boolean;
  logoUploading: boolean;
  logoUrl: string | null;
  logoPatternDensity: 'sparse' | 'normal' | 'dense';
  logoSettingsSaving: boolean;
  sigFileRef: React.RefObject<HTMLInputElement | null>;
  logoFileRef: React.RefObject<HTMLInputElement | null>;
  sealLoading: boolean;
  sealUploading: boolean;
  sealUrl: string | null;
  sealFileRef: React.RefObject<HTMLInputElement | null>;
  onDeleteSignature: () => void;
  onUploadSignature: (file: File) => void;
  onDeleteCompanyLogo: () => void;
  onUploadCompanyLogo: (file: File) => void;
  onUpdateCompanyLogoPatternDensity: (density: 'sparse' | 'normal' | 'dense') => void;
  onDeleteCompanySeal: () => void;
  onUploadCompanySeal: (file: File) => void;
  currentUserIsAdmin: boolean;
}

export function SignatureSection({
  sigLoading,
  sigUploading,
  sigUrl,
  logoLoading,
  logoUploading,
  logoUrl,
  logoPatternDensity,
  logoSettingsSaving,
  sigFileRef,
  logoFileRef,
  sealLoading,
  sealUploading,
  sealUrl,
  sealFileRef,
  onDeleteSignature,
  onUploadSignature,
  onDeleteCompanyLogo,
  onUploadCompanyLogo,
  onUpdateCompanyLogoPatternDensity,
  onDeleteCompanySeal,
  onUploadCompanySeal,
  currentUserIsAdmin,
}: SignatureSectionProps) {
  const densityOptions: Array<{ value: 'sparse' | 'normal' | 'dense'; label: string }> = [
    { value: 'sparse', label: '적게' },
    { value: 'normal', label: '보통' },
    { value: 'dense', label: '많게' },
  ];

  return (
    <div className="grid gap-5 max-w-lg">
    {/* 개인 전자 서명은 관리자 여부와 무관하게 모든 사용자(대표 포함)가 등록·교체할 수 있다. */}
    <div className="bg-card rounded-2xl border border-border p-8">
      <h2 className="text-[16px] font-semibold mb-1">전자 서명 관리</h2>
      <p className="text-sm text-muted mb-6">문서 다운로드 시 서명란에 자동으로 삽입됩니다. PNG, JPEG, WebP (최대 2MB)</p>

      {sigLoading ? (
        <div className="flex items-center justify-center h-32">
          <Spinner size="lg" />
        </div>
      ) : sigUrl ? (
        <div className="flex flex-col gap-4">
          <div className="relative border border-border rounded-xl overflow-hidden bg-surface-secondary flex items-center justify-center" style={{ height: 140 }}>
            <Image src={sigUrl} alt="내 서명" width={320} height={120} unoptimized style={{ maxHeight: 120, maxWidth: '100%', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div className="flex gap-3.5">
            <button
              onClick={() => sigFileRef.current?.click()}
              disabled={sigUploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-40"
            >
              {sigUploading ? <Spinner size="sm" /> : <Upload size={14} />}
              서명 교체
            </button>
            <button
              onClick={onDeleteSignature}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <X size={14} /> 삭제
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => sigFileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary hover:bg-blue-50/30 transition-colors"
          style={{ height: 160 }}
        >
          {sigUploading ? (
            <Spinner size="lg" />
          ) : (
            <>
              <PenLine size={28} className="text-muted" />
              <p className="text-sm text-muted font-medium">클릭하여 서명 이미지 등록</p>
              <p className="text-xs text-muted">PNG · JPEG · WebP, 최대 2MB</p>
            </>
          )}
        </div>
      )}

      <input
        ref={sigFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUploadSignature(file);
          event.target.value = '';
        }}
      />
    </div>

    {currentUserIsAdmin && (<>
    <div className="bg-card rounded-2xl border border-border p-8">
      <h2 className="text-[16px] font-semibold mb-1">회사 로고 워터마크</h2>
      <p className="text-sm text-muted mb-6">재직증명서 중앙 워터마크로 사용됩니다. PNG, JPEG, WebP (최대 2MB)</p>

      {logoLoading ? (
        <div className="flex items-center justify-center h-32">
          <Spinner size="lg" />
        </div>
      ) : logoUrl ? (
        <div className="flex flex-col gap-4">
          <div className="relative border border-border rounded-xl overflow-hidden bg-surface-secondary flex items-center justify-center" style={{ height: 140 }}>
            <Image src={logoUrl} alt="회사 로고" width={320} height={120} unoptimized style={{ maxHeight: 120, maxWidth: '100%', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div className="flex gap-3.5">
            <button
              onClick={() => logoFileRef.current?.click()}
              disabled={logoUploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-40"
            >
              {logoUploading ? <Spinner size="sm" /> : <Upload size={14} />}
              로고 교체
            </button>
            <button
              onClick={onDeleteCompanyLogo}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <X size={14} /> 삭제
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => logoFileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary hover:bg-blue-50/30 transition-colors"
          style={{ height: 160 }}
        >
          {logoUploading ? (
            <Spinner size="lg" />
          ) : (
            <>
              <Building2 size={28} className="text-muted" />
              <p className="text-sm text-muted font-medium">클릭하여 회사 로고 등록</p>
              <p className="text-xs text-muted">PNG · JPEG · WebP, 최대 2MB</p>
            </>
          )}
        </div>
      )}

      <div className="mt-5 pt-5 border-t border-border">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-sm font-medium text-foreground">패턴 수</p>
          {logoSettingsSaving ? <Spinner size="sm" /> : null}
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-surface-secondary p-1">
          {densityOptions.map((option) => {
            const active = logoPatternDensity === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onUpdateCompanyLogoPatternDensity(option.value)}
                disabled={logoSettingsSaving}
                className={[
                  'h-9 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
                  active ? 'bg-card text-foreground shadow-sm' : 'text-muted hover:text-foreground',
                ].join(' ')}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <input
        ref={logoFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUploadCompanyLogo(file);
          event.target.value = '';
        }}
      />
    </div>

    <div className="bg-card rounded-2xl border border-border p-8">
      <h2 className="text-[16px] font-semibold mb-1">회사 직인</h2>
      <p className="text-sm text-muted mb-6">재직증명서 등 회사 발급 문서의 대표자 직인란에 삽입됩니다. 배경 투명 PNG 권장. (최대 2MB)</p>

      {sealLoading ? (
        <div className="flex items-center justify-center h-32">
          <Spinner size="lg" />
        </div>
      ) : sealUrl ? (
        <div className="flex flex-col gap-4">
          <div className="relative border border-border rounded-xl overflow-hidden bg-surface-secondary flex items-center justify-center" style={{ height: 140 }}>
            <Image src={sealUrl} alt="회사 직인" width={200} height={120} unoptimized style={{ maxHeight: 120, maxWidth: '100%', width: 'auto', objectFit: 'contain' }} />
          </div>
          <div className="flex gap-3.5">
            <button
              onClick={() => sealFileRef.current?.click()}
              disabled={sealUploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-white text-sm font-medium hover:bg-primary transition-colors disabled:opacity-40"
            >
              {sealUploading ? <Spinner size="sm" /> : <Upload size={14} />}
              직인 교체
            </button>
            <button
              onClick={onDeleteCompanySeal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
            >
              <X size={14} /> 삭제
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => sealFileRef.current?.click()}
          className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary hover:bg-blue-50/30 transition-colors"
          style={{ height: 160 }}
        >
          {sealUploading ? (
            <Spinner size="lg" />
          ) : (
            <>
              <Building2 size={28} className="text-muted" />
              <p className="text-sm text-muted font-medium">클릭하여 회사 직인 등록</p>
              <p className="text-xs text-muted">PNG · JPEG · WebP, 최대 2MB</p>
            </>
          )}
        </div>
      )}

      <input
        ref={sealFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUploadCompanySeal(file);
          event.target.value = '';
        }}
      />
    </div>
    </>)}
    </div>
  );
}
