CREATE TABLE webhook_subscriptions (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL CHECK (event IN ('email.received','task.created','task.assigned')),
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  mailbox_id TEXT,
  assignee TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_webhook_subscriptions_event ON webhook_subscriptions(event);
CREATE INDEX idx_webhook_subscriptions_enabled ON webhook_subscriptions(enabled);
