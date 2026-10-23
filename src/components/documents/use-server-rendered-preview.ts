'use client';

import { useCallback, useEffect, useState } from 'react';
import { resolveDocumentInputForm } from '@/lib/documents/resolve-input-form';

interface ServerRenderTarget {
  id: string;
  template: string;
  templateId?: string | null;
  title?: string;
  content?: string;
}

// 빌트인 양식(template_id가 FK 제약으로 null 저장되는)을 제목으로 식별.
// download inline 렌더가 제목으로 번들을 복원하므로 이 문서도 서버 양식 렌더 대상이다.
// 업무일지는 입력값 편집·서버 inline 렌더 대상이므로 판별에 포함한다(기존 누락 보완).
export const BUILTIN_FORM_TITLE_RE = /주간\s*업무|품의서|휴가원|재직\s*증명서|근로계약서|업무\s*일지|업무일지/;
const EMBEDDED_INPUTS_RE = /^<!--(?:PROPOSAL_INPUTS|DOCUMENT_INPUTS):/;

interface ServerRenderedPreview {
  html: string;
  loading: boolean;
  error: boolean;
  /** 미리보기 실패 재시도용. content 변경 자동 재조회와 동일 effect를 재실행한다(중복 호출 없음). */
  refetch: () => void;
}

/**
 * 제안서를 제외한 템플릿 문서(품의서·사업계획서·재직증명서 등)는 DB의 templateBundle이
 * 있어야 렌더되므로 클라이언트에서 직접 만들 수 없다. 서버의 다운로드 inline 프리뷰
 * (`?format=pdf&inline=true`)가 templateBundle + documentInputs를 파싱해 완성된 HTML을
 * 반환하므로 그 결과를 가져와 iframe 프리뷰로 사용한다.
 *
 * 서버 렌더는 저장된 content 기준이라, 초안 편집 내용은 저장 후(content 변경 시)에 반영된다.
 */
export function useServerRenderedPreview(
  doc: ServerRenderTarget | null,
  font: string,
): ServerRenderedPreview {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // 명시적 재조회 트리거. 값 변경만으로도 effect가 돌고, 이 키를 올리면 동일 effect를 재실행한다.
  const [reloadKey, setReloadKey] = useState(0);
  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  // templateId가 있거나, 빌트인 양식(DOCUMENT_INPUTS 임베드)이면 서버 양식 렌더.
  // 식별은 제목 매칭(품의서·근로계약서 등 폭넓은 빌트인) 또는 공용 resolver(ID/메타로 복원 가능한
  // 4양식) 중 하나면 충족한다. BE의 inline 렌더도 같은 resolver를 우선 사용하므로, 제목을 바꾼
  // 재직증명서 등도 서버 렌더 대상으로 연결된다(제목 의존 한계 보완).
  const isBuiltinForm =
    !doc?.templateId &&
    EMBEDDED_INPUTS_RE.test(doc?.content ?? '') &&
    (BUILTIN_FORM_TITLE_RE.test(doc?.title ?? '') ||
      resolveDocumentInputForm({
        title: doc?.title ?? '',
        templateId: doc?.templateId ?? null,
        templateName: doc?.template ?? null,
        content: doc?.content ?? '',
      }).ok);
  const enabled = !!doc && doc.template !== '제안서' && (!!doc.templateId || isBuiltinForm);
  const docId = doc?.id ?? '';
  // content가 저장으로 갱신되면 refetch → "저장 후 반영"
  const content = doc?.content ?? '';

  useEffect(() => {
    if (!enabled || !docId) return;

    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 외부 fetch 시작 전 로딩 상태 동기화
    setLoading(true);
    setError(false);

    fetch(
      `/api/documents/${docId}/download?format=pdf&inline=true&font=${encodeURIComponent(font)}`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error('preview_failed');
        return res.text();
      })
      .then((text) => {
        setHtml(text);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError(true);
        setLoading(false);
      });

    return () => controller.abort();
    // content: 저장 후 재조회 트리거 (편집 중 미저장 내용은 반영 안 함 = 불필요 호출 방지)
    // reloadKey: 실패 재시도 등 명시적 refetch
  }, [enabled, docId, font, content, reloadKey]);

  // 비활성(제안서·순수문서) 시엔 이전 문서의 잔여 상태를 노출하지 않도록 파생값 반환
  return enabled
    ? { html, loading, error, refetch }
    : { html: '', loading: false, error: false, refetch };
}
