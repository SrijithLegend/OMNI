/*
# Omni Extension - AI Switch History Tables

This migration creates tables for tracking AI platform switches.
*/

-- Create omni_switch_history table
CREATE TABLE IF NOT EXISTS omni_switch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform text NOT NULL,
  target_platform text NOT NULL,
  conversation_id uuid REFERENCES omni_conversations(id) ON DELETE SET NULL,
  project_id uuid REFERENCES omni_projects(id) ON DELETE SET NULL,
  context_size integer DEFAULT 0,
  transfer_size integer DEFAULT 0,
  status text DEFAULT 'success' CHECK (status IN ('success', 'failed', 'cancelled')),
  error text,
  duration_ms integer DEFAULT 0,
  timestamp timestamptz DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE omni_switch_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "anon_select_switch_history" ON omni_switch_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_insert_switch_history" ON omni_switch_history FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon_delete_switch_history" ON omni_switch_history FOR DELETE TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_switch_history_timestamp ON omni_switch_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_switch_history_source ON omni_switch_history(source_platform);
CREATE INDEX IF NOT EXISTS idx_switch_history_target ON omni_switch_history(target_platform);
CREATE INDEX IF NOT EXISTS idx_switch_history_conversation ON omni_switch_history(conversation_id);
CREATE INDEX IF NOT EXISTS idx_switch_history_project ON omni_switch_history(project_id);
CREATE INDEX IF NOT EXISTS idx_switch_history_status ON omni_switch_history(status);

-- Function to get switch analytics
CREATE OR REPLACE FUNCTION get_switch_analytics()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'totalSwitches', COUNT(*),
    'successfulSwitches', COUNT(*) FILTER (WHERE status = 'success'),
    'failedSwitches', COUNT(*) FILTER (WHERE status = 'failed'),
    'cancelledSwitches', COUNT(*) FILTER (WHERE status = 'cancelled'),
    'averageDuration', COALESCE(AVG(duration_ms), 0),
    'averageTransferSize', COALESCE(AVG(transfer_size), 0),
    'mostCommonSource', (SELECT source_platform FROM omni_switch_history GROUP BY source_platform ORDER BY COUNT(*) DESC LIMIT 1),
    'mostCommonTarget', (SELECT target_platform FROM omni_switch_history GROUP BY target_platform ORDER BY COUNT(*) DESC LIMIT 1),
    'switchesByPlatform', (SELECT jsonb_object_agg(source_platform, cnt) FROM (
      SELECT source_platform, COUNT(*) as cnt FROM omni_switch_history GROUP BY source_platform
    ) t)
  ) INTO result
  FROM omni_switch_history;

  RETURN result;
END;
$$ LANGUAGE plpgsql;