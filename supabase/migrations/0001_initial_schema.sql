-- ScopeNote PostgreSQL Schema Migration
-- 0001_initial_schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'KRW',
  tax_treatment VARCHAR(20) NOT NULL DEFAULT 'inclusive' CHECK (tax_treatment IN ('inclusive', 'exclusive', 'unspecified')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  scope_revision INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id) WHERE deleted_at IS NULL;

-- 2. baseline_scopes
CREATE TABLE IF NOT EXISTS baseline_scopes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_text TEXT NOT NULL,
  structured_scope JSONB NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baseline_scopes_project_id ON baseline_scopes(project_id);

-- 3. requests
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_text TEXT NOT NULL,
  analysis_status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (analysis_status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_project_id ON requests(project_id);

-- 4. request_items
CREATE TABLE IF NOT EXISTS request_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  ai_classification VARCHAR(30) NOT NULL CHECK (ai_classification IN ('included', 'additional_candidate', 'needs_clarification')),
  classification VARCHAR(30) NOT NULL CHECK (classification IN ('included', 'additional_candidate', 'needs_clarification')),
  reason TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewed_at TIMESTAMPTZ,
  user_modified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_request_items_request_id ON request_items(request_id);

-- 5. proposals
CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_project_id ON proposals(project_id);

-- 6. proposal_versions
CREATE TABLE IF NOT EXISTS proposal_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  base_scope_revision INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'revision_requested', 'expired', 'withdrawn')),
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  excluded_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  fee_mode VARCHAR(20) NOT NULL DEFAULT 'no_change' CHECK (fee_mode IN ('amount', 'no_change', 'undecided')),
  additional_amount_minor BIGINT NOT NULL DEFAULT 0,
  schedule_mode VARCHAR(20) NOT NULL DEFAULT 'no_change' CHECK (schedule_mode IN ('date', 'no_change', 'undecided')),
  proposed_due_date DATE,
  customer_message TEXT,
  customer_snapshot JSONB,
  expires_at TIMESTAMPTZ,
  shared_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_versions_proposal_id ON proposal_versions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_versions_project_id ON proposal_versions(project_id);

-- Partial Unique Index: 프로젝트당 pending 버전은 최대 1개
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_proposal_per_project 
ON proposal_versions (project_id) 
WHERE (status = 'pending');

-- 7. share_links
CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_version_id UUID NOT NULL REFERENCES proposal_versions(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_token_hash ON share_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_share_links_version_id ON share_links(proposal_version_id);

-- 8. customer_decisions
CREATE TABLE IF NOT EXISTS customer_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_version_id UUID NOT NULL UNIQUE REFERENCES proposal_versions(id) ON DELETE CASCADE,
  decision VARCHAR(30) NOT NULL CHECK (decision IN ('approved', 'revision_requested')),
  customer_name VARCHAR(255) NOT NULL,
  comment TEXT,
  idempotency_key VARCHAR(128) NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_decisions_proposal_version_id ON customer_decisions(proposal_version_id);
CREATE INDEX IF NOT EXISTS idx_customer_decisions_idempotency_key ON customer_decisions(idempotency_key);

-- 9. scope_changes
CREATE TABLE IF NOT EXISTS scope_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  proposal_version_id UUID NOT NULL UNIQUE REFERENCES proposal_versions(id) ON DELETE CASCADE,
  applied_changes JSONB NOT NULL,
  scope_revision INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scope_changes_project_id ON scope_changes(project_id);

-- 10. analytics_events
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  event_name VARCHAR(100) NOT NULL,
  entity_id UUID,
  state VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_project ON analytics_events(project_id);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE baseline_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scope_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Owner based policies
CREATE POLICY "Projects owner policy" ON projects
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Baseline scopes policy" ON baseline_scopes
  FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = baseline_scopes.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Requests policy" ON requests
  FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = requests.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Request items policy" ON request_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM requests 
    JOIN projects ON projects.id = requests.project_id 
    WHERE requests.id = request_items.request_id AND projects.owner_id = auth.uid()
  ));

CREATE POLICY "Proposals policy" ON proposals
  FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = proposals.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Proposal versions policy" ON proposal_versions
  FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = proposal_versions.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Share links policy" ON share_links
  FOR ALL USING (EXISTS (
    SELECT 1 FROM proposal_versions 
    JOIN projects ON projects.id = proposal_versions.project_id 
    WHERE proposal_versions.id = share_links.proposal_version_id AND projects.owner_id = auth.uid()
  ));

CREATE POLICY "Customer decisions policy" ON customer_decisions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM proposal_versions 
    JOIN projects ON projects.id = proposal_versions.project_id 
    WHERE proposal_versions.id = customer_decisions.proposal_version_id AND projects.owner_id = auth.uid()
  ));

CREATE POLICY "Scope changes policy" ON scope_changes
  FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = scope_changes.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Analytics events policy" ON analytics_events
  FOR ALL USING (auth.uid() = owner_id);
