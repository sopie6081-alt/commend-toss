'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Sparkles, ArrowLeft, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [currency, setCurrency] = useState<'KRW' | 'USD' | 'EUR' | 'JPY'>('KRW');
  const [taxTreatment, setTaxTreatment] = useState<'inclusive' | 'exclusive' | 'unspecified'>('inclusive');
  const [sourceText, setSourceText] = useState('');
  const [deliverables, setDeliverables] = useState<string[]>([
    '메인 웹사이트 디자인 및 반응형 퍼블리싱',
    '서브 페이지 3종 (소개, 서비스, 문의)',
  ]);
  const [initialAmount, setInitialAmount] = useState<number>(3000000);
  const [initialDeadline, setInitialDeadline] = useState<string>('2026-11-30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddDeliverable = () => {
    setDeliverables([...deliverables, '']);
  };

  const handleDeliverableChange = (idx: number, val: string) => {
    const updated = [...deliverables];
    updated[idx] = val;
    setDeliverables(updated);
  };

  const handleRemoveDeliverable = (idx: number) => {
    setDeliverables(deliverables.filter((_, i) => i !== idx));
  };

  const handleExtractFromText = () => {
    if (!sourceText.trim()) {
      setError('먼저 견적서나 합의문 내용을 입력해 주세요.');
      return;
    }
    setError(null);
    // Simple intuitive parser for deliverables and price
    const lines = sourceText.split('\n').map(l => l.trim()).filter(Boolean);
    const extracted: string[] = [];
    for (const l of lines) {
      if (l.includes('페이지') || l.includes('제작') || l.includes('디자인') || l.includes('개발')) {
        extracted.push(l.replace(/^[-*•\d.]+\s*/, ''));
      }
    }
    if (extracted.length > 0) {
      setDeliverables(extracted);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          customer_name: customerName,
          currency,
          tax_treatment: taxTreatment,
          source_text: sourceText,
          deliverables: deliverables.filter(d => d.trim().length > 0),
          initial_amount: Number(initialAmount),
          initial_deadline: initialDeadline,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/projects/${data.project.id}`);
      } else {
        const data = await res.json();
        setError(data.error || '프로젝트 생성에 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar current="projects" />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <Link
            href="/projects"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium mb-3 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            프로젝트 목록으로 돌아가기
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">새 프로젝트 생성</h1>
          <p className="text-sm text-slate-500 mt-1">
            고객과 합의한 최초 견적 및 기준 작업 범위를 등록합니다.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="projectName" className="block text-xs font-semibold text-slate-700 mb-1.5">
                프로젝트명 *
              </label>
              <input
                id="projectName"
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="예: 브랜드 웹사이트 리뉴얼"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
              />
            </div>

            <div>
              <label htmlFor="customerName" className="block text-xs font-semibold text-slate-700 mb-1.5">
                고객명 (기업 또는 담당자) *
              </label>
              <input
                id="customerName"
                type="text"
                required
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="예: 주식회사 핀토스"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="currency" className="block text-xs font-semibold text-slate-700 mb-1.5">
                통화 (프로젝트 생성 후 변경 불가)
              </label>
              <select
                id="currency"
                value={currency}
                onChange={e => setCurrency(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-600 transition"
              >
                <option value="KRW">KRW (원, ₩)</option>
                <option value="USD">USD (달러, $)</option>
                <option value="EUR">EUR (유로, €)</option>
                <option value="JPY">JPY (엔, ¥)</option>
              </select>
            </div>

            <div>
              <label htmlFor="taxTreatment" className="block text-xs font-semibold text-slate-700 mb-1.5">
                세금 포함 여부
              </label>
              <select
                id="taxTreatment"
                value={taxTreatment}
                onChange={e => setTaxTreatment(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-600 transition"
              >
                <option value="inclusive">부가가치세(VAT) 포함</option>
                <option value="exclusive">부가가치세(VAT) 별도</option>
                <option value="unspecified">세금 미지정</option>
              </select>
            </div>
          </div>

          {/* Agreement Source Text */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="sourceText" className="block text-xs font-semibold text-slate-700">
                견적서 / 합의문 원문 붙여넣기
              </label>
              <button
                type="button"
                onClick={handleExtractFromText}
                className="inline-flex items-center gap-1 text-xs text-teal-700 hover:text-teal-900 font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                원문에서 산출물 추출
              </button>
            </div>
            <textarea
              id="sourceText"
              rows={5}
              value={sourceText}
              onChange={e => setSourceText(e.target.value)}
              placeholder={`[견적 합의문 내용 예시]
1. 작업 범위: 반응형 웹 5개 페이지 제작 (홈, 소개, 서비스, 요금, 문의)
2. 제외 사항: 목록 외 페이지는 별도 협의 대상입니다.
3. 최초 납기: 2026-11-30 / 합의 금액: 3,000,000원`}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition font-mono text-xs"
            />
          </div>

          {/* Deliverables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700">
                기준 산출물 목록 (확정 후 정정은 변경 제안으로 기록)
              </label>
              <button
                type="button"
                onClick={handleAddDeliverable}
                className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                항목 추가
              </button>
            </div>
            <div className="space-y-2">
              {deliverables.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={e => handleDeliverableChange(idx, e.target.value)}
                    placeholder={`산출물 ${idx + 1}`}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-600"
                  />
                  {deliverables.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDeliverable(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 transition"
                      aria-label="항목 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Initial Fee & Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label htmlFor="initialAmount" className="block text-xs font-semibold text-slate-700 mb-1.5">
                최초 합의 금액 ({currency})
              </label>
              <input
                id="initialAmount"
                type="number"
                value={initialAmount}
                onChange={e => setInitialAmount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label htmlFor="initialDeadline" className="block text-xs font-semibold text-slate-700 mb-1.5">
                최초 합의 납기
              </label>
              <input
                id="initialDeadline"
                type="date"
                value={initialDeadline}
                onChange={e => setInitialDeadline(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link
              href="/projects"
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-lg transition shadow-sm disabled:opacity-50"
            >
              {loading ? '프로젝트 생성 중...' : '프로젝트 및 기준 범위 생성'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
