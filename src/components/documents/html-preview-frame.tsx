'use client';

interface HtmlPreviewFrameProps {
  html: string;
  title: string;
  className?: string;
}

export function HtmlPreviewFrame({ html, title, className }: HtmlPreviewFrameProps) {
  const previewUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

  return (
    <iframe
      title={title}
      src={previewUrl}
      className={className}
    />
  );
}
