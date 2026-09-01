CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('pending','blocked','in_progress','done')),
  assignee_name TEXT NOT NULL,
  assignee_id TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  blocked_reason TEXT,
  mailbox_id TEXT,
  email_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  blocked_at TEXT,
  deleted_at TEXT
);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_name);
CREATE INDEX idx_tasks_deleted ON tasks(deleted_at);
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

INSERT INTO agents (id, name) VALUES
  ('d905a2a4-4426-4cd7-ad19-183cf031d2e3', 'Donna'),
  ('b79d66d3-85c0-48cb-bf74-6fb965b1371c', 'Ponder'),
  ('f0de4156-c4ad-4ff4-a81b-8066f1d4f675', 'C.W. Longbottom'),
  ('0c54b2a9-e04e-4ecb-8558-109d0ab097fc', 'Zoning Radar'),
  ('9db2efd9-775c-43d6-a67b-065808af010e', 'Potager'),
  ('04054150-b374-4db8-92f1-078e4b5609cb', 'Weather Otter'),
  ('bb565910-1d6d-446c-9588-3d157d6f3abc', 'Coach'),
  ('45dd2d34-faaa-4e05-a745-608997118b6a', 'Mr. Moneybags'),
  ('6ea714f5-342f-4489-8d72-9bd989db5aa0', 'Tutor'),
  ('e640e607-af16-4f79-ad4a-95160e235f02', 'point peddler');
