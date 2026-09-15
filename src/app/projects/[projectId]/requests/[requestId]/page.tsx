'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  FileText,
  Sparkles,
  ChevronRight,
  HelpCircle,
  Eye,
  Plus,
} from 'lucide-react';
import { RequestClassification, RequestItem, RequestRecord, Project } from '@/types/database';

export default function RequestReviewPage({
  params,
}: {
  params: Promise<{ projectId: string; requestId: string }>;
}) {
  const { projectId, requestId } = use(params);
  const router = useRouter();

  const [request, setRequest] = useState<RequestRecord | null>(null);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Proposal drafting form state
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [feeMode, setFeeMode] = useState<'amount' | 'no_change' | 'undecided'>('amount');
  const [additionalAmount, setAdditionalAmount] = useState<number>(300000);
  const [scheduleMode, setScheduleMode] = useState<'date' | 'no_change' | 'undecided'>('date');
  const [proposedDueDate, setProposedDueDate] = useState<string>('2026-11-10');
  const [customerMessage, setCustomerMessage] = useState<string>(
    '요청하신 추가 작업 건에 대한 범위 검토 및 견적 제안 내용입니다. 확인 부탁드립니다.'
  );

  const [creatingProposal, setCreatingProposal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch(`/api/requests/${requestId}`);
      if (res.ok) {
        const json = await res.json();
        setRequest(json.request);
        setItems(json.items);
        setProject(json.project);

        // Preselect additional_candidate items
        const addCandidates = json.items
          .filter((i: RequestItem) => i.classification === 'additional_candidate')
          .map((i: RequestItem) => i.id);
        setSelectedItemIds(addCandidates);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [requestId]);

  const handleClassificationChange = async (itemId: string, newClass: RequestClassification) => {
    try {
      const res = await fetch(`/api/requests/${requestId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classification: newClass,
          reason: '디자이너 수동 검토 완료',
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setItems(items.map(i => (i.id === itemId ? json.item : i)));
        // If changed to additional, ensure selected in proposal
        if (newClass === 'additional_candidate' && !selectedItemIds.includes(itemId)) {
          setSelectedItemIds([...selectedItemIds, itemId]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSelectItem = (id: string) => {
    if (selectedItemIds.includes(id)) {
      setSelectedItemIds(selectedItemIds.filter(i => i !== id));
    } else {
      setSelectedItemIds([...selectedItemIds, id]);
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate review completion
    const unreviewed = items.filter(i => !i.reviewed_at);
    if (unreviewed.length > 0) {
      setError('모든 요청 항목에 대해 검토(분류 확인 또는 변경)를 완료해 주세요.');
      return;
    }

    if (selectedItemIds.length === 0) {
      setError('제안서에 포함할 변경 항목을 1개 이상 선택해 주세요.');
      return;
    }

    setCreatingProposal(true);
    try {
      // Build changes payload
      const selectedItems = items.filter(i => selectedItemIds.includes(i.id));
      const changes = selectedItems.map(item => ({
        type: 'add',
        id: `del-req-${item.id.slice(0, 6)}`,
        title: item.description,
        description: item.reason,
        category: 'deliverable',
      }));

      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          requestId,
          changes,
          excluded_items: [],
          fee_mode: feeMode,
          additional_amount_minor: feeMode === 'amount' ? Number(additionalAmount) : 0,
          schedule_mode: scheduleMode,
          proposed_due_date: scheduleMode === 'date' ? proposedDueDate : null,
          customer_message: customerMessage,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        router.push(`/projects/${projectId}/proposals/${json.proposal.id}`);
      } else {
        const json = await res.json();
        setError(json.error || '제안서 생성에 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingProposal(false);
    }
  };

  if (loading || !request) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
          요청 및 분류 항목을 불러오는 중입니다...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar current="projects" />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {project?.name || '프로젝트'} 상세로 돌아가기
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">고객 요청 분류 검토 & 제안 작성</h1>
          <p className="text-xs text-slate-500 mt-1">
            원문 근거를 확인하고 항목별 분류를 확정한 후, 제안서에 포함할 항목과 금액·납기를 입력합니다.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Source Text Box */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-6">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-slate-500" />
            고객 메시지 원문
          </h2>
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
            {request.source_text}
          </div>
        </section>

        {/* Request Items Review List */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900">
              추출된 항목별 분류 및 검토 ({items.length}건)
            </h2>
            <span className="text-xs text-slate-500">
              모든 항목을 검토해야 공유 제안서 작성이 가능합니다.
            </span>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => {
              const isCandidate = item.classification === 'additional_candidate';
              const isIncluded = item.classification === 'included';
              const isClarification = item.classification === 'needs_clarification';

              return (
                <div
                  key={item.id}
                  className={`bg-white border rounded-xl p-5 transition shadow-sm ${
                    isCandidate
                      ? 'border-teal-300 ring-1 ring-teal-200/50'
                      : isIncluded
                      ? 'border-slate-200'
                      : 'border-amber-200 bg-amber-50/20'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        id={`select-${item.id}`}
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => handleToggleSelectItem(item.id)}
                        className="mt-1 w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                      />
                      <div>
                        <label
                          htmlFor={`select-${item.id}`}
                          className="text-sm font-bold text-slate-900 cursor-pointer"
                        >
                          {item.description}
                        </label>
                        <p className="text-xs text-slate-600 mt-1">{item.reason}</p>
                      </div>
                    </div>

                    {/* Classification Selector */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleClassificationChange(item.id, 'additional_candidate')}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition ${
                          isCandidate
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        추가 작업 후보
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClassificationChange(item.id, 'included')}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition ${
                          isIncluded
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        기존 범위 포함
                      </button>
                      <button
                        type="button"
                        onClick={() => handleClassificationChange(item.id, 'needs_clarification')}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition ${
                          isClarification
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        확인 필요
                      </button>
                    </div>
                  </div>

                  {/* Evidence & Quotes */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700">원문 인용 근거:</span>
                      {item.evidence && item.evidence.length > 0 ? (
                        item.evidence.map((ev, i) => (
                          <span
                            key={i}
                            className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-800 font-mono text-[11px]"
                          >
                            "{ev.quote}" ({ev.start}~{ev.end})
                          </span>
                        ))
                      ) : (
                        <span className="text-amber-600 font-medium">유효 원문 근거 없음</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      {item.reviewed_at ? (
                        <span className="text-emerald-700 font-medium flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          검토 완료
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          검토 대기
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Create Proposal Section */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900">새 변경 제안서 작성</h2>
          </div>
          <p className="text-xs text-slate-500 mb-6">
            선택된 {selectedItemIds.length}개 추가 항목에 대한 금액 및 납기 조건을 설정합니다.
          </p>

          <form onSubmit={handleCreateProposal} className="space-y-6">
            {/* Fee Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  금액 조건 (Fee Mode) *
                </label>
                <select
                  value={feeMode}
                  onChange={e => setFeeMode(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-600"
                >
                  <option value="amount">추가 금액 청구 (Amount)</option>
                  <option value="no_change">금액 변동 없음 (No change)</option>
                  <option value="undecided">미정 (공유 불가)</option>
                </select>
              </div>

              {feeMode === 'amount' && (
                <div>
                  <label htmlFor="additionalAmount" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    추가 금액 ({project?.currency}) *
                  </label>
                  <input
                    id="additionalAmount"
                    type="number"
                    required
                    value={additionalAmount}
                    onChange={e => setAdditionalAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>
              )}
            </div>

            {/* Schedule Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  납기 조건 (Schedule Mode) *
                </label>
                <select
                  value={scheduleMode}
                  onChange={e => setScheduleMode(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-600"
                >
                  <option value="date">납기 변경 (Date)</option>
                  <option value="no_change">납기 변동 없음 (No change)</option>
                  <option value="undecided">미정 (공유 불가)</option>
                </select>
              </div>

              {scheduleMode === 'date' && (
                <div>
                  <label htmlFor="proposedDueDate" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    제안 납기일 *
                  </label>
                  <input
                    id="proposedDueDate"
                    type="date"
                    required
                    value={proposedDueDate}
                    onChange={e => setProposedDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-600"
                  />
                </div>
              )}
            </div>

            {/* Customer Message */}
            <div>
              <label htmlFor="customerMessage" className="block text-xs font-semibold text-slate-700 mb-1.5">
                고객에게 전달할 설명 메시지
              </label>
              <textarea
                id="customerMessage"
                rows={3}
                value={customerMessage}
                onChange={e => setCustomerMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-600"
              />
            </div>

            {/* Action buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={creatingProposal}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-lg transition shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {creatingProposal ? '제안서 생성 중...' : '변경 제안서 초안 작성 완료'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
