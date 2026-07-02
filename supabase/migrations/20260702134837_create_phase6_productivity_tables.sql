-- Phase 6: Global Search, Timeline, Export & Productivity Engine
-- New tables for search index, analytics, saved searches, and command history

-- ============== SEARCH INDEX ==============

CREATE TABLE omni_search_index (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Polymorphic reference to indexed item
  item_type TEXT NOT NULL, -- project, conversation, message, file, note, task, snippet, clipboard, timeline, pinned
  item_id UUID NOT NULL,
  project_id UUID REFERENCES omni_projects(id) ON DELETE CASCADE,
  
  -- Searchable content
  title TEXT NOT NULL,
  content TEXT, -- Full text content for search
  preview TEXT, -- Short preview for results display
  
  -- Metadata for filtering
  metadata JSONB DEFAULT '{}', -- Flexible: tags, status, priority, language, etc.
  
  -- Search vectors
  search_vector tsvector, -- Full-text search vector
  
  -- Scoring
  score_boost INTEGER DEFAULT 0, -- Manual boost for important items
  access_count INTEGER DEFAULT 0, -- Track usage for relevance
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_search_item_type CHECK (item_type IN ('project', 'conversation', 'message', 'file', 'note', 'task', 'snippet', 'clipboard', 'timeline', 'pinned'))
);

-- ============== ANALYTICS EVENTS ==============

CREATE TABLE omni_analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Event classification
  event_type TEXT NOT NULL, -- project_create, project_open, conversation_create, ai_switch, task_complete, search, export, etc.
  event_category TEXT NOT NULL, -- project, conversation, ai, task, search, export, system
  
  -- Context
  project_id UUID REFERENCES omni_projects(id) ON DELETE CASCADE,
  
  -- Event data
  data JSONB DEFAULT '{}', -- Flexible: duration_ms, item_count, ai_model, format, query_length, etc.
  
  -- Session info (local only, not sent externally)
  session_id UUID, -- Group events by session
  
  -- Timestamp (hour/day granularity for aggregation)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  hour_bucket TIMESTAMPTZ DEFAULT date_trunc('hour', NOW()),
  day_bucket DATE DEFAULT CURRENT_DATE,
  
  CONSTRAINT valid_analytics_category CHECK (event_category IN ('project', 'conversation', 'ai', 'task', 'search', 'export', 'import', 'system', 'workspace'))
);

-- ============== SAVED SEARCHES ==============

CREATE TABLE omni_saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Search details
  name TEXT NOT NULL,
  query TEXT NOT NULL, -- The search query
  
  -- Filters
  filters JSONB DEFAULT '{}', -- types, projectId, dateRange, tags, etc.
  
  -- Sort preferences
  sort_by TEXT DEFAULT 'relevance', -- relevance, date, name
  sort_order TEXT DEFAULT 'desc', -- asc, desc
  
  -- Options
  options JSONB DEFAULT '{}', -- fuzzy, prefix, highlight, etc.
  
  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- State
  is_pinned BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_sort_by CHECK (sort_by IN ('relevance', 'date', 'name')),
  CONSTRAINT valid_sort_order CHECK (sort_order IN ('asc', 'desc'))
);

-- ============== COMMAND HISTORY ==============

CREATE TABLE omni_command_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Command info
  command_id TEXT NOT NULL, -- The command identifier
  command_category TEXT NOT NULL, -- navigation, creation, action, search, export, settings
  
  -- Context
  project_id UUID REFERENCES omni_projects(id) ON DELETE CASCADE,
  
  -- Arguments
  args JSONB DEFAULT '{}',
  
  -- Usage tracking
  execution_count INTEGER DEFAULT 1,
  last_executed_at TIMESTAMPTZ DEFAULT NOW(),
  first_executed_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_command_category CHECK (command_category IN ('navigation', 'creation', 'action', 'search', 'export', 'import', 'settings', 'view'))
);

-- ============== INDEXES ==============

-- Search Index
CREATE INDEX idx_search_item ON omni_search_index(item_type, item_id);
CREATE INDEX idx_search_project ON omni_search_index(project_id);
CREATE INDEX idx_search_vector ON omni_search_index USING GIN(search_vector);
CREATE INDEX idx_search_type ON omni_search_index(item_type);
CREATE INDEX idx_search_updated ON omni_search_index(updated_at DESC);
CREATE INDEX idx_search_access ON omni_search_index(access_count DESC);

-- Analytics Events
CREATE INDEX idx_analytics_type ON omni_analytics_events(event_type);
CREATE INDEX idx_analytics_category ON omni_analytics_events(event_category);
CREATE INDEX idx_analytics_project ON omni_analytics_events(project_id);
CREATE INDEX idx_analytics_hour ON omni_analytics_events(hour_bucket);
CREATE INDEX idx_analytics_day ON omni_analytics_events(day_bucket);
CREATE INDEX idx_analytics_session ON omni_analytics_events(session_id);

-- Saved Searches
CREATE INDEX idx_saved_searches_created ON omni_saved_searches(created_at DESC);
CREATE INDEX idx_saved_searches_pinned ON omni_saved_searches(is_pinned) WHERE is_pinned = TRUE;

-- Command History
CREATE INDEX idx_command_history_command ON omni_command_history(command_id);
CREATE INDEX idx_command_history_recent ON omni_command_history(last_executed_at DESC);
CREATE INDEX idx_command_history_count ON omni_command_history(execution_count DESC);

-- ============== ROW LEVEL SECURITY ==============

-- Search Index
ALTER TABLE omni_search_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_search_index_anon" ON omni_search_index FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_search_index_anon" ON omni_search_index FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_search_index_anon" ON omni_search_index FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_search_index_anon" ON omni_search_index FOR DELETE
  TO anon, authenticated USING (true);

-- Analytics Events
ALTER TABLE omni_analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_analytics_events_anon" ON omni_analytics_events FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_analytics_events_anon" ON omni_analytics_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "delete_analytics_events_anon" ON omni_analytics_events FOR DELETE
  TO anon, authenticated USING (true);

-- Saved Searches
ALTER TABLE omni_saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_saved_searches_anon" ON omni_saved_searches FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_saved_searches_anon" ON omni_saved_searches FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_saved_searches_anon" ON omni_saved_searches FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_saved_searches_anon" ON omni_saved_searches FOR DELETE
  TO anon, authenticated USING (true);

-- Command History
ALTER TABLE omni_command_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_command_history_anon" ON omni_command_history FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_command_history_anon" ON omni_command_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_command_history_anon" ON omni_command_history FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_command_history_anon" ON omni_command_history FOR DELETE
  TO anon, authenticated USING (true);

-- ============== TRIGGERS ==============

-- Auto-update search vector
CREATE OR REPLACE FUNCTION update_search_index_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.preview, '')), 'C');
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_search_index_search BEFORE INSERT OR UPDATE ON omni_search_index
  FOR EACH ROW EXECUTE FUNCTION update_search_index_vector();

-- Auto-update saved searches timestamp
CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON omni_saved_searches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============== UTILITY VIEWS ==============

-- Analytics summary view
CREATE VIEW omni_analytics_summary AS
SELECT 
  day_bucket,
  event_category,
  event_type,
  COUNT(*) as event_count,
  COUNT(DISTINCT project_id) as project_count,
  AVG((data->>'duration_ms')::BIGINT) as avg_duration_ms
FROM omni_analytics_events
GROUP BY day_bucket, event_category, event_type
ORDER BY day_bucket DESC;

-- Frequently used commands view
CREATE VIEW omni_frequent_commands AS
SELECT 
  command_id,
  command_category,
  SUM(execution_count) as total_executions,
  MAX(last_executed_at) as last_used
FROM omni_command_history
GROUP BY command_id, command_category
ORDER BY total_executions DESC
LIMIT 20;