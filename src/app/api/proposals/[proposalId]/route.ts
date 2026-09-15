// src/app/api/proposals/[proposalId]/route.ts
import { NextResponse } from 'next/server';
import { globalRepo } from '@/lib/store/repository';
import { ensureInitialized } from '@/lib/store/init';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  ensureInitialized();
  const { proposalId } = await params;
  const proposal = globalRepo.proposals.get(proposalId);

  if (!proposal) {
    return NextResponse.json({ error: '제안서를 찾을 수 없습니다.' }, { status: 404 });
  }

  const project = globalRepo.getProject(proposal.project_id);
  const baseline = globalRepo.getBaselineScope(proposal.project_id);
  const versions = globalRepo.listProposalVersions(proposalId).map(v => {
    // Check if share link exists
    const link = Array.from(globalRepo.shareLinks.values()).find(
      l => l.proposal_version_id === v.id
    );
    const decision = globalRepo.customerDecisions.get(v.id) || null;

    return {
      ...v,
      shareLink: link || null,
      decision,
    };
  });

  return NextResponse.json({
    proposal,
    project,
    baseline,
    versions,
  });
}
