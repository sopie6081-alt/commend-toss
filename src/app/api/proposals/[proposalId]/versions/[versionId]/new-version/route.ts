// src/app/api/proposals/[proposalId]/versions/[versionId]/new-version/route.ts
import { NextResponse } from 'next/server';
import { globalRepo } from '@/lib/store/repository';
import { ensureInitialized } from '@/lib/store/init';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ proposalId: string; versionId: string }> }
) {
  ensureInitialized();
  const { proposalId, versionId } = await params;
  try {
    const prevVersion = globalRepo.getProposalVersion(versionId);
    if (!prevVersion) {
      return NextResponse.json({ error: '이전 버전을 찾을 수 없습니다.' }, { status: 404 });
    }

    const project = globalRepo.getProject(prevVersion.project_id);
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }

    // If previous version was pending, withdraw it in the same transaction
    if (prevVersion.status === 'pending') {
      await globalRepo.withdrawProposal(prevVersion.id);
    }

    // Create new draft version
    const newVersion = globalRepo.createProposalVersion({
      proposal_id: proposalId,
      project_id: project.id,
      version_number: prevVersion.version_number + 1,
      base_scope_revision: project.scope_revision,
      changes: structuredClone(prevVersion.changes),
      excluded_items: [...prevVersion.excluded_items],
      fee_mode: prevVersion.fee_mode,
      additional_amount_minor: prevVersion.additional_amount_minor,
      schedule_mode: prevVersion.schedule_mode,
      proposed_due_date: prevVersion.proposed_due_date,
      customer_message: prevVersion.customer_message,
    });

    return NextResponse.json({ version: newVersion }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
