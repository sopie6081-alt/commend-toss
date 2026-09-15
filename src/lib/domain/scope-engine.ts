// src/lib/domain/scope-engine.ts
import {
  BaselineScope,
  Currency,
  ScopeAction,
  ScopeChangeRecord,
  StructuredScopeItem,
} from '@/types/database';

export interface CalculatedCurrentScope {
  scope_revision: number;
  currency: Currency;
  deliverables: StructuredScopeItem[];
  inclusions: string[];
  exclusions: string[];
  total_amount_minor: number;
  current_deadline: string | null;
  history: {
    proposal_version_id: string;
    scope_revision: number;
    applied_changes: ScopeAction[];
    applied_at: string;
  }[];
}

/**
 * Calculates current active scope by starting from baseline scope
 * and iteratively applying approved scope changes in revision order.
 */
export function calculateCurrentScope(
  baseline: BaselineScope,
  currency: Currency,
  approvedChanges: ScopeChangeRecord[],
  proposalVersionDetails?: Map<string, {
    fee_mode: string;
    additional_amount_minor: number;
    schedule_mode: string;
    proposed_due_date?: string | null;
  }>
): CalculatedCurrentScope {
  // 1. Initial State from Baseline
  const deliverables: StructuredScopeItem[] = baseline.structured_scope.deliverables
    ? baseline.structured_scope.deliverables.map(d => ({ ...d }))
    : [];

  const inclusions: string[] = [...(baseline.structured_scope.inclusions || [])];
  const exclusions: string[] = [...(baseline.structured_scope.exclusions || [])];

  let total_amount_minor = baseline.structured_scope.initial_amount_minor || 0;
  let current_deadline = baseline.structured_scope.initial_deadline || null;

  // 2. Sort changes by scope_revision ascending
  const sortedChanges = [...approvedChanges].sort((a, b) => a.scope_revision - b.scope_revision);

  const history: CalculatedCurrentScope['history'] = [];

  for (const change of sortedChanges) {
    for (const action of change.applied_changes) {
      if (action.type === 'add') {
        const category = action.category || 'deliverable';
        if (category === 'deliverable') {
          // Avoid duplicate ID
          if (!deliverables.some(d => d.id === action.id)) {
            deliverables.push({
              id: action.id,
              title: action.title,
              description: action.description,
            });
          }
        } else if (category === 'inclusion') {
          inclusions.push(action.title);
        } else if (category === 'exclusion') {
          exclusions.push(action.title);
        }
      } else if (action.type === 'update') {
        const idx = deliverables.findIndex(d => d.id === action.target_id);
        if (idx !== -1) {
          deliverables[idx] = {
            ...deliverables[idx],
            title: action.after,
          };
        }
      } else if (action.type === 'remove') {
        const idx = deliverables.findIndex(d => d.id === action.target_id);
        if (idx !== -1) {
          deliverables.splice(idx, 1);
        }
      }
    }

    // Apply fee & schedule from version details if present
    if (proposalVersionDetails && proposalVersionDetails.has(change.proposal_version_id)) {
      const v = proposalVersionDetails.get(change.proposal_version_id)!;
      if (v.fee_mode === 'amount') {
        total_amount_minor += (v.additional_amount_minor || 0);
      }
      if (v.schedule_mode === 'date' && v.proposed_due_date) {
        current_deadline = v.proposed_due_date;
      }
    }

    history.push({
      proposal_version_id: change.proposal_version_id,
      scope_revision: change.scope_revision,
      applied_changes: change.applied_changes,
      applied_at: change.created_at,
    });
  }

  const latestRevision = sortedChanges.length > 0
    ? sortedChanges[sortedChanges.length - 1].scope_revision
    : 0;

  return {
    scope_revision: latestRevision,
    currency,
    deliverables,
    inclusions,
    exclusions,
    total_amount_minor,
    current_deadline,
    history,
  };
}
