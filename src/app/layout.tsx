import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CLIO - AI 문서관리 시스템',
  description: 'RAG 기반 그룹 문서관리 플랫폼',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="h-full">{children}</body>
    </html>
  );
}
