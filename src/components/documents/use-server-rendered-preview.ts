'use client';

import { useEffect, useState } from 'react';

interface ServerRenderTarget {
  id: string;
  template: string;
  templateId?: string | null;
  content?: string;
}

interface ServerRenderedPreview {
  html: string;
  loading: boolean;
  error: boolean;
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

  const enabled = !!doc && doc.template !== '제안서' && !!doc.templateId;
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
    // content: 저장 후 refetch 트리거 (편집 중 미저장 내용은 반영 안 함 = 불필요 호출 방지)
  }, [enabled, docId, font, content]);

  // 비활성(제안서·순수문서) 시엔 이전 문서의 잔여 상태를 노출하지 않도록 파생값 반환
  return enabled
    ? { html, loading, error }
    : { html: '', loading: false, error: false };
}
