import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast';

type Density = 'sparse' | 'normal' | 'dense';

/**
 * 설정 > 서명 탭의 개인 전자 서명 / 회사 로고 워터마크 / 회사 직인에 대한
 * 로드·업로드·삭제·패턴 설정 상태와 핸들러를 한곳에 응집한 훅.
 * openConfirm/closeConfirm은 페이지 쉘이 소유한 확인 다이얼로그를 주입받는다.
 */
export function useSignatureSettings(
  tab: string,
  openConfirm: (title: string, description: string | undefined, onConfirm: () => void) => void,
  closeConfirm: () => void,
) {
  const toast = useToast();

  const [sigUrl, setSigUrl] = useState<string | null>(null);
  const [sigLoading, setSigLoading] = useState(false);
  const [sigUploading, setSigUploading] = useState(false);
  const sigFileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPatternDensity, setLogoPatternDensity] = useState<Density>('normal');
  const [logoSettingsSaving, setLogoSettingsSaving] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [sealUrl, setSealUrl] = useState<string | null>(null);
  const [sealLoading, setSealLoading] = useState(false);
  const [sealUploading, setSealUploading] = useState(false);
  const sealFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab !== 'signature') return;
    setSigLoading(true);
    fetch('/api/auth/signature')
      .then((response) => response.json())
      .then((data) => {
        if (data.success) setSigUrl(data.data?.url ?? null);
      })
      .catch(() => {})
      .finally(() => setSigLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== 'signature') return;
    setLogoLoading(true);
    fetch('/api/settings/company-logo')
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          setLogoUrl(data.data?.url ?? null);
          setLogoPatternDensity(data.data?.patternDensity ?? 'normal');
        }
      })
      .catch(() => {})
      .finally(() => setLogoLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== 'signature') return;
    setSealLoading(true);
    fetch('/api/settings/company-seal')
      .then((response) => response.json())
      .then((data) => { if (data.success) setSealUrl(data.data?.url ?? null); })
      .catch(() => {})
      .finally(() => setSealLoading(false));
  }, [tab]);

  const uploadCompanySeal = async (file: File) => {
    if (sealUploading) return;
    setSealUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/settings/company-seal', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setSealUrl(data.data?.url ?? null);
        toast.success('회사 직인이 등록되었습니다.');
      } else {
        toast.error(data.error ?? '업로드 실패');
      }
    } catch {
      toast.error('업로드 중 오류가 발생했습니다.');
    }
    setSealUploading(false);
  };

  const deleteCompanySeal = () => {
    openConfirm('회사 직인을 삭제하시겠습니까?', '삭제하면 재직증명서에 직인이 표시되지 않습니다.', async () => {
      try {
        await fetch('/api/settings/company-seal', { method: 'DELETE' });
        setSealUrl(null);
        toast.success('회사 직인이 삭제되었습니다.');
      } catch {
        toast.error('삭제 중 오류가 발생했습니다.');
      }
      closeConfirm();
    });
  };

  const uploadSignature = async (file: File) => {
    if (sigUploading) return;
    setSigUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/auth/signature', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setSigUrl(data.data?.url ?? null);
        toast.success('서명이 등록되었습니다.');
      } else {
        toast.error(data.error ?? '업로드 실패');
      }
    } catch {
      toast.error('업로드 중 오류가 발생했습니다.');
    }
    setSigUploading(false);
  };

  const deleteSignature = () => {
    openConfirm('서명을 삭제하시겠습니까?', '삭제된 서명은 복구할 수 없습니다.', async () => {
      try {
        await fetch('/api/auth/signature', { method: 'DELETE' });
        setSigUrl(null);
        toast.success('서명이 삭제되었습니다.');
      } catch {
        toast.error('삭제 중 오류가 발생했습니다.');
      }
      closeConfirm();
    });
  };

  const uploadCompanyLogo = async (file: File) => {
    if (logoUploading) return;
    setLogoUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/settings/company-logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        setLogoUrl(data.data?.url ?? null);
        toast.success('회사 로고가 등록되었습니다.');
      } else {
        toast.error(data.error ?? '업로드 실패');
      }
    } catch {
      toast.error('업로드 중 오류가 발생했습니다.');
    }
    setLogoUploading(false);
  };

  const deleteCompanyLogo = () => {
    openConfirm('회사 로고를 삭제하시겠습니까?', '삭제하면 문서 워터마크가 표시되지 않습니다.', async () => {
      try {
        await fetch('/api/settings/company-logo', { method: 'DELETE' });
        setLogoUrl(null);
        toast.success('회사 로고가 삭제되었습니다.');
      } catch {
        toast.error('삭제 중 오류가 발생했습니다.');
      }
      closeConfirm();
    });
  };

  const updateCompanyLogoPatternDensity = async (patternDensity: Density) => {
    if (logoSettingsSaving) return;
    const previous = logoPatternDensity;
    setLogoPatternDensity(patternDensity);
    setLogoSettingsSaving(true);

    try {
      const res = await fetch('/api/settings/company-logo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patternDensity }),
      });
      const data = await res.json();
      if (data.success) {
        setLogoPatternDensity(data.data?.patternDensity ?? patternDensity);
        toast.success('워터마크 패턴 설정이 저장되었습니다.');
      } else {
        setLogoPatternDensity(previous);
        toast.error(data.error ?? '설정 저장 실패');
      }
    } catch {
      setLogoPatternDensity(previous);
      toast.error('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setLogoSettingsSaving(false);
    }
  };

  return {
    sigUrl, sigLoading, sigUploading, sigFileRef,
    logoUrl, logoPatternDensity, logoSettingsSaving, logoLoading, logoUploading, logoFileRef,
    sealUrl, sealLoading, sealUploading, sealFileRef,
    uploadSignature, deleteSignature,
    uploadCompanyLogo, deleteCompanyLogo, updateCompanyLogoPatternDensity,
    uploadCompanySeal, deleteCompanySeal,
  };
}
