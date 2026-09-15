'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { AlertCircle, CheckCircle2, Shield, Key, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleDemoLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setNotice('개발용 로컬 세션으로 로그인되었습니다.');
      setTimeout(() => {
        router.push('/projects');
      }, 800);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar current="auth" />

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900">ScopeNote 로그인</h1>
            <p className="text-sm text-slate-500 mt-1.5">
              1인 웹디자이너를 위한 합의 및 작업 범위 관리
            </p>
          </div>

          {/* Development / Environment Notice */}
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              개발 환경 및 Supabase 연동 안내
            </div>
            <p>
              운영 환경에서는 Supabase 이메일 매직 링크(Magic Link) 인증을 통해 보안 세션이 유지됩니다.
            </p>
            <p className="text-amber-800/80">
              현재 환경에 <code className="bg-amber-100/70 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code> 키가 없어도,
              <strong> 아래 이메일 입력 또는 '원클릭 데모 세션'</strong>을 통해 모든 UI와 수동 작성 및 승인 흐름을 즉시 검증할 수 있습니다.
            </p>
          </div>

          {notice && (
            <div className="mb-4 p-3 bg-teal-50 border border-teal-200 text-teal-800 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              {notice}
            </div>
          )}

          <form onSubmit={handleDemoLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                이메일 주소
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="designer@example.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm rounded-lg transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? '로그인 처리 중...' : '이메일로 계속하기'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setEmail('demo-designer@scopenote.app');
                setLoading(true);
                setTimeout(() => {
                  setLoading(false);
                  router.push('/projects');
                }, 400);
              }}
              className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition"
            >
              샘플 데이터 포함 데모로 바로 시작하기
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
