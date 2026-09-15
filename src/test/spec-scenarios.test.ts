// src/test/spec-scenarios.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ScopeRepository, TransactionConflictError } from '@/lib/store/repository';
import { runDeterministicLocalAnalysis } from '@/lib/ai/adapter';
import { validateAndSanitizeAnalysis } from '@/lib/ai/validator';
import { BaselineScope } from '@/types/database';

describe('Specification Core Test Scenarios (A ~ E)', () => {
  let repo: ScopeRepository;
  let baseline: BaselineScope;

  beforeEach(() => {
    repo = new ScopeRepository();
    const proj = repo.createProject({
      owner_id: 'owner-1',
      name: '웹사이트 프로젝트',
      customer_name: '고객사',
      currency: 'KRW',
      tax_treatment: 'inclusive',
      status: 'active',
    });

    baseline = repo.setBaselineScope(
      proj.id,
      `[합의문 원문]
1. 5개 페이지 제작 (홈, 소개, 서비스, 요금, 문의)
2. 목록 외 페이지 별도 협의
3. 디자인 수정 포함 (오탈자 및 문구 수정)`,
      {
        deliverables: [
          { id: 'p-1', title: '홈' },
          { id: 'p-2', title: '소개' },
          { id: 'p-3', title: '서비스' },
          { id: 'p-4', title: '요금' },
          { id: 'p-5', title: '문의' },
        ],
        inclusions: ['5개 페이지 제작', '디자인 수정 포함'],
        exclusions: ['목록 외 페이지 별도 협의'],
        initial_amount_minor: 3000000,
        initial_deadline: '2026-10-31',
      }
    );
  });

  // Test A: 명확한 추가 작업
  it('A. 명확한 추가 작업 (가격 비교 페이지 추가 -> additional_candidate, 원문 근거, 금액/납기 자동생성 없음)', () => {
    const customerMsg = '안녕하세요. 가격 비교 페이지 추가 부탁드립니다.';
    const results = runDeterministicLocalAnalysis(customerMsg, baseline);

    expect(results).toHaveLength(1);
    const item = results[0];
    expect(item.classification).toBe('additional_candidate');
    expect(item.reason).toContain('별도 협의');
    expect(item.evidence).toHaveLength(1);
    expect(item.evidence[0].quote).toBe('가격 비교 페이지 추가');
    // Verify quote slice accuracy
    expect(customerMsg.slice(item.evidence[0].start, item.evidence[0].end)).toBe('가격 비교 페이지 추가');
    // Verify no automatic fee/schedule attached to classification
    expect((item as any).amount).toBeUndefined();
    expect((item as any).proposed_due_date).toBeUndefined();
  });

  // Test B: 판단 기준 부족
  it('B. 판단 기준 부족 ("디자인 수정 포함"만 존재 시 모바일 레이아웃 변경 -> needs_clarification)', () => {
    const customerMsg = '모바일 레이아웃 전체 구조 변경해주세요.';
    const results = runDeterministicLocalAnalysis(customerMsg, baseline);

    expect(results).toHaveLength(1);
    const item = results[0];
    expect(item.classification).toBe('needs_clarification');
    expect(item.reason).toContain('확인이 필요');
  });

  // Test C: 구버전 링크 방어
  it('C. 구버전 링크 (새 버전 생성 및 이전 링크 철회 후 승인 불가, 이전 버전 안내 표시)', async () => {
    const project = repo.listProjects('owner-1')[0];
    const proposal = repo.createProposal(project.id);

    // Version 1
    const v1 = repo.createProposalVersion({
      proposal_id: proposal.id,
      project_id: project.id,
      version_number: 1,
      base_scope_revision: 0,
      changes: [{ type: 'add', id: 'f-1', title: '추가 기능 1' }],
      excluded_items: [],
      fee_mode: 'amount',
      additional_amount_minor: 300000,
      schedule_mode: 'no_change',
    });

    const { rawToken: tokenV1 } = await repo.shareProposal(v1.id, {
      project_name: project.name,
      customer_name: project.customer_name,
      version_number: 1,
      currency: 'KRW',
      changes: v1.changes,
      excluded_items: [],
      fee_mode: 'amount',
      additional_amount_minor: 300000,
      schedule_mode: 'no_change',
      baseline_summary: { deliverables: [] },
    });

    // Supercede / Withdraw v1 to make v2
    await repo.withdrawProposal(v1.id);

    const v2 = repo.createProposalVersion({
      proposal_id: proposal.id,
      project_id: project.id,
      version_number: 2,
      base_scope_revision: 0,
      changes: [{ type: 'add', id: 'f-1-revised', title: '추가 기능 1 (수정)' }],
      excluded_items: [],
      fee_mode: 'amount',
      additional_amount_minor: 350000,
      schedule_mode: 'no_change',
    });

    const { rawToken: tokenV2 } = await repo.shareProposal(v2.id, {
      project_name: project.name,
      customer_name: project.customer_name,
      version_number: 2,
      currency: 'KRW',
      changes: v2.changes,
      excluded_items: [],
      fee_mode: 'amount',
      additional_amount_minor: 350000,
      schedule_mode: 'no_change',
      baseline_summary: { deliverables: [] },
    });

    // Check v1 link access
    const v1Public = repo.getPublicProposalByToken(tokenV1);
    expect(v1Public.valid).toBe(false);
    expect(v1Public.status).toBe('revoked');
    expect(v1Public.errorMessage).toContain('이전 버전입니다');

    // Trying to approve v1 must fail
    await expect(
      repo.processCustomerDecision({
        rawToken: tokenV1,
        decision: 'approved',
        customerName: '김대표',
        idempotencyKey: 'idem-v1-fail',
      })
    ).rejects.toThrow('INVALID_OR_REVOKED_LINK');

    // v2 link should still be valid and approveable
    const v2Public = repo.getPublicProposalByToken(tokenV2);
    expect(v2Public.valid).toBe(true);
  });

  // Test D: 중복 승인 및 멱등성
  it('D. 중복 승인 (동일 멱등키 재시도 시 결정 1개, scope_changes 1개만 생성되고 기존 결과 반환)', async () => {
    const project = repo.listProjects('owner-1')[0];
    const proposal = repo.createProposal(project.id);

    const v = repo.createProposalVersion({
      proposal_id: proposal.id,
      project_id: project.id,
      version_number: 1,
      base_scope_revision: 0,
      changes: [{ type: 'add', id: 'feat-a', title: '신규 컴포넌트' }],
      excluded_items: [],
      fee_mode: 'no_change',
      additional_amount_minor: 0,
      schedule_mode: 'no_change',
    });

    const { rawToken } = await repo.shareProposal(v.id, {
      project_name: project.name,
      customer_name: project.customer_name,
      version_number: 1,
      currency: 'KRW',
      changes: v.changes,
      excluded_items: [],
      fee_mode: 'no_change',
      additional_amount_minor: 0,
      schedule_mode: 'no_change',
      baseline_summary: { deliverables: [] },
    });

    const idempotencyKey = 'unique-req-12345';

    // First decision call
    const res1 = await repo.processCustomerDecision({
      rawToken,
      decision: 'approved',
      customerName: '홍길동',
      idempotencyKey,
    });
    expect(res1.isDuplicate).toBe(false);
    expect(res1.newScopeRevision).toBe(1);

    // Second decision call with identical key & payload (network retry)
    const res2 = await repo.processCustomerDecision({
      rawToken,
      decision: 'approved',
      customerName: '홍길동',
      idempotencyKey,
    });
    expect(res2.isDuplicate).toBe(true);
    expect(res2.decision.id).toBe(res1.decision.id);

    // Total records in database
    const decisions = Array.from(repo.customerDecisions.values()).filter(
      d => d.proposal_version_id === v.id
    );
    expect(decisions).toHaveLength(1);

    const changes = repo.getScopeChanges(project.id);
    expect(changes).toHaveLength(1);
    expect(changes[0].scope_revision).toBe(1);
    expect(project.scope_revision).toBe(1);

    // Third call with SAME idempotency key but DIFFERENT payload must throw Conflict
    await expect(
      repo.processCustomerDecision({
        rawToken,
        decision: 'revision_requested', // altered payload
        customerName: '홍길동',
        comment: '다른 의견',
        idempotencyKey,
      })
    ).rejects.toThrow(TransactionConflictError);
  });

  // Test E: 승인·철회 경쟁
  it('E. 승인·철회 경쟁 (동시 실행 시 하나의 유효 상태 전이만 성공)', async () => {
    const project = repo.listProjects('owner-1')[0];
    const proposal = repo.createProposal(project.id);

    const v = repo.createProposalVersion({
      proposal_id: proposal.id,
      project_id: project.id,
      version_number: 1,
      base_scope_revision: 0,
      changes: [{ type: 'add', id: 'feat-c', title: '경쟁 테스트 항목' }],
      excluded_items: [],
      fee_mode: 'no_change',
      additional_amount_minor: 0,
      schedule_mode: 'no_change',
    });

    const { rawToken } = await repo.shareProposal(v.id, {
      project_name: project.name,
      customer_name: project.customer_name,
      version_number: 1,
      currency: 'KRW',
      changes: v.changes,
      excluded_items: [],
      fee_mode: 'no_change',
      additional_amount_minor: 0,
      schedule_mode: 'no_change',
      baseline_summary: { deliverables: [] },
    });

    // Trigger approve and withdraw simultaneously
    const results = await Promise.allSettled([
      repo.processCustomerDecision({
        rawToken,
        decision: 'approved',
        customerName: '고객',
        idempotencyKey: 'race-key-1',
      }),
      repo.withdrawProposal(v.id),
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    const rejections = results.filter(r => r.status === 'rejected');

    // Exactly one operation must succeed, and one must fail
    expect(successes.length).toBe(1);
    expect(rejections.length).toBe(1);

    // Final state must be either approved or withdrawn, never invalid
    expect(['approved', 'withdrawn']).toContain(v.status);
  });
});
