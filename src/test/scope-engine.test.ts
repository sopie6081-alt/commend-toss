// src/test/scope-engine.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { calculateCurrentScope } from '@/lib/domain/scope-engine';
import { BaselineScope, ScopeChangeRecord } from '@/types/database';

describe('ScopeEngine - Cumulative Scope Calculation', () => {
  let baseline: BaselineScope;

  beforeEach(() => {
    baseline = {
      id: 'base-1',
      project_id: 'proj-1',
      source_text: '합의서 원문',
      structured_scope: {
        deliverables: [
          { id: 'del-1', title: '홈 페이지' },
          { id: 'del-2', title: '소개 페이지' },
        ],
        inclusions: ['PC/모바일 반응형'],
        exclusions: ['결제 모듈'],
        initial_deadline: '2026-10-31',
        initial_amount_minor: 2000000,
      },
      confirmed_at: '2026-09-01T00:00:00Z',
      created_at: '2026-09-01T00:00:00Z',
    };
  });

  it('calculates initial baseline when no changes are approved', () => {
    const res = calculateCurrentScope(baseline, 'KRW', []);
    expect(res.scope_revision).toBe(0);
    expect(res.deliverables).toHaveLength(2);
    expect(res.total_amount_minor).toBe(2000000);
    expect(res.current_deadline).toBe('2026-10-31');
  });

  it('correctly applies add, update, remove actions and accumulates amount & deadline', () => {
    const changes: ScopeChangeRecord[] = [
      {
        id: 'change-1',
        project_id: 'proj-1',
        proposal_version_id: 'ver-1',
        scope_revision: 1,
        applied_changes: [
          {
            type: 'add',
            id: 'del-3',
            title: '가격 비교 페이지',
            category: 'deliverable',
          },
        ],
        created_at: '2026-09-10T00:00:00Z',
      },
      {
        id: 'change-2',
        project_id: 'proj-1',
        proposal_version_id: 'ver-2',
        scope_revision: 2,
        applied_changes: [
          {
            type: 'update',
            target_id: 'del-1',
            before: '홈 페이지',
            after: '홈 페이지 (다크모드 지원)',
          },
          {
            type: 'remove',
            target_id: 'del-2',
            before: '소개 페이지',
            reason: '고객 요청으로 미진행',
          },
        ],
        created_at: '2026-09-15T00:00:00Z',
      },
    ];

    const versionDetails = new Map();
    versionDetails.set('ver-1', {
      fee_mode: 'amount',
      additional_amount_minor: 500000,
      schedule_mode: 'date',
      proposed_due_date: '2026-11-15',
    });
    versionDetails.set('ver-2', {
      fee_mode: 'no_change',
      additional_amount_minor: 0,
      schedule_mode: 'no_change',
    });

    const res = calculateCurrentScope(baseline, 'KRW', changes, versionDetails);

    expect(res.scope_revision).toBe(2);
    expect(res.deliverables).toHaveLength(2); // del-1 (updated), del-3 (added), del-2 (removed)
    expect(res.deliverables.find(d => d.id === 'del-1')?.title).toBe('홈 페이지 (다크모드 지원)');
    expect(res.deliverables.find(d => d.id === 'del-3')?.title).toBe('가격 비교 페이지');
    expect(res.deliverables.find(d => d.id === 'del-2')).toBeUndefined();

    // Amount: 2,000,000 + 500,000 = 2,500,000
    expect(res.total_amount_minor).toBe(2500000);
    // Deadline: updated by ver-1 to 2026-11-15, preserved by ver-2
    expect(res.current_deadline).toBe('2026-11-15');
  });
});
