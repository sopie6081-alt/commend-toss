// src/app/api/proposals/[proposalId]/versions/[versionId]/share/route.ts
import { NextResponse } from 'next/server';
import { globalRepo } from '@/lib/store/repository';
import { ensureInitialized } from '@/lib/store/init';
import { validateShareConditions } from '@/lib/domain/proposal-rules';
import { CustomerSnapshot } from '@/types/database';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ proposalId: string; versionId: string }> }
) {
  ensureInitialized();
  const { versionId } = await params;
  try {
    const version = globalRepo.getProposalVersion(versionId);
    if (!version) {
      return NextResponse.json({ error: '제안서 버전을 찾을 수 없습니다.' }, { status: 404 });
    }

    const project = globalRepo.getProject(version.project_id);
    if (!project) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const baseline = globalRepo.getBaselineScope(version.project_id);
    const hasOtherPending = Array.from(globalRepo.proposalVersions.values()).some(
      v => v.project_id === version.project_id && v.id !== version.id && v.status === 'pending'
    );

    // Get request items if linked
    const proposal = globalRepo.proposals.get(version.proposal_id);
    let allItemsReviewed = true;
    if (proposal && proposal.request_id) {
      const items = globalRepo.listRequestItems(proposal.request_id);
      allItemsReviewed = items.length === 0 || items.every(i => i.reviewed_at !== null);
    }

    // Validate precondition matrix
    const check = validateShareConditions({
      isBaselineConfirmed: !!(baseline && baseline.confirmed_at),
      allRequestItemsReviewed: allItemsReviewed,
      hasChanges: version.changes.length > 0,
      feeMode: version.fee_mode,
      additionalAmountMinor: version.additional_amount_minor,
      scheduleMode: version.schedule_mode,
      proposedDueDate: version.proposed_due_date,
      projectScopeRevision: project.scope_revision,
      proposalBaseScopeRevision: version.base_scope_revision,
      hasOtherActivePending: hasOtherPending,
    });

    if (!check.valid) {
      return NextResponse.json({ error: check.errors.join('\n') }, { status: 400 });
    }

    // Build immutable customer snapshot
    const snapshot: CustomerSnapshot = {
      project_name: project.name,
      customer_name: project.customer_name,
      version_number: version.version_number,
      currency: project.currency,
      changes: version.changes,
      excluded_items: version.excluded_items,
      fee_mode: version.fee_mode,
      additional_amount_minor: version.additional_amount_minor,
      schedule_mode: version.schedule_mode,
      proposed_due_date: version.proposed_due_date,
      customer_message: version.customer_message,
      baseline_summary: {
        deliverables: baseline ? baseline.structured_scope.deliverables.map(d => ({ id: d.id, title: d.title })) : [],
        initial_deadline: baseline ? baseline.structured_scope.initial_deadline : null,
      },
    };

    const { rawToken } = await globalRepo.shareProposal(version.id, snapshot);

    const shareUrl = `/s/${rawToken}`;
    return NextResponse.json({
      success: true,
      shareUrl,
      rawToken,
      versionStatus: 'pending',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
