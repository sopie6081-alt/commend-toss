// src/test/e2e-workflow.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ScopeRepository } from '@/lib/store/repository';
import { calculateCurrentScope } from '@/lib/domain/scope-engine';
import { validateShareConditions } from '@/lib/domain/proposal-rules';
import { runDeterministicLocalAnalysis } from '@/lib/ai/adapter';

describe('End-to-End Workflow: Project Creation -> Baseline -> Request -> Proposal -> Share -> Approve -> Scope Revision Update', () => {
  let repo: ScopeRepository;

  beforeEach(() => {
    repo = new ScopeRepository();
  });

  it('executes full designer lifecycle and verifies cumulative scope reflects customer decision', async () => {
    const ownerId = 'designer-1';

    // 1. Create project
    const project = repo.createProject({
      owner_id: ownerId,
      name: 'ABC 사옥 리뉴얼',
      customer_name: 'ABC 상사',
      currency: 'KRW',
      tax_treatment: 'inclusive',
      status: 'active',
    });
    expect(project.scope_revision).toBe(0);

    // 2. Set baseline scope
    const baseline = repo.setBaselineScope(
      project.id,
      '5개 페이지 제작. 목록 외 페이지 별도 협의.',
      {
        deliverables: [
          { id: 'del-1', title: '홈페이지' },
          { id: 'del-2', title: '회사 소개' },
        ],
        inclusions: ['PC/모바일 반응형'],
        exclusions: ['목록 외 페이지 별도 협의'],
        initial_amount_minor: 2500000,
        initial_deadline: '2026-10-31',
      }
    );

    // Initial scope check
    const initialScope = calculateCurrentScope(baseline, 'KRW', []);
    expect(initialScope.total_amount_minor).toBe(2500000);
    expect(initialScope.deliverables).toHaveLength(2);

    // 3. Customer sends request
    const customerMsg = '안녕하세요! 요금 비교 페이지 추가 부탁드립니다.';
    const requestRecord = repo.createRequest(project.id, customerMsg);

    const analyzed = runDeterministicLocalAnalysis(customerMsg, baseline);
    expect(analyzed).toHaveLength(1);
    const item = repo.addRequestItem({
      request_id: requestRecord.id,
      description: analyzed[0].description,
      ai_classification: analyzed[0].ai_classification,
      classification: analyzed[0].classification,
      reason: analyzed[0].reason,
      evidence: analyzed[0].evidence,
      user_modified: false,
      reviewed_at: null,
    });

    // 4. Precondition check: Cannot share if item is not reviewed
    const checkBeforeReview = validateShareConditions({
      isBaselineConfirmed: true,
      allRequestItemsReviewed: false,
      hasChanges: true,
      feeMode: 'amount',
      additionalAmountMinor: 400000,
      scheduleMode: 'date',
      proposedDueDate: '2026-11-15',
      projectScopeRevision: project.scope_revision,
      proposalBaseScopeRevision: 0,
      hasOtherActivePending: false,
    });
    expect(checkBeforeReview.valid).toBe(false);
    expect(checkBeforeReview.errors[0]).toContain('검토가 완료되어야');

    // 5. Designer reviews item
    repo.updateRequestItemClassification(item.id, 'additional_candidate', '디자이너 검토 확인');

    // 6. Create proposal
    const proposal = repo.createProposal(project.id, requestRecord.id);
    const version = repo.createProposalVersion({
      proposal_id: proposal.id,
      project_id: project.id,
      version_number: 1,
      base_scope_revision: project.scope_revision,
      changes: [
        {
          type: 'add',
          id: 'del-pricing',
          title: '요금 비교 페이지 추가',
          category: 'deliverable',
        },
      ],
      excluded_items: [],
      fee_mode: 'amount',
      additional_amount_minor: 400000,
      schedule_mode: 'date',
      proposed_due_date: '2026-11-15',
      customer_message: '요청하신 추가 건 견적입니다.',
    });

    // 7. Share proposal (generates secure token, sets snapshot, transitions to pending)
    const { rawToken } = await repo.shareProposal(version.id, {
      project_name: project.name,
      customer_name: project.customer_name,
      version_number: 1,
      currency: 'KRW',
      changes: version.changes,
      excluded_items: [],
      fee_mode: 'amount',
      additional_amount_minor: 400000,
      schedule_mode: 'date',
      proposed_due_date: '2026-11-15',
      baseline_summary: { deliverables: [] },
    });
    expect(version.status).toBe('pending');

    // 8. Customer views proposal by token
    const publicView = repo.getPublicProposalByToken(rawToken);
    expect(publicView.valid).toBe(true);
    expect(publicView.snapshot?.additional_amount_minor).toBe(400000);

    // 9. Customer approves proposal
    const decisionResult = await repo.processCustomerDecision({
      rawToken,
      decision: 'approved',
      customerName: '김대표',
      idempotencyKey: 'flow-test-key-1',
    });
    expect(decisionResult.versionStatus).toBe('approved');
    expect(project.scope_revision).toBe(1);

    // 10. Verify Cumulative Scope has updated
    const scopeChanges = repo.getScopeChanges(project.id);
    expect(scopeChanges).toHaveLength(1);

    const versionDetails = new Map();
    versionDetails.set(version.id, {
      fee_mode: version.fee_mode,
      additional_amount_minor: version.additional_amount_minor,
      schedule_mode: version.schedule_mode,
      proposed_due_date: version.proposed_due_date,
    });

    const updatedCurrentScope = calculateCurrentScope(
      baseline,
      'KRW',
      scopeChanges,
      versionDetails
    );

    expect(updatedCurrentScope.scope_revision).toBe(1);
    expect(updatedCurrentScope.deliverables).toHaveLength(3); // 2 baseline + 1 added
    expect(updatedCurrentScope.deliverables.some(d => d.id === 'del-pricing')).toBe(true);
    expect(updatedCurrentScope.total_amount_minor).toBe(2900000); // 2.5m + 400k
    expect(updatedCurrentScope.current_deadline).toBe('2026-11-15');
  });
});
