CREATE TABLE task_updates (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_task_updates_task_id ON task_updates(task_id, created_at);
