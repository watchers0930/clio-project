'use client';

import { useEffect, useRef, useState } from 'react';

interface HtmlPreviewFrameProps {
  html: string;
  title: string;
  className?: string;
  /** true면 A4 고정폭 콘텐츠를 컨테이너 폭에 맞춰 축소하고 높이를 콘텐츠에 맞춰 스크롤을 없앤다. */
  fit?: boolean;
}

export function HtmlPreviewFrame({ html, title, className, fit }: HtmlPreviewFrameProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [fittedHeight, setFittedHeight] = useState<number | null>(null);

  useEffect(() => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url); // eslint-disable-line react-hooks/set-state-in-effect -- sync blob URL from external Blob API
    prevUrlRef.current = url;
    return () => { URL.revokeObjectURL(url); };
  }, [html]);

  // 콘텐츠 폭에 맞춰 축소(가로 스크롤 제거) + 축소 높이로 iframe 높이 고정(세로 스크롤 제거)
  const handleLoad = () => {
    if (!fit) return;
    const ifr = iframeRef.current;
    const doc = ifr?.contentDocument;
    if (!ifr || !doc?.body) return;
    const el = doc.body;
    // A4 인쇄 여백(body padding 20mm 등)은 화면 미리보기에선 불필요하게 커서 내용을 작게 만든다.
    // 화면용으로 축소해 콘텐츠를 키운 뒤 scale/높이를 측정한다.
    el.style.margin = '0';
    el.style.padding = '10px';
    el.style.boxSizing = 'border-box';
    const cw = ifr.clientWidth || ifr.offsetWidth;
    const sw = Math.max(el.scrollWidth, doc.documentElement.scrollWidth);
    const scale = sw > cw && sw > 0 ? cw / sw : 1;
    el.style.transformOrigin = 'top left';
    el.style.transform = `scale(${scale})`;
    const sh = Math.max(el.scrollHeight, doc.documentElement.scrollHeight);
    setFittedHeight(Math.ceil(sh * scale));
  };

  if (!blobUrl) return null;

  return (
    <iframe
      ref={iframeRef}
      title={title}
      src={blobUrl}
      onLoad={handleLoad}
      scrolling={fit ? 'no' : undefined}
      className={className}
      style={fit && fittedHeight ? { height: fittedHeight, width: '100%' } : undefined}
    />
  );
}
