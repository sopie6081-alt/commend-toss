'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import {
  ArrowLeft,
  Plus,
  Clock,
  CheckCircle,
  FileText,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  Trash2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { CalculatedCurrentScope } from '@/lib/domain/scope-engine';
import { BaselineScope, Project } from '@/types/database';

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const router = useRouter();

  const [data, setData] = useState<{
    project: Project;
    baseline: BaselineScope;
    currentScope: CalculatedCurrentScope | null;
    requests: any[];
    proposals: any[];
    scopeChanges: any[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [newRequestText, setNewRequestText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        router.push('/projects');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const handleAnalyzeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequestText.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sourceText: newRequestText,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        router.push(`/projects/${projectId}/requests/${json.request.id}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm('정말로 이 프로젝트를 삭제하시겠습니까? 연결된 모든 링크는 즉시 폐기됩니다.')) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/projects');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
          프로젝트를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  const { project, baseline, currentScope, requests, proposals, scopeChanges } = data;

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('ko-KR').format(val) + (project.currency === 'KRW' ? '원' : ` ${project.currency}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar current="projects" />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Navigation & Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium mb-2 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              전체 프로젝트로 돌아가기
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-teal-100 text-teal-800 rounded-full">
                합의 rev.{project.scope_revision}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              고객: <strong className="text-slate-700">{project.customer_name}</strong> | 통화: {project.currency}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeleteProject}
              className="px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              프로젝트 삭제
            </button>
          </div>
        </div>

        {/* Current Agreed Scope Card vs Baseline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Current Scope (Left 2 cols) */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
                <h2 className="text-base font-bold text-slate-900">현재 합의 범위 (Active Scope)</h2>
              </div>
              <span className="text-xs text-slate-500">
                승인된 변경 {scopeChanges.length}건 누적 반영됨
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <span className="text-xs text-slate-500 font-medium block">현재 합의 금액</span>
                <span className="text-xl font-bold text-slate-900">
                  {formatMoney(currentScope?.total_amount_minor || 0)}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  최초 {formatMoney(baseline.structured_scope.initial_amount_minor || 0)}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-500 font-medium block">현재 합의 납기</span>
                <span className="text-xl font-bold text-slate-900">
                  {currentScope?.current_deadline || '미정'}
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  최초 {baseline.structured_scope.initial_deadline || '미정'}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                현재 산출물 목록 ({currentScope?.deliverables.length || 0})
              </h3>
              <ul className="space-y-2">
                {currentScope?.deliverables.map((del, idx) => (
                  <li
                    key={del.id || idx}
                    className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-800 flex items-start gap-2.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="font-medium">{del.title}</span>
                      {del.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{del.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Initial Baseline (Right 1 col) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-bold text-slate-800">최초 기준 범위 (Baseline)</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              확정된 최초 합의는 불변이며 모든 정정은 변경 제안으로 기록됩니다.
            </p>

            <div className="space-y-3 text-xs text-slate-600">
              <div>
                <strong className="block text-slate-700 mb-1 font-semibold">포함 작업:</strong>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  {baseline.structured_scope.inclusions?.map((inc, i) => (
                    <li key={i}>{inc}</li>
                  ))}
                </ul>
              </div>

              <div>
                <strong className="block text-slate-700 mb-1 font-semibold">제외 사항:</strong>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  {baseline.structured_scope.exclusions?.map((exc, i) => (
                    <li key={i}>{exc}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-200/60">
                <details className="cursor-pointer">
                  <summary className="text-slate-600 font-semibold hover:text-slate-900">
                    합의문 원문 보기
                  </summary>
                  <pre className="mt-2 p-2 bg-white rounded border border-slate-200 text-slate-700 font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto">
                    {baseline.source_text}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        </div>

        {/* Action: Enter New Customer Request */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-900">새 고객 요청 입력 및 분석</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            카카오톡, 슬랙, 이메일로 받은 고객의 추가 요청 메시지를 붙여넣으면 기준 범위와 대조하여 자동 분류합니다.
          </p>

          <form onSubmit={handleAnalyzeRequest} className="space-y-3">
            <textarea
              rows={4}
              required
              value={newRequestText}
              onChange={e => setNewRequestText(e.target.value)}
              placeholder="예: 안녕하세요! 혹시 요금안내 외에 실시간 가격 비교 페이지 하나 더 추가해주실 수 있을까요? 그리고 기존 홈 화면 타이틀 문구도 조금만 바꿔주세요."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                외부 AI 키 미설정 시 내장된 지능형 규칙 검증기가 즉시 작동합니다.
              </span>
              <button
                type="submit"
                disabled={analyzing}
                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {analyzing ? '요청 분석 중...' : '요청 분석 및 검토하기'}
              </button>
            </div>
          </form>
        </section>

        {/* Proposals List */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">변경 제안 (Proposals) 목록</h2>

          {proposals.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-400">
              아직 작성된 변경 제안서가 없습니다. 위의 고객 요청을 입력하거나 검토를 시작하세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {proposals.map(proposal => {
                const latestVersion = proposal.versions[0];
                return (
                  <Link
                    key={proposal.id}
                    href={`/projects/${projectId}/proposals/${proposal.id}`}
                    className="bg-white border border-slate-200 hover:border-teal-400 rounded-xl p-4 transition shadow-sm flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-slate-900">
                          제안서 #{proposal.id.slice(0, 8)}
                        </span>
                        {latestVersion && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-semibold ${
                              latestVersion.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : latestVersion.status === 'pending'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : latestVersion.status === 'revision_requested'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {latestVersion.status === 'approved'
                              ? '고객 승인 완료'
                              : latestVersion.status === 'pending'
                              ? '고객 응답 대기'
                              : latestVersion.status === 'revision_requested'
                              ? '수정 요청'
                              : latestVersion.status === 'withdrawn'
                              ? '철회됨'
                              : latestVersion.status === 'expired'
                              ? '만료됨'
                              : '초안(Draft)'}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          v{latestVersion?.version_number || 1}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500">
                        변경 항목 {latestVersion?.changes?.length || 0}건 | 추가 금액:{' '}
                        {latestVersion?.fee_mode === 'amount'
                          ? formatMoney(latestVersion.additional_amount_minor)
                          : latestVersion?.fee_mode === 'no_change'
                          ? '변동 없음'
                          : '미정'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-teal-700 font-semibold group-hover:translate-x-0.5 transition">
                      제안서 상세 <ChevronRight className="w-4 h-4" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
