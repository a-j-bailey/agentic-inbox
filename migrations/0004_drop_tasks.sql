DROP TABLE IF EXISTS task_updates;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS agents;

DELETE FROM webhook_subscriptions WHERE event IN ('task.created', 'task.assigned');

CREATE TABLE webhook_subscriptions_new (
  id TEXT PRIMARY KEY,
  event TEXT NOT NULL CHECK (event IN ('email.received')),
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  mailbox_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL
);

INSERT INTO webhook_subscriptions_new (id, event, url, secret, mailbox_id, enabled, created_at)
SELECT id, event, url, secret, mailbox_id, enabled, created_at
FROM webhook_subscriptions
WHERE event = 'email.received';

DROP TABLE webhook_subscriptions;
ALTER TABLE webhook_subscriptions_new RENAME TO webhook_subscriptions;

CREATE INDEX idx_webhook_subscriptions_event ON webhook_subscriptions(event);
CREATE INDEX idx_webhook_subscriptions_enabled ON webhook_subscriptions(enabled);
