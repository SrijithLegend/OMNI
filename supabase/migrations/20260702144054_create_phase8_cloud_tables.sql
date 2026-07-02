-- Phase 8: Cloud Platform, Accounts & SaaS Infrastructure
-- Users, Profiles, Devices, Sessions, Subscriptions, Backups

-- ============== USER PROFILES ==============

CREATE TABLE omni_user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL, -- References auth.users from Supabase Auth
  
  -- Profile info
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  
  -- Settings
  theme TEXT DEFAULT 'system',
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'UTC',
  keyboard_shortcuts JSONB DEFAULT '{}',
  notification_settings JSONB DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{}',
  connector_preferences JSONB DEFAULT '{}',
  
  -- Workspace statistics (synced from local)
  workspace_stats JSONB DEFAULT '{}',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ,
  
  CONSTRAINT valid_theme CHECK (theme IN ('light', 'dark', 'system'))
);

-- ============== DEVICES ==============

CREATE TABLE omni_user_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  
  -- Device info
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'browser', -- browser, desktop, mobile
  browser_name TEXT,
  browser_version TEXT,
  os_name TEXT,
  os_version TEXT,
  
  -- Identification
  device_fingerprint TEXT, -- Browser fingerprint for recognition
  user_agent TEXT,
  
  -- Status
  is_trusted BOOLEAN DEFAULT FALSE,
  is_current BOOLEAN DEFAULT FALSE,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  last_ip TEXT,
  last_location TEXT, -- Country/city approximation
  
  -- Session info
  session_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  
  CONSTRAINT valid_device_type CHECK (device_type IN ('browser', 'desktop', 'mobile', 'extension'))
);

-- ============== USER SESSIONS ==============

CREATE TABLE omni_user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  device_id UUID REFERENCES omni_user_devices(id) ON DELETE CASCADE,
  
  -- Session info
  session_token_hash TEXT NOT NULL, -- Hashed session token
  refresh_token_hash TEXT, -- Hashed refresh token
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Security
  ip_address TEXT,
  user_agent TEXT,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT
);

-- ============== SUBSCRIPTIONS ==============

CREATE TABLE omni_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  
  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  
  -- Subscription details
  plan TEXT NOT NULL DEFAULT 'free', -- free, pro, team, enterprise
  status TEXT NOT NULL DEFAULT 'active', -- active, past_due, canceled, incomplete, trialing
  
  -- Billing cycle
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  
  -- Trial
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Limits (configurable per plan)
  limits JSONB DEFAULT '{}', -- max_projects, max_storage_mb, max_devices, etc.
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_plan CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete', 'trialing', 'unpaid'))
);

-- ============== PLAN LIMITS ==============

CREATE TABLE omni_plan_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan TEXT NOT NULL UNIQUE,
  
  -- Limits
  max_projects INTEGER DEFAULT 10,
  max_storage_mb INTEGER DEFAULT 100,
  max_devices INTEGER DEFAULT 2,
  max_connectors INTEGER DEFAULT 3,
  max_backups INTEGER DEFAULT 5,
  max_sync_frequency_minutes INTEGER DEFAULT 60,
  
  -- Features
  can_export_pdf BOOLEAN DEFAULT FALSE,
  can_advanced_search BOOLEAN DEFAULT FALSE,
  can_cloud_backup BOOLEAN DEFAULT FALSE,
  can_workspace_recovery BOOLEAN DEFAULT FALSE,
  can_priority_sync BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly_cents INTEGER DEFAULT 0,
  price_yearly_cents INTEGER DEFAULT 0,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_plan_name CHECK (plan IN ('free', 'pro', 'team', 'enterprise'))
);

-- Insert default plan limits
INSERT INTO omni_plan_limits (plan, display_name, description, max_projects, max_storage_mb, max_devices, max_connectors, max_backups, max_sync_frequency_minutes, can_export_pdf, can_advanced_search, can_cloud_backup, can_workspace_recovery, can_priority_sync, price_monthly_cents) VALUES
('free', 'Free', 'Basic features for personal use', 10, 100, 2, 3, 5, 60, false, false, false, false, false, 0),
('pro', 'Pro', 'Professional features for power users', -1, 10000, 10, -1, -1, 5, true, true, true, true, true, 999),
('team', 'Team', 'Collaborative features for teams', -1, 50000, 50, -1, -1, 1, true, true, true, true, true, 2999),
('enterprise', 'Enterprise', 'Enterprise features for organizations', -1, -1, -1, -1, -1, 1, true, true, true, true, true, 9999);

-- ============== USER BACKUPS ==============

CREATE TABLE omni_user_backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  
  -- Backup info
  backup_type TEXT NOT NULL DEFAULT 'manual', -- automatic, manual, scheduled
  backup_scope TEXT NOT NULL DEFAULT 'workspace', -- workspace, project, settings
  
  -- Content reference
  storage_path TEXT, -- Path in cloud storage
  storage_size_bytes BIGINT DEFAULT 0,
  compression_type TEXT DEFAULT 'gzip',
  encrypted BOOLEAN DEFAULT TRUE,
  
  -- Content summary
  project_count INTEGER DEFAULT 0,
  conversation_count INTEGER DEFAULT 0,
  note_count INTEGER DEFAULT 0,
  task_count INTEGER DEFAULT 0,
  file_count INTEGER DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, expired
  progress INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Retention
  expires_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_backup_type CHECK (backup_type IN ('automatic', 'manual', 'scheduled')),
  CONSTRAINT valid_backup_scope CHECK (backup_scope IN ('workspace', 'project', 'settings')),
  CONSTRAINT valid_backup_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired'))
);

-- ============== SYNC METADATA ==============

CREATE TABLE omni_cloud_sync_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  
  -- Entity reference
  entity_type TEXT NOT NULL, -- project, conversation, note, task, file, snippet, clipboard, timeline, pinned
  entity_id UUID NOT NULL,
  local_id TEXT, -- ID used locally (for mapping)
  
  -- Version tracking
  version INTEGER NOT NULL DEFAULT 1,
  checksum TEXT, -- Hash of content for conflict detection
  
  -- Sync state
  sync_state TEXT NOT NULL DEFAULT 'pending', -- pending, synced, conflict, deleted
  last_synced_at TIMESTAMPTZ,
  last_modified_at TIMESTAMPTZ DEFAULT NOW(),
  last_modified_device_id UUID REFERENCES omni_user_devices(id),
  
  -- Conflict info
  conflict_data JSONB, -- Stores conflicting versions
  conflict_resolved_at TIMESTAMPTZ,
  conflict_resolution TEXT, -- latest_wins, manual_merge, local_wins, remote_wins
  
  -- Storage reference
  storage_path TEXT, -- For large entities stored separately
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_entity UNIQUE (user_id, entity_type, entity_id),
  CONSTRAINT valid_sync_entity_type CHECK (entity_type IN ('project', 'conversation', 'message', 'note', 'task', 'file', 'snippet', 'clipboard', 'timeline', 'pinned', 'settings', 'connector')),
  CONSTRAINT valid_sync_state CHECK (sync_state IN ('pending', 'synced', 'conflict', 'deleted'))
);

-- ============== USER NOTIFICATIONS ==============

CREATE TABLE omni_user_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  
  -- Notification info
  type TEXT NOT NULL, -- sync_completed, sync_failed, backup_completed, subscription_expiring, etc.
  title TEXT NOT NULL,
  message TEXT,
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Action
  action_type TEXT, -- link, dismiss, upgrade
  action_url TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  CONSTRAINT valid_notification_type CHECK (type IN ('sync_completed', 'sync_failed', 'backup_completed', 'backup_failed', 'restore_completed', 'subscription_expiring', 'subscription_expired', 'payment_failed', 'new_device_login', 'subscription_renewed', 'subscription_canceled', 'storage_limit_warning', 'storage_limit_exceeded'))
);

-- ============== AUDIT LOG ==============

CREATE TABLE omni_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  
  -- Event info
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  
  -- Context
  device_id UUID REFERENCES omni_user_devices(id),
  ip_address TEXT,
  user_agent TEXT,
  
  -- Details
  details JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_event_category CHECK (event_category IN ('auth', 'sync', 'subscription', 'backup', 'device', 'settings', 'security'))
);

-- ============== INDEXES ==============

-- User Profiles
CREATE INDEX idx_user_profiles_user_id ON omni_user_profiles(user_id);
CREATE INDEX idx_user_profiles_email ON omni_user_profiles(email);

-- Devices
CREATE INDEX idx_devices_user ON omni_user_devices(user_id);
CREATE INDEX idx_devices_fingerprint ON omni_user_devices(device_fingerprint);
CREATE INDEX idx_devices_active ON omni_user_devices(user_id, last_active_at DESC) WHERE revoked_at IS NULL;

-- Sessions
CREATE INDEX idx_sessions_user ON omni_user_sessions(user_id);
CREATE INDEX idx_sessions_device ON omni_user_sessions(device_id);
CREATE INDEX idx_sessions_active ON omni_user_sessions(user_id, expires_at) WHERE is_active = TRUE;

-- Subscriptions
CREATE INDEX idx_subscriptions_user ON omni_subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON omni_subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription ON omni_subscriptions(stripe_subscription_id);

-- Backups
CREATE INDEX idx_backups_user ON omni_user_backups(user_id);
CREATE INDEX idx_backups_status ON omni_user_backups(user_id, status);
CREATE INDEX idx_backups_created ON omni_user_backups(user_id, created_at DESC);

-- Sync Metadata
CREATE INDEX idx_cloud_sync_user ON omni_cloud_sync_metadata(user_id);
CREATE INDEX idx_cloud_sync_entity ON omni_cloud_sync_metadata(entity_type, entity_id);
CREATE INDEX idx_cloud_sync_state ON omni_cloud_sync_metadata(user_id, sync_state);
CREATE INDEX idx_cloud_sync_modified ON omni_cloud_sync_metadata(user_id, last_modified_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user ON omni_user_notifications(user_id);
CREATE INDEX idx_notifications_unread ON omni_user_notifications(user_id, created_at DESC) WHERE is_read = FALSE;

-- Audit Log
CREATE INDEX idx_audit_user ON omni_audit_log(user_id);
CREATE INDEX idx_audit_type ON omni_audit_log(event_type);
CREATE INDEX idx_audit_category ON omni_audit_log(event_category);
CREATE INDEX idx_audit_created ON omni_audit_log(created_at DESC);

-- ============== ROW LEVEL SECURITY ==============

-- User Profiles
ALTER TABLE omni_user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_profile" ON omni_user_profiles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_own_profile" ON omni_user_profiles FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_own_profile" ON omni_user_profiles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Devices
ALTER TABLE omni_user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_devices" ON omni_user_devices FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_own_devices" ON omni_user_devices FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_own_devices" ON omni_user_devices FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_own_devices" ON omni_user_devices FOR DELETE
  TO authenticated USING (true);

-- Sessions
ALTER TABLE omni_user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_sessions" ON omni_user_sessions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_own_sessions" ON omni_user_sessions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_own_sessions" ON omni_user_sessions FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "delete_own_sessions" ON omni_user_sessions FOR DELETE
  TO authenticated USING (true);

-- Subscriptions
ALTER TABLE omni_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_subscription" ON omni_subscriptions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_own_subscription" ON omni_subscriptions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_own_subscription" ON omni_subscriptions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Plan Limits (read-only for authenticated users)
ALTER TABLE omni_plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_plan_limits" ON omni_plan_limits FOR SELECT
  TO authenticated USING (true);

-- Backups
ALTER TABLE omni_user_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_backups" ON omni_user_backups FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_own_backups" ON omni_user_backups FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_own_backups" ON omni_user_backups FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_own_backups" ON omni_user_backups FOR DELETE
  TO authenticated USING (true);

-- Sync Metadata
ALTER TABLE omni_cloud_sync_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_sync" ON omni_cloud_sync_metadata FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_own_sync" ON omni_cloud_sync_metadata FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_own_sync" ON omni_cloud_sync_metadata FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_own_sync" ON omni_cloud_sync_metadata FOR DELETE
  TO authenticated USING (true);

-- Notifications
ALTER TABLE omni_user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_notifications" ON omni_user_notifications FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_own_notifications" ON omni_user_notifications FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_own_notifications" ON omni_user_notifications FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_own_notifications" ON omni_user_notifications FOR DELETE
  TO authenticated USING (true);

-- Audit Log
ALTER TABLE omni_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_audit" ON omni_audit_log FOR SELECT
  TO authenticated USING (true);

-- ============== VIEWS ==============

-- Active sessions view
CREATE VIEW omni_active_sessions AS
SELECT 
  s.id,
  s.user_id,
  s.device_id,
  d.device_name,
  d.device_type,
  d.last_active_at,
  s.created_at,
  s.expires_at
FROM omni_user_sessions s
LEFT JOIN omni_user_devices d ON s.device_id = d.id
WHERE s.is_active = TRUE AND s.expires_at > NOW()
ORDER BY s.last_activity_at DESC;

-- User subscription summary
CREATE VIEW omni_subscription_summary AS
SELECT 
  s.user_id,
  s.plan,
  s.status,
  s.current_period_end,
  s.cancel_at_period_end,
  s.trial_end,
  pl.display_name as plan_name,
  pl.price_monthly_cents,
  pl.max_projects,
  pl.max_storage_mb,
  pl.max_devices
FROM omni_subscriptions s
JOIN omni_plan_limits pl ON s.plan = pl.plan;