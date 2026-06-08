'use client';

import { useEffect, useRef, useState } from 'react';

interface HtmlPreviewFrameProps {
  html: string;
  title: string;
  className?: string;
}

export function HtmlPreviewFrame({ html, title, className }: HtmlPreviewFrameProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url); // eslint-disable-line react-hooks/set-state-in-effect -- sync blob URL from external Blob API
    prevUrlRef.current = url;
    return () => { URL.revokeObjectURL(url); };
  }, [html]);

  if (!blobUrl) return null;

  return (
    <iframe
      title={title}
      src={blobUrl}
      className={className}
    />
  );
}
