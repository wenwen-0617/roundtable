CREATE TABLE IF NOT EXISTS runtime_runs (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'runtime_turn',
  speaker TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'running',
  title TEXT NOT NULL DEFAULT '',
  phase TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  thread_id TEXT NOT NULL DEFAULT '',
  turn_id TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  ended_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_runtime_runs_topic_updated
  ON runtime_runs(topic_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_runtime_runs_message
  ON runtime_runs(message_id);

CREATE INDEX IF NOT EXISTS idx_runtime_runs_turn
  ON runtime_runs(thread_id, turn_id);

CREATE TABLE IF NOT EXISTS runtime_worklog_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runtime_runs(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL DEFAULT '',
  seq INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL DEFAULT '',
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_runtime_worklog_run_seq
  ON runtime_worklog_events(run_id, seq);

CREATE INDEX IF NOT EXISTS idx_runtime_worklog_topic_id
  ON runtime_worklog_events(topic_id, id);

CREATE INDEX IF NOT EXISTS idx_runtime_worklog_message
  ON runtime_worklog_events(message_id, id);
