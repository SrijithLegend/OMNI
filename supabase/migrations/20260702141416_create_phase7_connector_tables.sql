-- Phase 7: Universal Connector Ecosystem (additional tables)
-- OAuth tokens, sync queue, connector cache, and related tables

-- ============== OAUTH TOKENS ==============

CREATE TABLE omni_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id TEXT NOT NULL REFERENCES omni_connectors(id) ON DELETE CASCADE,
  
  -- Token data
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  
  -- Scopes granted
  scopes TEXT[] DEFAULT '{}',
  
  -- Token metadata
  token_metadata JSONB DEFAULT '{}',
  
  -- State
  is_valid BOOLEAN DEFAULT TRUE,
  is_expired BOOLEAN DEFAULT FALSE,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  
  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  refresh_count INTEGER DEFAULT 0,
  last_refresh_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_connector_token UNIQUE (connector_id)
);

-- ============== CONNECTOR ACCOUNTS ==============

CREATE TABLE omni_connector_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id TEXT NOT NULL REFERENCES omni_connectors(id) ON DELETE CASCADE,
  
  -- Account info
  account_id TEXT NOT NULL,
  account_name TEXT,
  account_email TEXT,
  account_avatar TEXT,
  
  -- Workspace context
  workspace_id TEXT,
  workspace_name TEXT,
  
  -- State
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  CONSTRAINT unique_connector_account UNIQUE (connector_id, account_id)
);

-- ============== SYNC QUEUE ==============

CREATE TABLE omni_sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id TEXT NOT NULL REFERENCES omni_connectors(id) ON DELETE CASCADE,
  
  -- Job info
  job_type TEXT NOT NULL,
  job_priority INTEGER DEFAULT 5,
  
  -- Job parameters
  params JSONB DEFAULT '{}',
  
  -- State
  status TEXT DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  
  -- Results
  result JSONB,
  items_synced INTEGER DEFAULT 0,
  items_total INTEGER DEFAULT 0,
  
  -- Error handling
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  CONSTRAINT valid_job_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- ============== CONNECTOR DATA CACHE ==============

CREATE TABLE omni_connector_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id TEXT NOT NULL REFERENCES omni_connectors(id) ON DELETE CASCADE,
  
  -- Item identification
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_parent_id TEXT,
  
  -- Content
  title TEXT,
  description TEXT,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Search
  search_vector tsvector,
  
  -- Cache state
  is_complete BOOLEAN DEFAULT TRUE,
  is_stale BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  CONSTRAINT unique_connector_item UNIQUE (connector_id, item_type, item_id)
);

-- ============== SYNC HISTORY ==============

CREATE TABLE omni_sync_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id TEXT NOT NULL REFERENCES omni_connectors(id) ON DELETE CASCADE,
  
  -- Sync info
  sync_type TEXT NOT NULL,
  triggered_by TEXT DEFAULT 'manual',
  
  -- Stats
  items_added INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_deleted INTEGER DEFAULT 0,
  items_unchanged INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  
  -- Duration
  duration_ms INTEGER,
  
  -- Status
  sync_status TEXT DEFAULT 'completed',
  
  -- Timestamp
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_sync_triggered_by CHECK (triggered_by IN ('manual', 'scheduled', 'auto')),
  CONSTRAINT valid_sync_history_status CHECK (sync_status IN ('completed', 'partial', 'failed'))
);

-- ============== CONNECTOR SEARCH INDEX ==============

CREATE TABLE omni_connector_search_index (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id TEXT NOT NULL REFERENCES omni_connectors(id) ON DELETE CASCADE,
  cache_id UUID REFERENCES omni_connector_cache(id) ON DELETE CASCADE,
  
  -- Searchable content
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  preview TEXT,
  
  -- Context
  project_id UUID REFERENCES omni_projects(id) ON DELETE CASCADE,
  
  -- Search vector
  search_vector tsvector,
  
  -- Scoring
  relevance_score INTEGER DEFAULT 0,
  access_count INTEGER DEFAULT 0,
  
  -- Timestamps
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============== INDEXES ==============

-- OAuth tokens
CREATE INDEX idx_oauth_connector ON omni_oauth_tokens(connector_id);
CREATE INDEX idx_oauth_expires ON omni_oauth_tokens(expires_at);
CREATE INDEX idx_oauth_valid ON omni_oauth_tokens(is_valid, is_expired, is_revoked);

-- Connector accounts
CREATE INDEX idx_accounts_connector ON omni_connector_accounts(connector_id);
CREATE INDEX idx_accounts_active ON omni_connector_accounts(connector_id, is_active);

-- Sync queue
CREATE INDEX idx_sync_queue_connector ON omni_sync_queue(connector_id);
CREATE INDEX idx_sync_queue_status ON omni_sync_queue(status);
CREATE INDEX idx_sync_queue_priority ON omni_sync_queue(job_priority, created_at);
CREATE INDEX idx_sync_queue_retry ON omni_sync_queue(status, next_retry_at) 
  WHERE status = 'failed' AND retry_count < max_retries;

-- Connector cache
CREATE INDEX idx_cache_connector ON omni_connector_cache(connector_id);
CREATE INDEX idx_cache_type ON omni_connector_cache(connector_id, item_type);
CREATE INDEX idx_cache_item ON omni_connector_cache(connector_id, item_id);
CREATE INDEX idx_cache_parent ON omni_connector_cache(connector_id, item_parent_id);
CREATE INDEX idx_cache_search ON omni_connector_cache USING GIN(search_vector);
CREATE INDEX idx_cache_stale ON omni_connector_cache(is_stale) WHERE is_stale = TRUE;

-- Sync history
CREATE INDEX idx_sync_history_connector ON omni_sync_history(connector_id, started_at DESC);
CREATE INDEX idx_sync_history_status ON omni_sync_history(connector_id, sync_status);

-- Connector search
CREATE INDEX idx_connector_search_connector ON omni_connector_search_index(connector_id);
CREATE INDEX idx_connector_search_type ON omni_connector_search_index(connector_id, item_type);
CREATE INDEX idx_connector_search_vector ON omni_connector_search_index USING GIN(search_vector);
CREATE INDEX idx_connector_search_project ON omni_connector_search_index(project_id);

-- ============== ROW LEVEL SECURITY ==============

ALTER TABLE omni_oauth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_oauth_tokens_anon" ON omni_oauth_tokens FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_oauth_tokens_anon" ON omni_oauth_tokens FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_oauth_tokens_anon" ON omni_oauth_tokens FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_oauth_tokens_anon" ON omni_oauth_tokens FOR DELETE TO anon, authenticated USING (true);

ALTER TABLE omni_connector_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_accounts_anon" ON omni_connector_accounts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_accounts_anon" ON omni_connector_accounts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_accounts_anon" ON omni_connector_accounts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_accounts_anon" ON omni_connector_accounts FOR DELETE TO anon, authenticated USING (true);

ALTER TABLE omni_sync_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_sync_queue_anon" ON omni_sync_queue FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_sync_queue_anon" ON omni_sync_queue FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_sync_queue_anon" ON omni_sync_queue FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sync_queue_anon" ON omni_sync_queue FOR DELETE TO anon, authenticated USING (true);

ALTER TABLE omni_connector_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_cache_anon" ON omni_connector_cache FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_cache_anon" ON omni_connector_cache FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_cache_anon" ON omni_connector_cache FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_cache_anon" ON omni_connector_cache FOR DELETE TO anon, authenticated USING (true);

ALTER TABLE omni_sync_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_sync_history_anon" ON omni_sync_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_sync_history_anon" ON omni_sync_history FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "delete_sync_history_anon" ON omni_sync_history FOR DELETE TO anon, authenticated USING (true);

ALTER TABLE omni_connector_search_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_connector_search_anon" ON omni_connector_search_index FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_connector_search_anon" ON omni_connector_search_index FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_connector_search_anon" ON omni_connector_search_index FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_connector_search_anon" ON omni_connector_search_index FOR DELETE TO anon, authenticated USING (true);

-- ============== TRIGGERS ==============

CREATE TRIGGER update_oauth_tokens_updated_at BEFORE UPDATE ON omni_oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_cache_updated_at BEFORE UPDATE ON omni_connector_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_connector_search_updated_at BEFORE UPDATE ON omni_connector_search_index
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Search vector triggers
CREATE OR REPLACE FUNCTION update_connector_cache_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cache_search BEFORE INSERT OR UPDATE ON omni_connector_cache
  FOR EACH ROW EXECUTE FUNCTION update_connector_cache_vector();

CREATE OR REPLACE FUNCTION update_connector_search_vector_fn()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.preview, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_connector_search_vector BEFORE INSERT OR UPDATE ON omni_connector_search_index
  FOR EACH ROW EXECUTE FUNCTION update_connector_search_vector_fn();