// src/app/api/projects/[projectId]/route.ts
import { NextResponse } from 'next/server';
import { globalRepo } from '@/lib/store/repository';
import { DEMO_OWNER_ID } from '@/lib/store/seed';
import { ensureInitialized } from '@/lib/store/init';
import { calculateCurrentScope } from '@/lib/domain/scope-engine';

export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  ensureInitialized();
  const { projectId } = await params;
  const project = globalRepo.getProject(projectId);

  if (!project) {
    return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
  }

  const baseline = globalRepo.getBaselineScope(projectId);
  const scopeChanges = globalRepo.getScopeChanges(projectId);

  // Proposal version details map
  const versionDetails = new Map();
  for (const sc of scopeChanges) {
    const v = globalRepo.getProposalVersion(sc.proposal_version_id);
    if (v) {
      versionDetails.set(v.id, {
        fee_mode: v.fee_mode,
        additional_amount_minor: v.additional_amount_minor,
        schedule_mode: v.schedule_mode,
        proposed_due_date: v.proposed_due_date,
      });
    }
  }

  const currentScope = baseline
    ? calculateCurrentScope(baseline, project.currency, scopeChanges, versionDetails)
    : null;

  // Requests
  const requests = Array.from(globalRepo.requests.values())
    .filter(r => r.project_id === projectId)
    .map(r => ({
      ...r,
      items: globalRepo.listRequestItems(r.id),
    }));

  // Proposals
  const proposals = Array.from(globalRepo.proposals.values())
    .filter(p => p.project_id === projectId)
    .map(p => {
      const versions = globalRepo.listProposalVersions(p.id);
      return {
        ...p,
        versions: versions.map(v => ({
          ...v,
          decision: globalRepo.customerDecisions.get(v.id) || null,
        })),
      };
    });

  return NextResponse.json({
    project,
    baseline,
    currentScope,
    requests,
    proposals,
    scopeChanges,
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  ensureInitialized();
  const { projectId } = await params;
  const ok = globalRepo.deleteProject(projectId, DEMO_OWNER_ID);

  if (!ok) {
    return NextResponse.json({ error: '삭제 권한이 없거나 이미 삭제되었습니다.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
