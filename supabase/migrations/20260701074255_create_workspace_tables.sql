-- Phase 5: Universal Workspace Tables
-- File Library, Notes, Tasks, Snippets, Clipboard History, Pinned Items, Activity

-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============== FOLDERS (first, as other tables reference it) ==============

CREATE TABLE omni_folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES omni_projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES omni_folders(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  path TEXT NOT NULL, -- e.g., /documents/work/
  color TEXT,
  icon TEXT,
  
  is_favorite BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_folder_in_project UNIQUE (project_id, path)
);

-- ============== FILE LIBRARY ==============

CREATE TABLE omni_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES omni_projects(id) ON DELETE CASCADE,
  
  -- File info
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  extension TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  
  -- Storage
  storage_path TEXT NOT NULL,
  storage_type TEXT NOT NULL DEFAULT 'local', -- local, indexeddb, future: cloud
  
  -- Organization
  folder_id UUID REFERENCES omni_folders(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  
  -- State
  is_favorite BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  description TEXT,
  preview_text TEXT,
  thumbnail_url TEXT,
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  last_opened_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Search vector for full-text search
  search_vector tsvector
);

-- ============== MARKDOWN NOTES ==============

CREATE TABLE omni_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES omni_projects(id) ON DELETE CASCADE,
  
  -- Content
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  
  -- Organization
  folder_id UUID REFERENCES omni_folders(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  
  -- State
  is_favorite BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  
  -- Stats
  word_count INTEGER DEFAULT 0,
  char_count INTEGER DEFAULT 0,
  reading_time INTEGER DEFAULT 0, -- in minutes
  
  -- Version tracking
  version INTEGER DEFAULT 1,
  last_auto_saved_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Search vector
  search_vector tsvector
);

-- Note version history
CREATE TABLE omni_note_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  note_id UUID NOT NULL REFERENCES omni_notes(id) ON DELETE CASCADE,
  
  content TEXT NOT NULL,
  word_count INTEGER DEFAULT 0,
  version INTEGER NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============== TASK MANAGER ==============

CREATE TABLE omni_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES omni_projects(id) ON DELETE CASCADE,
  
  -- Content
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'todo', -- todo, in_progress, review, done, archived
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
  
  -- Organization
  folder_id UUID REFERENCES omni_folders(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  
  -- Progress
  progress INTEGER DEFAULT 0, -- 0-100 percentage
  
  -- Dates
  due_date DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Ordering
  position INTEGER DEFAULT 0,
  
  -- State
  is_favorite BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Search vector
  search_vector tsvector
);

-- Task dependencies (future)
CREATE TABLE omni_task_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES omni_tasks(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES omni_tasks(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT no_self_dependency CHECK (task_id != depends_on_id),
  CONSTRAINT unique_dependency UNIQUE (task_id, depends_on_id)
);

-- ============== SNIPPET LIBRARY ==============

CREATE TABLE omni_snippets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES omni_projects(id) ON DELETE CASCADE,
  
  -- Content
  title TEXT NOT NULL,
  code TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'text',
  
  -- Type categorization
  type TEXT NOT NULL DEFAULT 'code', -- code, prompt, template, command, markdown, json, shell, sql
  
  -- Organization
  folder_id UUID REFERENCES omni_folders(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  
  -- Usage
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- State
  is_favorite BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Search vector
  search_vector tsvector
);

-- ============== CLIPBOARD HISTORY ==============

CREATE TABLE omni_clipboard_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES omni_projects(id) ON DELETE CASCADE, -- NULL for global clipboard
  
  -- Content
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text', -- text, code, link, path, command, prompt
  
  -- Detection
  detected_language TEXT,
  source_url TEXT, -- URL where copied from
  source_app TEXT, -- Always 'omni' for Chrome extension
  
  -- Size
  char_count INTEGER DEFAULT 0,
  line_count INTEGER DEFAULT 0,
  
  -- State
  is_favorite BOOLEAN DEFAULT FALSE,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  
  -- Privacy
  is_sensitive BOOLEAN DEFAULT FALSE, -- flagged as sensitive
  
  -- Usage
  copy_count INTEGER DEFAULT 1,
  last_copied_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Auto-cleanup: items older than this are candidates for deletion
  expires_at TIMESTAMPTZ,
  
  -- Search vector
  search_vector tsvector
);

-- ============== PINNED ITEMS (Unified) ==============

CREATE TABLE omni_pinned_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES omni_projects(id) ON DELETE CASCADE,
  
  -- Polymorphic reference
  item_type TEXT NOT NULL, -- file, note, task, snippet, clipboard, message, project
  item_id UUID NOT NULL, -- references the actual item
  
  -- Ordering
  position INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Note: For project pins, item_id = project_id (self-reference pattern)
  -- For message pins, item_id references a conversation message
  
  CONSTRAINT valid_item_type CHECK (item_type IN ('file', 'note', 'task', 'snippet', 'clipboard', 'message', 'project'))
);

-- ============== RECENT ACTIVITY ==============

CREATE TABLE omni_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES omni_projects(id) ON DELETE CASCADE,
  
  -- Activity info
  action TEXT NOT NULL, -- created, updated, deleted, viewed, downloaded, completed, favorited, pinned, etc.
  item_type TEXT NOT NULL, -- file, note, task, snippet, clipboard, message, project
  item_id UUID, -- nullable for project-level actions
  
  -- Details
  title TEXT, -- item title at time of action
  description TEXT, -- human-readable description
  metadata JSONB DEFAULT '{}', -- flexible additional data
  
  -- Actor (future: for multi-user)
  actor_type TEXT DEFAULT 'user', -- user, system, sync
  actor_id UUID,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============== STORAGE USAGE TRACKING ==============

CREATE TABLE omni_storage_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES omni_projects(id) ON DELETE CASCADE,
  
  -- Usage stats (calculated periodically)
  files_size BIGINT DEFAULT 0,
  notes_size BIGINT DEFAULT 0,
  clipboard_size BIGINT DEFAULT 0,
  other_size BIGINT DEFAULT 0,
  total_size BIGINT DEFAULT 0,
  
  -- File counts
  file_count INTEGER DEFAULT 0,
  note_count INTEGER DEFAULT 0,
  task_count INTEGER DEFAULT 0,
  snippet_count INTEGER DEFAULT 0,
  clipboard_count INTEGER DEFAULT 0,
  
  -- Last calculated
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_project_storage UNIQUE (project_id)
);

-- ============== INDEXES ==============

-- Files
CREATE INDEX idx_files_project ON omni_files(project_id);
CREATE INDEX idx_files_folder ON omni_files(folder_id);
CREATE INDEX idx_files_favorite ON omni_files(project_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_files_pinned ON omni_files(project_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_files_deleted ON omni_files(project_id, is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_files_search ON omni_files USING GIN(search_vector);
CREATE INDEX idx_files_created ON omni_files(project_id, created_at DESC);
CREATE INDEX idx_files_updated ON omni_files(project_id, updated_at DESC);
CREATE INDEX idx_files_recent ON omni_files(project_id, last_opened_at DESC) WHERE last_opened_at IS NOT NULL;

-- Folders
CREATE INDEX idx_folders_project ON omni_folders(project_id);
CREATE INDEX idx_folders_parent ON omni_folders(parent_id);

-- Notes
CREATE INDEX idx_notes_project ON omni_notes(project_id);
CREATE INDEX idx_notes_folder ON omni_notes(folder_id);
CREATE INDEX idx_notes_favorite ON omni_notes(project_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_notes_pinned ON omni_notes(project_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_notes_deleted ON omni_notes(project_id, is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_notes_search ON omni_notes USING GIN(search_vector);
CREATE INDEX idx_notes_created ON omni_notes(project_id, created_at DESC);
CREATE INDEX idx_notes_updated ON omni_notes(project_id, updated_at DESC);

-- Note versions
CREATE INDEX idx_note_versions_note ON omni_note_versions(note_id, created_at DESC);

-- Tasks
CREATE INDEX idx_tasks_project ON omni_tasks(project_id);
CREATE INDEX idx_tasks_folder ON omni_tasks(folder_id);
CREATE INDEX idx_tasks_status ON omni_tasks(project_id, status);
CREATE INDEX idx_tasks_priority ON omni_tasks(project_id, priority);
CREATE INDEX idx_tasks_due_date ON omni_tasks(project_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_tasks_favorite ON omni_tasks(project_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_tasks_pinned ON omni_tasks(project_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_tasks_deleted ON omni_tasks(project_id, is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_tasks_search ON omni_tasks USING GIN(search_vector);
CREATE INDEX idx_tasks_created ON omni_tasks(project_id, created_at DESC);
CREATE INDEX idx_tasks_updated ON omni_tasks(project_id, updated_at DESC);

-- Task dependencies
CREATE INDEX idx_task_deps_task ON omni_task_dependencies(task_id);
CREATE INDEX idx_task_deps_depends ON omni_task_dependencies(depends_on_id);

-- Snippets
CREATE INDEX idx_snippets_project ON omni_snippets(project_id);
CREATE INDEX idx_snippets_folder ON omni_snippets(folder_id);
CREATE INDEX idx_snippets_type ON omni_snippets(project_id, type);
CREATE INDEX idx_snippets_language ON omni_snippets(project_id, language);
CREATE INDEX idx_snippets_favorite ON omni_snippets(project_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_snippets_pinned ON omni_snippets(project_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_snippets_deleted ON omni_snippets(project_id, is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_snippets_search ON omni_snippets USING GIN(search_vector);
CREATE INDEX idx_snippets_created ON omni_snippets(project_id, created_at DESC);
CREATE INDEX idx_snippets_recent ON omni_snippets(project_id, last_used_at DESC) WHERE last_used_at IS NOT NULL;

-- Clipboard
CREATE INDEX idx_clipboard_project ON omni_clipboard_items(project_id);
CREATE INDEX idx_clipboard_favorite ON omni_clipboard_items(project_id, is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_clipboard_pinned ON omni_clipboard_items(project_id, is_pinned) WHERE is_pinned = TRUE;
CREATE INDEX idx_clipboard_deleted ON omni_clipboard_items(project_id, is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_clipboard_search ON omni_clipboard_items USING GIN(search_vector);
CREATE INDEX idx_clipboard_created ON omni_clipboard_items(created_at DESC);
CREATE INDEX idx_clipboard_content_type ON omni_clipboard_items(content_type);

-- Pinned items
CREATE INDEX idx_pinned_project ON omni_pinned_items(project_id);
CREATE INDEX idx_pinned_type ON omni_pinned_items(project_id, item_type);
CREATE INDEX idx_pinned_position ON omni_pinned_items(project_id, position);

-- Activity
CREATE INDEX idx_activity_project ON omni_activity(project_id, created_at DESC);
CREATE INDEX idx_activity_item ON omni_activity(project_id, item_type, item_id);
CREATE INDEX idx_activity_action ON omni_activity(project_id, action);

-- Storage usage
CREATE INDEX idx_storage_project ON omni_storage_usage(project_id);

-- ============== ROW LEVEL SECURITY ==============

-- Folders
ALTER TABLE omni_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_folders_anon" ON omni_folders FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_folders_anon" ON omni_folders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_folders_anon" ON omni_folders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_folders_anon" ON omni_folders FOR DELETE
  TO anon, authenticated USING (true);

-- Files
ALTER TABLE omni_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_files_anon" ON omni_files FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_files_anon" ON omni_files FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_files_anon" ON omni_files FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_files_anon" ON omni_files FOR DELETE
  TO anon, authenticated USING (true);

-- Notes
ALTER TABLE omni_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_notes_anon" ON omni_notes FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_notes_anon" ON omni_notes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_notes_anon" ON omni_notes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_notes_anon" ON omni_notes FOR DELETE
  TO anon, authenticated USING (true);

-- Note versions
ALTER TABLE omni_note_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_note_versions_anon" ON omni_note_versions FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_note_versions_anon" ON omni_note_versions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "delete_note_versions_anon" ON omni_note_versions FOR DELETE
  TO anon, authenticated USING (true);

-- Tasks
ALTER TABLE omni_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_tasks_anon" ON omni_tasks FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_tasks_anon" ON omni_tasks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_tasks_anon" ON omni_tasks FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_tasks_anon" ON omni_tasks FOR DELETE
  TO anon, authenticated USING (true);

-- Task dependencies
ALTER TABLE omni_task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_task_deps_anon" ON omni_task_dependencies FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_task_deps_anon" ON omni_task_dependencies FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "delete_task_deps_anon" ON omni_task_dependencies FOR DELETE
  TO anon, authenticated USING (true);

-- Snippets
ALTER TABLE omni_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_snippets_anon" ON omni_snippets FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_snippets_anon" ON omni_snippets FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_snippets_anon" ON omni_snippets FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_snippets_anon" ON omni_snippets FOR DELETE
  TO anon, authenticated USING (true);

-- Clipboard
ALTER TABLE omni_clipboard_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_clipboard_anon" ON omni_clipboard_items FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_clipboard_anon" ON omni_clipboard_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_clipboard_anon" ON omni_clipboard_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_clipboard_anon" ON omni_clipboard_items FOR DELETE
  TO anon, authenticated USING (true);

-- Pinned items
ALTER TABLE omni_pinned_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_pinned_anon" ON omni_pinned_items FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_pinned_anon" ON omni_pinned_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_pinned_anon" ON omni_pinned_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_pinned_anon" ON omni_pinned_items FOR DELETE
  TO anon, authenticated USING (true);

-- Activity
ALTER TABLE omni_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_activity_anon" ON omni_activity FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_activity_anon" ON omni_activity FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Storage usage
ALTER TABLE omni_storage_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_storage_anon" ON omni_storage_usage FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "insert_storage_anon" ON omni_storage_usage FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE POLICY "update_storage_anon" ON omni_storage_usage FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============== TRIGGERS ==============

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON omni_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON omni_files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON omni_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON omni_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_snippets_updated_at BEFORE UPDATE ON omni_snippets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-generate search vectors
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  -- For files
  IF TG_TABLE_NAME = 'omni_files' THEN
    NEW.search_vector = 
      setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(NEW.original_name, '')), 'B') ||
      setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
      setweight(to_tsvector('english', COALESCE(NEW.preview_text, '')), 'D');
  -- For notes
  ELSIF TG_TABLE_NAME = 'omni_notes' THEN
    NEW.search_vector = 
      setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'B');
  -- For tasks
  ELSIF TG_TABLE_NAME = 'omni_tasks' THEN
    NEW.search_vector = 
      setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  -- For snippets
  ELSIF TG_TABLE_NAME = 'omni_snippets' THEN
    NEW.search_vector = 
      setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
      setweight(to_tsvector('english', COALESCE(NEW.code, '')), 'B');
  -- For clipboard
  ELSIF TG_TABLE_NAME = 'omni_clipboard_items' THEN
    NEW.search_vector = to_tsvector('english', COALESCE(NEW.content, ''));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_files_search BEFORE INSERT OR UPDATE ON omni_files
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

CREATE TRIGGER update_notes_search BEFORE INSERT OR UPDATE ON omni_notes
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

CREATE TRIGGER update_tasks_search BEFORE INSERT OR UPDATE ON omni_tasks
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

CREATE TRIGGER update_snippets_search BEFORE INSERT OR UPDATE ON omni_snippets
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

CREATE TRIGGER update_clipboard_search BEFORE INSERT OR UPDATE ON omni_clipboard_items
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Note version history trigger
CREATE OR REPLACE FUNCTION save_note_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    INSERT INTO omni_note_versions (note_id, content, word_count, version)
    VALUES (NEW.id, OLD.content, OLD.word_count, OLD.version);
    
    NEW.version := OLD.version + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER save_note_version_trigger BEFORE UPDATE ON omni_notes
  FOR EACH ROW EXECUTE FUNCTION save_note_version();

-- Auto-track activity
CREATE OR REPLACE FUNCTION track_activity()
RETURNS TRIGGER AS $$
DECLARE
  action_type TEXT;
  item_title TEXT;
BEGIN
  -- Determine action type based on operation
  IF TG_OP = 'INSERT' THEN
    action_type := 'created';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
      action_type := 'deleted';
    ELSIF OLD.is_favorite = FALSE AND NEW.is_favorite = TRUE THEN
      action_type := 'favorited';
    ELSIF OLD.is_pinned = FALSE AND NEW.is_pinned = TRUE THEN
      action_type := 'pinned';
    ELSE
      action_type := 'updated';
    END IF;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Get item title based on table
  IF TG_TABLE_NAME = 'omni_files' THEN
    item_title := NEW.name;
  ELSIF TG_TABLE_NAME = 'omni_notes' THEN
    item_title := NEW.title;
  ELSIF TG_TABLE_NAME = 'omni_tasks' THEN
    item_title := NEW.title;
  ELSIF TG_TABLE_NAME = 'omni_snippets' THEN
    item_title := NEW.title;
  ELSIF TG_TABLE_NAME = 'omni_clipboard_items' THEN
    item_title := LEFT(NEW.content, 50);
  END IF;
  
  -- Insert activity record
  INSERT INTO omni_activity (project_id, action, item_type, item_id, title)
  VALUES (
    NEW.project_id,
    action_type,
    TG_TABLE_NAME,
    NEW.id,
    item_title
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_file_activity AFTER INSERT OR UPDATE ON omni_files
  FOR EACH ROW EXECUTE FUNCTION track_activity();

CREATE TRIGGER track_note_activity AFTER INSERT OR UPDATE ON omni_notes
  FOR EACH ROW EXECUTE FUNCTION track_activity();

CREATE TRIGGER track_task_activity AFTER INSERT OR UPDATE ON omni_tasks
  FOR EACH ROW EXECUTE FUNCTION track_activity();

CREATE TRIGGER track_snippet_activity AFTER INSERT OR UPDATE ON omni_snippets
  FOR EACH ROW EXECUTE FUNCTION track_activity();

CREATE TRIGGER track_clipboard_activity AFTER INSERT OR UPDATE ON omni_clipboard_items
  FOR EACH ROW EXECUTE FUNCTION track_activity();