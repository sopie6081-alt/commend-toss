// src/types/database.ts
// Domain Types & DB Schema Entities

export type Currency = 'KRW' | 'USD' | 'EUR' | 'JPY';
export type TaxTreatment = 'inclusive' | 'exclusive' | 'unspecified';
export type ProjectStatus = 'active' | 'completed' | 'archived';

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  customer_name: string;
  currency: Currency;
  tax_treatment: TaxTreatment;
  status: ProjectStatus;
  scope_revision: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface StructuredScopeItem {
  id: string;
  title: string;
  description?: string;
  quantity?: number;
}

export interface StructuredScope {
  deliverables: StructuredScopeItem[];
  inclusions: string[];
  exclusions: string[];
  revisions_policy?: string;
  schedule_summary?: string;
  initial_deadline?: string | null;
  initial_amount_minor?: number | null; // integer minimal currency unit
}

export interface BaselineScope {
  id: string;
  project_id: string;
  source_text: string;
  structured_scope: StructuredScope;
  confirmed_at?: string | null;
  created_at: string;
}

export type RequestClassification = 'included' | 'additional_candidate' | 'needs_clarification';

export interface EvidenceSlice {
  sourceId: string;
  quote: string;
  start: number; // UTF-16 code unit index
  end: number;
}

export interface RequestItem {
  id: string;
  request_id: string;
  description: string;
  ai_classification: RequestClassification;
  classification: RequestClassification;
  reason: string;
  evidence: EvidenceSlice[];
  reviewed_at?: string | null;
  user_modified: boolean;
  created_at: string;
}

export interface RequestRecord {
  id: string;
  project_id: string;
  source_text: string;
  analysis_status: 'pending' | 'completed' | 'failed';
  created_at: string;
  items?: RequestItem[];
}

export type ProposalStatus = 'draft' | 'pending' | 'approved' | 'revision_requested' | 'expired' | 'withdrawn';
export type FeeMode = 'amount' | 'no_change' | 'undecided';
export type ScheduleMode = 'date' | 'no_change' | 'undecided';

export interface ScopeActionAdd {
  type: 'add';
  id: string;
  title: string;
  description?: string;
  category?: 'deliverable' | 'inclusion' | 'exclusion' | 'condition';
}

export interface ScopeActionUpdate {
  type: 'update';
  target_id: string;
  before: string;
  after: string;
  field?: string;
}

export interface ScopeActionRemove {
  type: 'remove';
  target_id: string;
  before: string;
  reason?: string;
}

export type ScopeAction = ScopeActionAdd | ScopeActionUpdate | ScopeActionRemove;

export interface CustomerSnapshot {
  project_name: string;
  customer_name: string;
  version_number: number;
  currency: Currency;
  changes: ScopeAction[];
  excluded_items: string[];
  fee_mode: FeeMode;
  additional_amount_minor: number;
  schedule_mode: ScheduleMode;
  proposed_due_date?: string | null;
  customer_message?: string | null;
  baseline_summary: {
    deliverables: { id: string; title: string }[];
    initial_deadline?: string | null;
  };
}

export interface ProposalVersion {
  id: string;
  proposal_id: string;
  project_id: string;
  version_number: number;
  base_scope_revision: number;
  status: ProposalStatus;
  changes: ScopeAction[];
  excluded_items: string[];
  fee_mode: FeeMode;
  additional_amount_minor: number;
  schedule_mode: ScheduleMode;
  proposed_due_date?: string | null;
  customer_message?: string | null;
  customer_snapshot?: CustomerSnapshot | null;
  expires_at?: string | null;
  shared_at?: string | null;
  superseded_at?: string | null;
  created_at: string;
}

export interface Proposal {
  id: string;
  project_id: string;
  request_id?: string | null;
  created_at: string;
  versions?: ProposalVersion[];
}

export interface ShareLink {
  id: string;
  proposal_version_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at?: string | null;
  created_at: string;
}

export interface CustomerDecision {
  id: string;
  proposal_version_id: string;
  decision: 'approved' | 'revision_requested';
  customer_name: string;
  comment?: string | null;
  idempotency_key: string;
  decided_at: string;
}

export interface ScopeChangeRecord {
  id: string;
  project_id: string;
  proposal_version_id: string;
  applied_changes: ScopeAction[];
  scope_revision: number;
  created_at: string;
}

export type AnalyticsEventType =
  | 'project_created'
  | 'scope_confirmed'
  | 'request_analyzed'
  | 'classification_edited'
  | 'proposal_shared'
  | 'proposal_viewed'
  | 'proposal_approved'
  | 'proposal_revision_requested';

export interface AnalyticsEvent {
  id: string;
  owner_id: string;
  project_id?: string | null;
  event_name: AnalyticsEventType;
  entity_id?: string | null;
  state?: string | null;
  created_at: string;
}
