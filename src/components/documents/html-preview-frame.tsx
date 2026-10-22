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
    const cw = ifr.clientWidth || ifr.offsetWidth;
    const sw = Math.max(doc.body.scrollWidth, doc.documentElement.scrollWidth);
    const scale = sw > cw && sw > 0 ? cw / sw : 1;
    const el = doc.body;
    el.style.transformOrigin = 'top left';
    el.style.transform = `scale(${scale})`;
    el.style.margin = '0';
    const sh = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
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
