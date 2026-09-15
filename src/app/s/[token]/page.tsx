'use client';

import React, { useEffect, useState, use } from 'react';
import {
  CheckCircle,
  AlertCircle,
  FileText,
  Clock,
  Send,
  ShieldCheck,
  Info,
  Layers,
} from 'lucide-react';
import { CustomerSnapshot } from '@/types/database';

export default function CustomerDecisionPublicPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    valid: boolean;
    status: string;
    snapshot?: CustomerSnapshot;
    versionNumber?: number;
    errorMessage?: string;
  } | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);
  const [revisionComment, setRevisionComment] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [decisionResult, setDecisionResult] = useState<{
    success: boolean;
    decision: string;
    customerName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPublicData = async () => {
    try {
      const res = await fetch(`/api/customer/${token}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublicData();
  }, [token]);

  const handleDecision = async (decisionType: 'approved' | 'revision_requested') => {
    if (!customerName.trim()) {
      setError('확인하시는 분의 성함을 입력해 주세요.');
      return;
    }
    if (decisionType === 'approved' && !confirmedCheckbox) {
      setError('제안 내용 및 변경 조건 확인에 체크해 주세요.');
      return;
    }
    if (decisionType === 'revision_requested' && !revisionComment.trim()) {
      setError('수정을 원하시는 구체적인 의견을 작성해 주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);

    // Generate client idempotency key
    const idempotencyKey = `decision-${token.slice(0, 16)}-${decisionType}-${customerName.trim()}`;

    try {
      const res = await fetch(`/api/customer/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: decisionType,
          customer_name: customerName.trim(),
          comment: decisionType === 'revision_requested' ? revisionComment.trim() : undefined,
          idempotency_key: idempotencyKey,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setDecisionResult({
          success: true,
          decision: decisionType,
          customerName: customerName.trim(),
        });
      } else {
        setError(json.error || '결정 처리 중 문제가 발생했습니다.');
      }
    } catch (err: any) {
      setError(err.message || '네트워크 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-sm text-slate-500 font-medium">
          제안서 내용을 확인하는 중입니다...
        </div>
      </div>
    );
  }

  // Error / Expired / Superseded / Revoked Link view
  if (!data?.valid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">제안서 확인 불가</h1>
          <p className="text-xs text-slate-600 leading-relaxed mb-6">
            {data?.errorMessage || '이전 버전입니다. 발신자에게 최신 제안을 확인해 주세요.'}
          </p>
          <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-4">
            ScopeNote · 안전한 합의 기록 시스템
          </div>
        </div>
      </div>
    );
  }

  const { snapshot, versionNumber } = data;
  if (!snapshot) return null;

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('ko-KR').format(val) + (snapshot.currency === 'KRW' ? '원' : ` ${snapshot.currency}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-start py-8 px-4 sm:px-6">
      {/* 360px safe mobile container */}
      <div className="w-full max-w-lg space-y-6">
        {/* Header Branding */}
        <header className="text-center pb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 border border-teal-200 rounded-full text-xs font-semibold text-teal-800 mb-3">
            <Layers className="w-3.5 h-3.5" />
            작업 범위 변경 제안서 (v{versionNumber})
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {snapshot.project_name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            수신: <strong>{snapshot.customer_name}</strong> 귀하
          </p>
        </header>

        {/* Completed Decision Screen */}
        {decisionResult ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center shadow-sm">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                decisionResult.decision === 'approved'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-amber-100 text-amber-600'
              }`}
            >
              <CheckCircle className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-bold text-slate-900 mb-2">
              {decisionResult.decision === 'approved'
                ? '제안서 승인이 완료되었습니다'
                : '수정 요청이 접수되었습니다'}
            </h2>

            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              확인자: <strong>{decisionResult.customerName}</strong><br />
              담당 디자이너에게 결정 사항이 즉시 전달되며, 승인된 내용은 현재 합의 범위에 기록됩니다.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500">
              안전하게 창을 닫으셔도 됩니다.
            </div>
          </div>
        ) : (
          <main className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            {/* Customer Message */}
            {snapshot.customer_message && (
              <div className="p-4 bg-teal-50/70 border border-teal-100 rounded-xl text-xs text-teal-900 leading-relaxed">
                <span className="font-bold block mb-1">디자이너 메시지</span>
                {snapshot.customer_message}
              </div>
            )}

            {/* Differences / Changes */}
            <div>
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                기존 합의와 달라지는 점 ({snapshot.changes.length}건)
              </h2>
              <ul className="space-y-2.5">
                {snapshot.changes.map((ch, idx) => {
                  const title = ch.type === 'add' ? ch.title : ch.type === 'update' ? `${ch.before} ➔ ${ch.after}` : `${ch.before} (제거)`;
                  const desc = ch.type === 'add' ? ch.description : ch.type === 'remove' ? ch.reason : undefined;
                  return (
                    <li
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs"
                    >
                      <div className="font-bold text-slate-900 mb-0.5">
                        {title}
                      </div>
                      {desc && (
                        <p className="text-slate-500 text-[11px]">{desc}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Fee & Deadline Grid */}
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">추가 금액</span>
                <span className="text-base sm:text-lg font-bold text-slate-900">
                  {snapshot.fee_mode === 'amount'
                    ? `+ ${formatMoney(snapshot.additional_amount_minor)}`
                    : snapshot.fee_mode === 'no_change'
                    ? '변동 없음'
                    : '미정'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 font-medium block">변경 납기일</span>
                <span className="text-base sm:text-lg font-bold text-slate-900">
                  {snapshot.schedule_mode === 'date'
                    ? snapshot.proposed_due_date
                    : snapshot.schedule_mode === 'no_change'
                    ? '변동 없음'
                    : '미정'}
                </span>
              </div>
            </div>

            {/* Excluded items */}
            {snapshot.excluded_items && snapshot.excluded_items.length > 0 && (
              <div>
                <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  이번 제안에 포함하지 않는 사항
                </h2>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-500">
                  {snapshot.excluded_items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium">
                {error}
              </div>
            )}

            {/* Confirmation & Decision Section */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div>
                <label htmlFor="clientName" className="block text-xs font-bold text-slate-800 mb-1.5">
                  확인자 성함 *
                </label>
                <input
                  id="clientName"
                  type="text"
                  required
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="예: 홍길동 팀장"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-teal-600 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  본 성함 입력은 본인 인증 또는 법적 전자서명이 아니며, 합의 결정 확인용입니다.
                </p>
              </div>

              <div className="flex items-start gap-2 pt-1">
                <input
                  id="scopeCheck"
                  type="checkbox"
                  checked={confirmedCheckbox}
                  onChange={e => setConfirmedCheckbox(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                />
                <label htmlFor="scopeCheck" className="text-xs text-slate-700 cursor-pointer leading-relaxed">
                  위 변경 내용과 추가 금액 및 납기 일정을 모두 확인하였으며 이에 동의합니다.
                </label>
              </div>

              {/* Revision Request Form Toggle */}
              {showRevisionForm && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label htmlFor="revisionComment" className="block text-xs font-bold text-slate-800">
                    수정 요청 의견 *
                  </label>
                  <textarea
                    id="revisionComment"
                    rows={3}
                    value={revisionComment}
                    onChange={e => setRevisionComment(e.target.value)}
                    placeholder="수정이 필요한 구체적인 사항이나 조율하고 싶은 납기/금액을 입력해 주세요."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-teal-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleDecision('revision_requested')}
                    disabled={submitting}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg transition disabled:opacity-50"
                  >
                    {submitting ? '전송 중...' : '수정 요청 의견 제출하기'}
                  </button>
                </div>
              )}

              {/* Decision Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleDecision('approved')}
                  disabled={submitting || !confirmedCheckbox}
                  className="w-full sm:flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  {submitting ? '처리 중...' : '제안서 전체 승인'}
                </button>

                {!showRevisionForm && (
                  <button
                    type="button"
                    onClick={() => setShowRevisionForm(true)}
                    disabled={submitting}
                    className="w-full sm:w-auto py-3 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition"
                  >
                    수정 요청하기
                  </button>
                )}
              </div>
            </div>
          </main>
        )}

        <footer className="text-center text-[11px] text-slate-400 pb-8">
          ScopeNote · 합의 변경 관리 솔루션
        </footer>
      </div>
    </div>
  );
}
