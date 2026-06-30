/*
# Omni Extension Core Database Schema

1. New Tables
- `omni_workspaces`: Stores user workspace data with projects, settings, and activity.
- `omni_projects`: Stores project data (name, color, icon, conversations, files, notes, tasks).
- `omni_conversations`: Stores captured AI conversations with metadata.
- `omni_timeline_events`: Stores timeline events for all workspace activity.
- `omni_settings`: Stores user settings (appearance, keyboard, storage, notifications, privacy, experimental, developer).
- `omni_connectors`: Stores third-party connector configurations and status.
- `omni_exports`: Stores export job history.

2. Security
- Enable RLS on all tables.
- Single-tenant app: no user auth required. All data is intentionally local per device.
- Use `TO anon, authenticated` for all CRUD operations.
- This allows the extension's Supabase client to read/write data without requiring user sign-in.
*/

CREATE TABLE IF NOT EXISTS omni_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Workspace',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  projects jsonb NOT NULL DEFAULT '[]',
  active_project_id uuid,
  recent_project_ids jsonb NOT NULL DEFAULT '[]',
  last_view text DEFAULT 'workspace',
  sidebar_open boolean DEFAULT true,
  sidebar_width integer DEFAULT 280,
  recent_activity jsonb NOT NULL DEFAULT '[]',
  search_index jsonb NOT NULL DEFAULT '[]',
  pinned jsonb NOT NULL DEFAULT '[]',
  notifications jsonb NOT NULL DEFAULT '[]',
  unread_count integer DEFAULT 0,
  connector_ids jsonb NOT NULL DEFAULT '[]',
  settings_id uuid,
  stats jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS omni_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES omni_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  color text DEFAULT '#7c3aed',
  icon text DEFAULT 'folder',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  status text DEFAULT 'active',
  sort_order integer DEFAULT 0,
  conversations jsonb NOT NULL DEFAULT '[]',
  files jsonb NOT NULL DEFAULT '[]',
  notes jsonb NOT NULL DEFAULT '[]',
  tasks jsonb NOT NULL DEFAULT '[]',
  pinned jsonb NOT NULL DEFAULT '[]',
  connectors jsonb NOT NULL DEFAULT '[]',
  stats jsonb NOT NULL DEFAULT '{}',
  memory jsonb
);

CREATE TABLE IF NOT EXISTS omni_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES omni_projects(id) ON DELETE CASCADE,
  source text NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]',
  captured_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  truncated boolean DEFAULT false,
  total_chars integer DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS omni_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  category text NOT NULL,
  project_id uuid REFERENCES omni_projects(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES omni_conversations(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  timestamp timestamptz DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}',
  icon text DEFAULT 'circle',
  color text DEFAULT '#7c3aed'
);

CREATE TABLE IF NOT EXISTS omni_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text DEFAULT '1.0.0',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  appearance jsonb NOT NULL DEFAULT '{}',
  keyboard jsonb NOT NULL DEFAULT '{}',
  storage jsonb NOT NULL DEFAULT '{}',
  notifications jsonb NOT NULL DEFAULT '{}',
  privacy jsonb NOT NULL DEFAULT '{}',
  experimental jsonb NOT NULL DEFAULT '{}',
  developer jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS omni_connectors (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  version text NOT NULL,
  enabled boolean DEFAULT false,
  status text DEFAULT 'disconnected',
  config jsonb NOT NULL DEFAULT '{}',
  last_sync_at timestamptz,
  error_count integer DEFAULT 0,
  last_error text
);

CREATE TABLE IF NOT EXISTS omni_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  format text NOT NULL,
  status text DEFAULT 'pending',
  project_id uuid REFERENCES omni_projects(id) ON DELETE SET NULL,
  conversation_ids jsonb NOT NULL DEFAULT '[]',
  file_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error text,
  download_url text
);

-- Enable RLS on all tables
ALTER TABLE omni_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE omni_exports ENABLE ROW LEVEL SECURITY;

-- Single-tenant: anon + authenticated can CRUD all data
DROP POLICY IF EXISTS "anon_select_workspaces" ON omni_workspaces;
DROP POLICY IF EXISTS "anon_insert_workspaces" ON omni_workspaces;
DROP POLICY IF EXISTS "anon_update_workspaces" ON omni_workspaces;
DROP POLICY IF EXISTS "anon_delete_workspaces" ON omni_workspaces;
CREATE POLICY "anon_select_workspaces" ON omni_workspaces FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_workspaces" ON omni_workspaces FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_workspaces" ON omni_workspaces FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_workspaces" ON omni_workspaces FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_projects" ON omni_projects;
DROP POLICY IF EXISTS "anon_insert_projects" ON omni_projects;
DROP POLICY IF EXISTS "anon_update_projects" ON omni_projects;
DROP POLICY IF EXISTS "anon_delete_projects" ON omni_projects;
CREATE POLICY "anon_select_projects" ON omni_projects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_projects" ON omni_projects FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_projects" ON omni_projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_projects" ON omni_projects FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_conversations" ON omni_conversations;
DROP POLICY IF EXISTS "anon_insert_conversations" ON omni_conversations;
DROP POLICY IF EXISTS "anon_update_conversations" ON omni_conversations;
DROP POLICY IF EXISTS "anon_delete_conversations" ON omni_conversations;
CREATE POLICY "anon_select_conversations" ON omni_conversations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_conversations" ON omni_conversations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_conversations" ON omni_conversations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_conversations" ON omni_conversations FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_timeline" ON omni_timeline_events;
DROP POLICY IF EXISTS "anon_insert_timeline" ON omni_timeline_events;
DROP POLICY IF EXISTS "anon_update_timeline" ON omni_timeline_events;
DROP POLICY IF EXISTS "anon_delete_timeline" ON omni_timeline_events;
CREATE POLICY "anon_select_timeline" ON omni_timeline_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_timeline" ON omni_timeline_events FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_timeline" ON omni_timeline_events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_timeline" ON omni_timeline_events FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_settings" ON omni_settings;
DROP POLICY IF EXISTS "anon_insert_settings" ON omni_settings;
DROP POLICY IF EXISTS "anon_update_settings" ON omni_settings;
DROP POLICY IF EXISTS "anon_delete_settings" ON omni_settings;
CREATE POLICY "anon_select_settings" ON omni_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_settings" ON omni_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_settings" ON omni_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_settings" ON omni_settings FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_connectors" ON omni_connectors;
DROP POLICY IF EXISTS "anon_insert_connectors" ON omni_connectors;
DROP POLICY IF EXISTS "anon_update_connectors" ON omni_connectors;
DROP POLICY IF EXISTS "anon_delete_connectors" ON omni_connectors;
CREATE POLICY "anon_select_connectors" ON omni_connectors FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_connectors" ON omni_connectors FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_connectors" ON omni_connectors FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_connectors" ON omni_connectors FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_exports" ON omni_exports;
DROP POLICY IF EXISTS "anon_insert_exports" ON omni_exports;
DROP POLICY IF EXISTS "anon_update_exports" ON omni_exports;
DROP POLICY IF EXISTS "anon_delete_exports" ON omni_exports;
CREATE POLICY "anon_select_exports" ON omni_exports FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_exports" ON omni_exports FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_update_exports" ON omni_exports FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_exports" ON omni_exports FOR DELETE TO anon, authenticated USING (true);
