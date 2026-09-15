'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import {
  FolderKanban,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ArrowUpRight,
  FileText,
} from 'lucide-react';
import { Project } from '@/types/database';

interface ProjectWithStats extends Project {
  pending_proposals_count: number;
  recent_decision?: {
    decision: 'approved' | 'revision_requested';
    customer_name: string;
    decided_at: string;
  } | null;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar current="projects" />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="text-xs font-semibold text-teal-700 tracking-wider uppercase mb-1">
              디자이너 작업 관리
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              내 프로젝트
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              고객 합의 범위와 추가 요청 변경안을 한눈에 추적합니다.
            </p>
          </div>

          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            새 프로젝트 생성
          </Link>
        </div>

        {/* Project List / Empty State */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            프로젝트 정보를 불러오는 중입니다...
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto my-12 shadow-sm">
            <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <FolderKanban className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              등록된 프로젝트가 없습니다
            </h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              견적서나 합의문을 붙여넣고 첫 프로젝트를 만들어보세요.<br />
              고객의 새 요청이 들어왔을 때 범위를 쉽게 분별할 수 있습니다.
            </p>
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              첫 프로젝트 시작하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group bg-white border border-slate-200 hover:border-teal-400 rounded-xl p-5 transition shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
                      {project.customer_name}
                    </span>
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                      rev.{project.scope_revision}
                    </span>
                  </div>

                  <h2 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition line-clamp-1 mb-2">
                    {project.name}
                  </h2>

                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                    <span>통화: {project.currency}</span>
                    <span>•</span>
                    <span>
                      {project.tax_treatment === 'inclusive'
                        ? 'VAT 포함'
                        : project.tax_treatment === 'exclusive'
                        ? 'VAT 별도'
                        : '세금 미지정'}
                    </span>
                  </div>
                </div>

                {/* Status Banners (Pending response & Recent decision) */}
                <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                  {project.pending_proposals_count > 0 ? (
                    <div className="flex items-center justify-between text-amber-700 bg-amber-50 border border-amber-200/60 px-2.5 py-1.5 rounded-md">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                        고객 응답 대기 제안
                      </span>
                      <strong className="font-semibold">{project.pending_proposals_count}건</strong>
                    </div>
                  ) : (
                    <div className="text-slate-400 text-xs py-1">
                      대기 중인 제안 없음
                    </div>
                  )}

                  {project.recent_decision && (
                    <div className="flex items-center justify-between text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-md">
                      <span className="flex items-center gap-1.5">
                        {project.recent_decision.decision === 'approved' ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        )}
                        최근 결정
                      </span>
                      <span className="font-medium text-slate-900">
                        {project.recent_decision.decision === 'approved' ? '전체 승인' : '수정 요청'}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
