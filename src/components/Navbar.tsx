import React from 'react';
import Link from 'next/link';
import { Layers, FolderKanban, ShieldCheck, User } from 'lucide-react';

interface NavbarProps {
  current?: 'projects' | 'auth';
}

export const Navbar: React.FC<NavbarProps> = ({ current = 'projects' }) => {
  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/projects" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-teal-700 transition">
              S
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">
              Scope<span className="text-teal-600">Note</span>
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
            <Link
              href="/projects"
              className={`px-3 py-2 rounded-md transition ${
                current === 'projects'
                  ? 'bg-teal-50 text-teal-800 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              내 프로젝트
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            로컬 세션 모드
          </span>
          <Link
            href="/auth"
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 py-1.5 px-3 border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition"
          >
            <User className="w-3.5 h-3.5" />
            계정 안내
          </Link>
        </div>
      </div>
    </header>
  );
};
