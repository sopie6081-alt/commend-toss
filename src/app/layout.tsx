import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ScopeNote — 작업 범위와 합의를 명확하게',
  description: '1인 웹디자이너를 위한 고객 추가 요청 분석 및 합의 변경 제안 서비스',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
