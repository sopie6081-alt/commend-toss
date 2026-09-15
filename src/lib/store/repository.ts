// src/lib/store/repository.ts
/**
 * ScopeNote Storage Repository
 * Provides unified interface for Supabase and local in-memory storage (with seed data).
 * Implements strict transaction semantics, locking, idempotency, and revision increments.
 */

import {
  Project,
  BaselineScope,
  RequestRecord,
  RequestItem,
  Proposal,
  ProposalVersion,
  ShareLink,
  CustomerDecision,
  ScopeChangeRecord,
  AnalyticsEvent,
  CustomerSnapshot,
  ScopeAction,
} from '@/types/database';
import { canTransitionStatus, isProposalExpired } from '../domain/proposal-rules';
import { generateSecureShareToken, hashShareToken } from '../crypto/tokens';

export class TransactionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionConflictError';
  }
}

export class ScopeRepository {
  projects: Map<string, Project> = new Map();
  baselineScopes: Map<string, BaselineScope> = new Map();
  requests: Map<string, RequestRecord> = new Map();
  requestItems: Map<string, RequestItem> = new Map();
  proposals: Map<string, Proposal> = new Map();
  proposalVersions: Map<string, ProposalVersion> = new Map();
  shareLinks: Map<string, ShareLink> = new Map();
  customerDecisions: Map<string, CustomerDecision> = new Map();
  scopeChanges: Map<string, ScopeChangeRecord> = new Map();
  analyticsEvents: AnalyticsEvent[] = [];

  // Concurrency mutex simulation
  private locks: Set<string> = new Set();

  private async acquireLock(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await new Promise(r => setTimeout(r, 10));
    }
    this.locks.add(key);
    return () => {
      this.locks.delete(key);
    };
  }

  // --- Project Management ---
  createProject(data: Omit<Project, 'id' | 'scope_revision' | 'created_at' | 'updated_at'>): Project {
    const id = crypto.randomUUID();
    const project: Project = {
      ...data,
      id,
      scope_revision: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.projects.set(id, project);
    this.recordEvent(project.owner_id, 'project_created', project.id);
    return project;
  }

  getProject(id: string): Project | null {
    const p = this.projects.get(id);
    if (!p || p.deleted_at) return null;
    return p;
  }

  listProjects(ownerId: string): Project[] {
    return Array.from(this.projects.values())
      .filter(p => p.owner_id === ownerId && !p.deleted_at)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  deleteProject(id: string, ownerId: string): boolean {
    const p = this.projects.get(id);
    if (!p || p.owner_id !== ownerId || p.deleted_at) return false;
    p.deleted_at = new Date().toISOString();
    p.updated_at = new Date().toISOString();

    // Revoke any active share links immediately
    for (const link of this.shareLinks.values()) {
      const version = this.proposalVersions.get(link.proposal_version_id);
      if (version && version.project_id === id) {
        link.revoked_at = new Date().toISOString();
      }
    }
    return true;
  }

  // --- Baseline Scopes ---
  setBaselineScope(projectId: string, sourceText: string, structuredScope: any): BaselineScope {
    const id = crypto.randomUUID();
    const baseline: BaselineScope = {
      id,
      project_id: projectId,
      source_text: sourceText,
      structured_scope: structuredScope,
      confirmed_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    this.baselineScopes.set(projectId, baseline);
    const p = this.projects.get(projectId);
    if (p) {
      this.recordEvent(p.owner_id, 'scope_confirmed', projectId);
    }
    return baseline;
  }

  getBaselineScope(projectId: string): BaselineScope | null {
    return this.baselineScopes.get(projectId) || null;
  }

  // --- Requests & Items ---
  createRequest(projectId: string, sourceText: string): RequestRecord {
    const id = crypto.randomUUID();
    const req: RequestRecord = {
      id,
      project_id: projectId,
      source_text: sourceText,
      analysis_status: 'completed',
      created_at: new Date().toISOString(),
    };
    this.requests.set(id, req);
    const p = this.projects.get(projectId);
    if (p) {
      this.recordEvent(p.owner_id, 'request_analyzed', req.id);
    }
    return req;
  }

  addRequestItem(data: Omit<RequestItem, 'id' | 'created_at'>): RequestItem {
    const id = crypto.randomUUID();
    const item: RequestItem = {
      ...data,
      id,
      created_at: new Date().toISOString(),
    };
    this.requestItems.set(id, item);
    return item;
  }

  listRequestItems(requestId: string): RequestItem[] {
    return Array.from(this.requestItems.values()).filter(i => i.request_id === requestId);
  }

  updateRequestItemClassification(
    itemId: string,
    classification: RequestItem['classification'],
    reason?: string
  ): RequestItem | null {
    const item = this.requestItems.get(itemId);
    if (!item) return null;
    item.classification = classification;
    if (reason) item.reason = reason;
    item.user_modified = true;
    item.reviewed_at = new Date().toISOString();
    return item;
  }

  // --- Proposals & Versions ---
  createProposal(projectId: string, requestId?: string | null): Proposal {
    const id = crypto.randomUUID();
    const prop: Proposal = {
      id,
      project_id: projectId,
      request_id: requestId,
      created_at: new Date().toISOString(),
    };
    this.proposals.set(id, prop);
    return prop;
  }

  createProposalVersion(data: Omit<ProposalVersion, 'id' | 'created_at' | 'status'> & { status?: ProposalVersion['status'] }): ProposalVersion {
    const id = crypto.randomUUID();
    const version: ProposalVersion = {
      ...data,
      id,
      status: data.status || 'draft',
      created_at: new Date().toISOString(),
    };
    this.proposalVersions.set(id, version);
    return version;
  }

  getProposalVersion(versionId: string): ProposalVersion | null {
    return this.proposalVersions.get(versionId) || null;
  }

  listProposalVersions(proposalId: string): ProposalVersion[] {
    return Array.from(this.proposalVersions.values())
      .filter(v => v.proposal_id === proposalId)
      .sort((a, b) => b.version_number - a.version_number);
  }

  // --- Transactional Share Proposal ---
  async shareProposal(
    proposalVersionId: string,
    customerSnapshot: CustomerSnapshot,
    expiresInDays = 14
  ): Promise<{ shareLink: ShareLink; rawToken: string }> {
    const version = this.proposalVersions.get(proposalVersionId);
    if (!version) throw new Error('Proposal version not found');

    const releaseLock = await this.acquireLock(`project-${version.project_id}`);
    try {
      const project = this.projects.get(version.project_id);
      if (!project || project.deleted_at) {
        throw new Error('Project not found or deleted');
      }

      // Check scope_revision match
      if (project.scope_revision !== version.base_scope_revision) {
        throw new Error('Project scope revision has changed. Please review changes again.');
      }

      // Check if there is another pending version
      for (const v of this.proposalVersions.values()) {
        if (v.project_id === version.project_id && v.id !== version.id && v.status === 'pending') {
          // Check if expired by time
          if (isProposalExpired(v)) {
            v.status = 'expired';
          } else {
            throw new Error('Another pending proposal is already active for this project');
          }
        }
      }

      if (!canTransitionStatus(version.status, 'pending')) {
        throw new Error(`Cannot transition proposal status from ${version.status} to pending`);
      }

      // Fix snapshot and transition
      version.status = 'pending';
      version.customer_snapshot = customerSnapshot;
      version.shared_at = new Date().toISOString();

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      version.expires_at = expiresAt.toISOString();

      const { rawToken, tokenHash } = generateSecureShareToken();
      const linkId = crypto.randomUUID();
      const shareLink: ShareLink = {
        id: linkId,
        proposal_version_id: version.id,
        token_hash: tokenHash,
        expires_at: version.expires_at,
        created_at: new Date().toISOString(),
      };
      this.shareLinks.set(tokenHash, shareLink);

      this.recordEvent(project.owner_id, 'proposal_shared', version.id, version.status);
      return { shareLink, rawToken };
    } finally {
      releaseLock();
    }
  }

  // --- Withdraw Proposal ---
  async withdrawProposal(proposalVersionId: string): Promise<ProposalVersion> {
    const version = this.proposalVersions.get(proposalVersionId);
    if (!version) throw new Error('Version not found');

    const releaseLock = await this.acquireLock(`project-${version.project_id}`);
    try {
      if (version.status !== 'pending') {
        throw new Error(`Cannot withdraw version in status: ${version.status}`);
      }

      version.status = 'withdrawn';
      // Revoke share links
      for (const link of this.shareLinks.values()) {
        if (link.proposal_version_id === version.id) {
          link.revoked_at = new Date().toISOString();
        }
      }
      return version;
    } finally {
      releaseLock();
    }
  }

  // --- Customer Decision (Atomic Transaction) ---
  async processCustomerDecision(params: {
    rawToken: string;
    decision: 'approved' | 'revision_requested';
    customerName: string;
    comment?: string;
    idempotencyKey: string;
  }): Promise<{
    decision: CustomerDecision;
    versionStatus: ProposalVersion['status'];
    newScopeRevision?: number;
    isDuplicate: boolean;
  }> {
    const tokenHash = hashShareToken(params.rawToken);
    const link = this.shareLinks.get(tokenHash);

    if (!link) {
      throw new Error('INVALID_OR_REVOKED_LINK');
    }

    const version = this.proposalVersions.get(link.proposal_version_id);
    if (!version) {
      throw new Error('PROPOSAL_NOT_FOUND');
    }

    const releaseLock = await this.acquireLock(`project-${version.project_id}`);
    try {
      const project = this.projects.get(version.project_id);
      if (!project || project.deleted_at) {
        throw new Error('PROJECT_DELETED');
      }

      // Check Idempotency first (so retries after decision completion return the cached result)
      const existingByVersion = this.customerDecisions.get(version.id);
      if (existingByVersion) {
        if (existingByVersion.idempotency_key === params.idempotencyKey) {
          if (
            existingByVersion.decision === params.decision &&
            existingByVersion.customer_name === params.customerName
          ) {
            return {
              decision: existingByVersion,
              versionStatus: version.status,
              newScopeRevision: project.scope_revision,
              isDuplicate: true,
            };
          } else {
            throw new TransactionConflictError('Idempotency key payload mismatch');
          }
        }
        throw new Error('PROPOSAL_ALREADY_DECIDED');
      }

      if (link.revoked_at) {
        throw new Error('INVALID_OR_REVOKED_LINK');
      }

      // Check expiration by time
      if (isProposalExpired(version)) {
        version.status = 'expired';
        throw new Error('PROPOSAL_EXPIRED');
      }

      // Check current state is pending
      if (version.status !== 'pending') {
        throw new Error(`INVALID_STATE_FOR_DECISION:${version.status}`);
      }

      if (params.decision === 'revision_requested') {
        if (!params.comment || params.comment.trim() === '') {
          throw new Error('COMMENT_REQUIRED_FOR_REVISION_REQUEST');
        }
      }

      // 1. Record Decision
      const decisionRecord: CustomerDecision = {
        id: crypto.randomUUID(),
        proposal_version_id: version.id,
        decision: params.decision,
        customer_name: params.customerName.trim(),
        comment: params.comment ? params.comment.trim() : null,
        idempotency_key: params.idempotencyKey,
        decided_at: new Date().toISOString(),
      };
      this.customerDecisions.set(version.id, decisionRecord);

      // 2. State Transition
      if (params.decision === 'approved') {
        version.status = 'approved';

        // 3. Increment scope_revision and create scope_change
        project.scope_revision += 1;
        project.updated_at = new Date().toISOString();

        const scopeChangeId = crypto.randomUUID();
        const scopeChange: ScopeChangeRecord = {
          id: scopeChangeId,
          project_id: project.id,
          proposal_version_id: version.id,
          applied_changes: version.changes,
          scope_revision: project.scope_revision,
          created_at: new Date().toISOString(),
        };
        this.scopeChanges.set(version.id, scopeChange);

        this.recordEvent(project.owner_id, 'proposal_approved', version.id, version.status);
      } else {
        version.status = 'revision_requested';
        this.recordEvent(project.owner_id, 'proposal_revision_requested', version.id, version.status);
      }

      // Invalidate share link after terminal decision
      link.revoked_at = new Date().toISOString();

      return {
        decision: decisionRecord,
        versionStatus: version.status,
        newScopeRevision: project.scope_revision,
        isDuplicate: false,
      };
    } finally {
      releaseLock();
    }
  }

  // --- Customer View DTO (Sanitized, no internal tokens, safe for anonymous viewing) ---
  getPublicProposalByToken(rawToken: string): {
    valid: boolean;
    status: ProposalVersion['status'] | 'not_found' | 'revoked' | 'superseded';
    snapshot?: CustomerSnapshot;
    versionNumber?: number;
    errorMessage?: string;
  } {
    const tokenHash = hashShareToken(rawToken);
    const link = this.shareLinks.get(tokenHash);

    if (!link) {
      return { valid: false, status: 'not_found', errorMessage: '유효하지 않은 링크입니다.' };
    }

    if (link.revoked_at) {
      return {
        valid: false,
        status: 'revoked',
        errorMessage: '이전 버전입니다. 발신자에게 최신 제안을 확인해 주세요.',
      };
    }

    const version = this.proposalVersions.get(link.proposal_version_id);
    if (!version) {
      return { valid: false, status: 'not_found', errorMessage: '제안서를 찾을 수 없습니다.' };
    }

    const project = this.projects.get(version.project_id);
    if (!project || project.deleted_at) {
      return { valid: false, status: 'not_found', errorMessage: '삭제된 프로젝트입니다.' };
    }

    if (isProposalExpired(version)) {
      return {
        valid: false,
        status: 'expired',
        errorMessage: '제안서의 유효 기간이 만료되었습니다. 담당 디자이너에게 재발급을 요청해 주세요.',
      };
    }

    if (!version.customer_snapshot) {
      return { valid: false, status: 'not_found', errorMessage: '고객용 제안 스냅샷이 생성되지 않았습니다.' };
    }

    return {
      valid: true,
      status: version.status,
      snapshot: version.customer_snapshot,
      versionNumber: version.version_number,
    };
  }

  // --- Analytics Event Recording ---
  recordEvent(
    ownerId: string,
    eventName: AnalyticsEvent['event_name'],
    entityId?: string,
    state?: string
  ): void {
    // Only internal identifiers, no tokens, customer names, or raw text
    this.analyticsEvents.push({
      id: crypto.randomUUID(),
      owner_id: ownerId,
      event_name: eventName,
      entity_id: entityId,
      state: state,
      created_at: new Date().toISOString(),
    });
  }

  getScopeChanges(projectId: string): ScopeChangeRecord[] {
    return Array.from(this.scopeChanges.values())
      .filter(sc => sc.project_id === projectId)
      .sort((a, b) => a.scope_revision - b.scope_revision);
  }
}

// Global shared singleton for dev/testing/runtime
export const globalRepo = new ScopeRepository();
