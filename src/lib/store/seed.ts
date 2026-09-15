// src/lib/store/seed.ts
import { ScopeRepository } from './repository';

export const DEMO_OWNER_ID = 'demo-user-0001';

export function seedDemoData(repo: ScopeRepository) {
  // Clear any existing data
  repo.projects.clear();
  repo.baselineScopes.clear();
  repo.requests.clear();
  repo.requestItems.clear();
  repo.proposals.clear();
  repo.proposalVersions.clear();
  repo.shareLinks.clear();
  repo.customerDecisions.clear();
  repo.scopeChanges.clear();

  // 1. Create Project 1: 브랜딩 & 반응형 랜딩페이지 제작
  const project1 = repo.createProject({
    owner_id: DEMO_OWNER_ID,
    name: '스타트업 핀테크 반응형 웹사이트 제작',
    customer_name: '주식회사 핀토스 김대표',
    currency: 'KRW',
    tax_treatment: 'inclusive',
    status: 'active',
  });

  // Baseline scope
  const baselineSourceText = `[프로젝트 견적 및 합의문]
1. 작업 범위:
- 반응형 웹페이지 총 5개 페이지 (홈, 서비스소개, 요금안내, 고객지원, 회사소개)
- 기본 PC/모바일 반응형 레이아웃 구현
- 텍스트 및 기본 이미지 교체 등 통상적 디자인 수정 포함

2. 제외 및 별도 협의 사항:
- 목록 외 페이지는 별도 협의 대상입니다.
- 결제 모듈 연동 및 백엔드 API 개발은 제외됩니다.

3. 일정 및 금액:
- 납기: 2026-10-31
- 총 합의 금액: 3,500,000원 (VAT 포함)`;

  const baselineScope = repo.setBaselineScope(project1.id, baselineSourceText, {
    deliverables: [
      { id: 'del-1', title: '홈 페이지 디자인 및 퍼블리싱' },
      { id: 'del-2', title: '서비스 소개 페이지' },
      { id: 'del-3', title: '요금 안내 페이지' },
      { id: 'del-4', title: '고객지원 페이지' },
      { id: 'del-5', title: '회사 소개 페이지' },
    ],
    inclusions: ['PC/모바일 반응형 레이아웃', '통상적 텍스트 및 디자인 수정 포함'],
    exclusions: ['목록 외 페이지는 별도 협의 대상', '결제 모듈 연동'],
    revisions_policy: '최종 시안 후 텍스트 수정 최대 2회',
    initial_deadline: '2026-10-31',
    initial_amount_minor: 3500000,
  });

  // 2. Add Request 1: 가격 비교 페이지 추가 요청
  const req1 = repo.createRequest(project1.id, `안녕하세요 디자이너님!
요금안내 외에 경쟁사와 실시간 요금을 비교할 수 있는 가격 비교 페이지 추가가 급하게 필요합니다.
그리고 기존 홈 화면의 타이틀 문구 텍스트 수정도 부탁드립니다.`);

  const item1 = repo.addRequestItem({
    request_id: req1.id,
    description: '경쟁사와 실시간 요금을 비교할 수 있는 가격 비교 페이지 추가',
    ai_classification: 'additional_candidate',
    classification: 'additional_candidate',
    reason: '합의된 페이지 목록 외 작업은 별도 협의 대상입니다.',
    evidence: [
      {
        sourceId: 'customer-request',
        quote: '가격 비교 페이지 추가',
        start: 46,
        end: 57,
      },
    ],
    user_modified: false,
    reviewed_at: new Date().toISOString(),
  });

  const item2 = repo.addRequestItem({
    request_id: req1.id,
    description: '기존 홈 화면의 타이틀 문구 텍스트 수정',
    ai_classification: 'included',
    classification: 'included',
    reason: '기존 합의된 기본 유지보수 및 경미한 수정 범위에 포함됩니다.',
    evidence: [
      {
        sourceId: 'customer-request',
        quote: '홈 화면의 타이틀 문구 텍스트 수정',
        start: 78,
        end: 98,
      },
    ],
    user_modified: false,
    reviewed_at: new Date().toISOString(),
  });

  // Proposal for Request 1
  const proposal1 = repo.createProposal(project1.id, req1.id);
  const version1 = repo.createProposalVersion({
    proposal_id: proposal1.id,
    project_id: project1.id,
    version_number: 1,
    base_scope_revision: 0,
    changes: [
      {
        type: 'add',
        id: 'del-comp-price',
        title: '경쟁사 가격 비교 전용 페이지 추가 (PC/모바일)',
        description: '실시간 플랜별 상세 스펙 비교 테이블 레이아웃 포함',
        category: 'deliverable',
      },
    ],
    excluded_items: ['실시간 데이터 크롤링 기능은 제외'],
    fee_mode: 'amount',
    additional_amount_minor: 500000,
    schedule_mode: 'date',
    proposed_due_date: '2026-11-07',
    customer_message: '요청해주신 가격 비교 페이지 신규 제작에 대한 범위 및 견적 제안서입니다.',
  });

  return { project1, baselineScope, req1, proposal1, version1 };
}
