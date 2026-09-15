'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import {
  ArrowLeft,
  Share2,
  Copy,
  Check,
  Ban,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  History,
  FileCheck,
} from 'lucide-react';
import { Proposal, ProposalVersion, Project } from '@/types/database';

export default function ProposalDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; proposalId: string }>;
}) {
  const { projectId, proposalId } = use(params);
  const router = useRouter();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [newVersioning, setNewVersioning] = useState(false);
  const [generatedShareUrl, setGeneratedShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch(`/api/proposals/${proposalId}`);
      if (res.ok) {
        const json = await res.json();
        setProposal(json.proposal);
        setProject(json.project);
        setVersions(json.versions);
        if (json.versions.length > 0 && !activeVersionId) {
          setActiveVersionId(json.versions[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [proposalId]);

  const activeVersion = versions.find(v => v.id === activeVersionId) || versions[0];

  const handleShare = async () => {
    if (!activeVersion) return;
    setSharing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proposals/${proposalId}/versions/${activeVersion.id}/share`,
        { method: 'POST' }
      );
      const json = await res.json();
      if (res.ok) {
        const fullUrl = `${window.location.origin}${json.shareUrl}`;
        setGeneratedShareUrl(fullUrl);
        await loadData();
      } else {
        setError(json.error || '공유 링크 생성에 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSharing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!activeVersion) return;
    if (!confirm('이 제안을 철회하시겠습니까? 고객에게 전달된 링크는 즉시 폐기됩니다.')) return;
    setWithdrawing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proposals/${proposalId}/versions/${activeVersion.id}/withdraw`,
        { method: 'POST' }
      );
      const json = await res.json();
      if (res.ok) {
        setGeneratedShareUrl(null);
        await loadData();
      } else {
        setError(json.error || '철회 처리에 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setWithdrawing(false);
    }
  };

  const handleCreateNewVersion = async () => {
    if (!activeVersion) return;
    setNewVersioning(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proposals/${proposalId}/versions/${activeVersion.id}/new-version`,
        { method: 'POST' }
      );
      const json = await res.json();
      if (res.ok) {
        await loadData();
        setActiveVersionId(json.version.id);
        setGeneratedShareUrl(null);
      } else {
        setError(json.error || '새 버전 생성에 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setNewVersioning(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedShareUrl) return;
    navigator.clipboard.writeText(generatedShareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !activeVersion) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
          제안서 정보를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('ko-KR').format(val) + (project?.currency === 'KRW' ? '원' : ` ${project?.currency}`);
  };

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">
                  변경 제안서 #{proposal?.id.slice(0, 8)}
                </h1>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                    activeVersion.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : activeVersion.status === 'pending'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : activeVersion.status === 'revision_requested'
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : activeVersion.status === 'withdrawn'
                      ? 'bg-slate-200 text-slate-700'
                      : activeVersion.status === 'expired'
                      ? 'bg-slate-200 text-slate-700'
                      : 'bg-teal-50 text-teal-800 border border-teal-200'
                  }`}
                >
                  {activeVersion.status === 'approved'
                    ? '고객 전체 승인'
                    : activeVersion.status === 'pending'
                    ? '고객 응답 대기 (공유됨)'
                    : activeVersion.status === 'revision_requested'
                    ? '고객 수정 요청'
                    : activeVersion.status === 'withdrawn'
                    ? '철회됨'
                    : activeVersion.status === 'expired'
                    ? '만료됨'
                    : '초안 (작성 중)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                기준 합의 리비전: rev.{activeVersion.base_scope_revision} | 현재 프로젝트 리비전: rev.{project?.scope_revision}
              </p>
            </div>

            {/* Version Switcher */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-lg">
              {versions.map(v => (
                <button
                  key={v.id}
                  onClick={() => {
                    setActiveVersionId(v.id);
                    setGeneratedShareUrl(null);
                  }}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${
                    v.id === activeVersion.id
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  v{v.version_number}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold whitespace-pre-wrap">
            {error}
          </div>
        )}

        {/* Share Link Banner if Active */}
        {generatedShareUrl && (
          <div className="mb-6 p-4 bg-teal-50 border border-teal-200 rounded-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-teal-900 block mb-1">
                  고객 공유 링크가 생성되었습니다 (보안 토큰 적용)
                </span>
                <p className="text-xs text-teal-700">
                  데이터베이스에는 토큰 해시만 저장되며, 원본 링크는 지금 즉시 복사하여 고객에게 전달하세요.
                </p>
                <div className="mt-2 text-xs font-mono text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-teal-200 break-all select-all">
                  {generatedShareUrl}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-sm"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? '복사 완료' : '링크 복사'}
                </button>
                <a
                  href={generatedShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-teal-700 hover:bg-teal-100 rounded-lg transition"
                  title="고객 화면 미리보기"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Customer Decision Result Card if already decided */}
        {activeVersion.decision && (
          <div
            className={`mb-6 p-5 rounded-2xl border ${
              activeVersion.decision.decision === 'approved'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm mb-2">
              {activeVersion.decision.decision === 'approved' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              )}
              {activeVersion.decision.decision === 'approved'
                ? '고객이 제안서를 전체 승인했습니다.'
                : '고객이 수정을 요청했습니다.'}
            </div>
            <p className="text-xs">
              확인자: <strong>{activeVersion.decision.customer_name}</strong> | 일시:{' '}
              {new Date(activeVersion.decision.decided_at).toLocaleString('ko-KR')}
            </p>
            {activeVersion.decision.comment && (
              <div className="mt-3 p-3 bg-white/80 rounded-xl border border-current text-xs">
                <strong>고객 의견:</strong> {activeVersion.decision.comment}
              </div>
            )}
          </div>
        )}

        {/* Version Details Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <span className="text-xs text-slate-500 font-medium block">추가 금액</span>
              <span className="text-xl font-bold text-slate-900">
                {activeVersion.fee_mode === 'amount'
                  ? `+ ${formatMoney(activeVersion.additional_amount_minor)}`
                  : activeVersion.fee_mode === 'no_change'
                  ? '금액 변동 없음 (0원)'
                  : '미정'}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">변경 납기</span>
              <span className="text-xl font-bold text-slate-900">
                {activeVersion.schedule_mode === 'date'
                  ? activeVersion.proposed_due_date
                  : activeVersion.schedule_mode === 'no_change'
                  ? '납기 변동 없음'
                  : '미정'}
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              제안 변경 내용 ({activeVersion.changes.length}건)
            </h2>
            <ul className="space-y-2">
              {activeVersion.changes.map((ch: any, i: number) => (
                <li
                  key={i}
                  className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-800 flex items-start justify-between gap-3"
                >
                  <div>
                    <span className="font-bold text-teal-800 mr-2">
                      [{ch.type === 'add' ? '신규 추가' : ch.type === 'update' ? '변경' : '제거'}]
                    </span>
                    <span className="font-semibold text-slate-900">{ch.title || ch.after}</span>
                    {ch.description && (
                      <p className="text-slate-500 text-xs mt-1">{ch.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {activeVersion.customer_message && (
            <div>
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                고객 안내 메시지
              </h2>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700 whitespace-pre-wrap">
                {activeVersion.customer_message}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* New Draft Version button */}
              {(activeVersion.status === 'revision_requested' ||
                activeVersion.status === 'pending' ||
                activeVersion.status === 'withdrawn') && (
                <button
                  type="button"
                  onClick={handleCreateNewVersion}
                  disabled={newVersioning}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {newVersioning ? '생성 중...' : '새 버전 작성 (v' + (activeVersion.version_number + 1) + ')'}
                </button>
              )}

              {/* Withdraw button */}
              {activeVersion.status === 'pending' && (
                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" />
                  {withdrawing ? '철회 중...' : '제안 철회 및 링크 폐기'}
                </button>
              )}
            </div>

            {/* Share button */}
            {activeVersion.status === 'draft' && (
              <button
                type="button"
                onClick={handleShare}
                disabled={sharing}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                {sharing ? '공유 링크 생성 중...' : '고객 공유 링크 생성 및 상태 고정'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
