// src/lib/domain/proposal-rules.ts
import { ProposalStatus, ProposalVersion, Project } from '@/types/database';

export interface CanShareResult {
  valid: boolean;
  errors: string[];
}

export interface SharePreconditions {
  isBaselineConfirmed: boolean;
  allRequestItemsReviewed: boolean;
  hasChanges: boolean;
  feeMode: string;
  additionalAmountMinor?: number;
  scheduleMode: string;
  proposedDueDate?: string | null;
  projectScopeRevision: number;
  proposalBaseScopeRevision: number;
  hasOtherActivePending: boolean;
}

/**
 * Validates whether a proposal version can be shared with customer.
 */
export function validateShareConditions(conditions: SharePreconditions): CanShareResult {
  const errors: string[] = [];

  if (!conditions.isBaselineConfirmed) {
    errors.push('기준 범위가 아직 확정되지 않았습니다.');
  }

  if (!conditions.allRequestItemsReviewed) {
    errors.push('해당 요청의 모든 항목에 대한 검토가 완료되어야 합니다.');
  }

  if (!conditions.hasChanges) {
    errors.push('제안할 변경 내용이 1개 이상 존재해야 합니다.');
  }

  if (conditions.feeMode === 'undecided') {
    errors.push('금액 조건이 미정 상태입니다. (추가 금액 또는 변동 없음 선택 필요)');
  } else if (conditions.feeMode === 'amount') {
    if (conditions.additionalAmountMinor === undefined || conditions.additionalAmountMinor < 0) {
      errors.push('유효한 추가 금액을 입력해 주세요.');
    }
  }

  if (conditions.scheduleMode === 'undecided') {
    errors.push('납기 조건이 미정 상태입니다. (납기 연장 또는 변동 없음 선택 필요)');
  } else if (conditions.scheduleMode === 'date') {
    if (!conditions.proposedDueDate || !/^\d{4}-\d{2}-\d{2}$/.test(conditions.proposedDueDate)) {
      errors.push('유효한 납기 날짜(YYYY-MM-DD)를 입력해 주세요.');
    }
  }

  if (conditions.projectScopeRevision !== conditions.proposalBaseScopeRevision) {
    errors.push(`프로젝트의 현재 합의 리비전(rev.${conditions.projectScopeRevision})과 제안서 기준 리비전(rev.${conditions.proposalBaseScopeRevision})이 일치하지 않습니다. 최신 상태로 재검토가 필요합니다.`);
  }

  if (conditions.hasOtherActivePending) {
    errors.push('이미 고객에게 발송되어 응답 대기(pending) 중인 다른 제안이 존재합니다. 한 번에 하나의 제안만 공유할 수 있습니다.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates allowed proposal status transition.
 */
export function canTransitionStatus(from: ProposalStatus, to: ProposalStatus): boolean {
  const allowedTransitions: Record<ProposalStatus, ProposalStatus[]> = {
    draft: ['pending'],
    pending: ['approved', 'revision_requested', 'expired', 'withdrawn'],
    approved: [], // Terminal
    revision_requested: [], // Terminal
    expired: [], // Terminal
    withdrawn: [], // Terminal
  };

  return allowedTransitions[from]?.includes(to) || false;
}

/**
 * Checks if a proposal version is considered expired given current timestamp.
 */
export function isProposalExpired(version: ProposalVersion, now: Date = new Date()): boolean {
  if (version.status === 'expired') return true;
  if (version.status === 'pending' && version.expires_at) {
    return new Date(version.expires_at).getTime() < now.getTime();
  }
  return false;
}
