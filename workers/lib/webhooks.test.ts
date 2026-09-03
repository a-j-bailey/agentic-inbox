// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { receiveEmail, app } from "../index";
import {
	toolCreateWebhook,
	toolDeleteWebhook,
	toolListWebhooks,
} from "./tools";
import { createWebhook, dispatchWebhooks } from "./webhooks";

const migrationsDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"../../migrations",
);
const migrationSql = [
	"0001_tasks.sql",
	"0002_task_updates.sql",
	"0003_webhook_subscriptions.sql",
]
	.map((file) => readFileSync(join(migrationsDir, file), "utf8"))
	.join("\n");

let mf: Miniflare;
let db: D1Database;
const originalFetch = globalThis.fetch;

function applyMigrationsSql(): string[] {
	return migrationSql
		.split(";")
		.map((statement) => statement.trim())
		.filter((statement) => statement.length > 0);
}

function testEnv(overrides: Record<string, unknown> = {}) {
	return {
		DB: db,
		DOMAINS: "example.com",
		EMAIL_ADDRESSES: [],
		BUCKET: {
			async head() {
				return { key: "mailboxes/inbox@example.com.json" };
			},
			async get() {
				return null;
			},
			async put() {},
			async delete() {},
			async list() {
				return { objects: [], truncated: false };
			},
		},
		MAILBOX: {
			idFromName: (name: string) => name,
			get: () => ({
				createEmail: async () => {},
				findThreadBySubject: async () => null,
			}),
		},
		EMAIL_AGENT: {
			idFromName: (name: string) => name,
			get: () => ({
				fetch: async () => new Response("ok"),
			}),
		},
		...overrides,
	};
}

async function jsonRequest(
	path: string,
	init: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
	const res = await app.request(path, init, testEnv());
	const contentType = res.headers.get("content-type") ?? "";
	const body = contentType.includes("application/json")
		? await res.json()
		: await res.text();
	return { status: res.status, body };
}

function rawEmailStream(raw: string): { raw: ReadableStream; rawSize: number } {
	const bytes = new TextEncoder().encode(raw);
	return {
		raw: new ReadableStream({
			start(controller) {
				controller.enqueue(bytes);
				controller.close();
			},
		}),
		rawSize: bytes.byteLength,
	};
}

describe("outbound webhooks", () => {
	beforeAll(async () => {
		mf = new Miniflare({
			compatibilityDate: "2025-11-28",
			modules: true,
			script: "export default { fetch() { return new Response('ok'); } }",
			d1Databases: ["DB"],
		});
		db = await mf.getD1Database("DB");
	}, 60_000);

	afterAll(async () => {
		await mf.dispose();
	});

	beforeEach(async () => {
		await db.exec("DROP TABLE IF EXISTS webhook_subscriptions");
		await db.exec("DROP TABLE IF EXISTS task_updates");
		await db.exec("DROP TABLE IF EXISTS tasks");
		await db.exec("DROP TABLE IF EXISTS agents");
		for (const statement of applyMigrationsSql()) {
			await db.prepare(statement).run();
		}
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it("masks the secret on create and list", async () => {
		const created = await jsonRequest("/api/v1/webhooks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				event: "task.created",
				url: "https://bots.example/hook",
				secret: "super-secret-token",
				assignee: "Ponder",
			}),
		});
		expect(created.status).toBe(201);
		const createdBody = created.body as { secret: string; url: string };
		expect(createdBody.secret).toBe("••••oken");
		expect(JSON.stringify(created.body)).not.toContain("super-secret-token");

		const listed = await jsonRequest("/api/v1/webhooks");
		expect(listed.status).toBe(200);
		const webhooks = (listed.body as { webhooks: Array<{ secret: string }> }).webhooks;
		expect(webhooks[0]?.secret).toBe("••••oken");
		expect(JSON.stringify(listed.body)).not.toContain("super-secret-token");
	});

	it("MCP webhook tools do not return the full secret", async () => {
		const env = testEnv();
		const created = await toolCreateWebhook(env, {
			event: "email.received",
			url: "https://bots.example/mail",
			secret: "mcp-secret-value",
		});
		expect("error" in created).toBe(false);
		expect(JSON.stringify(created)).not.toContain("mcp-secret-value");

		const listed = await toolListWebhooks(env);
		expect(JSON.stringify(listed)).not.toContain("mcp-secret-value");

		const id = (created as { id: string }).id;
		const deleted = await toolDeleteWebhook(env, id);
		expect("error" in deleted).toBe(false);
	});

	it("ingest still succeeds when webhook fetch throws", async () => {
		const created = await createWebhook(db, {
			event: "email.received",
			url: "https://bots.example/mail",
			secret: "hook-secret",
			mailbox_id: "inbox@example.com",
		});
		expect(created.ok).toBe(true);

		globalThis.fetch = vi.fn(async () => {
			throw new Error("webhook down");
		}) as typeof fetch;

		const createEmail = vi.fn(async () => {});
		const waitUntilPromises: Promise<unknown>[] = [];
		const env = testEnv({
			MAILBOX: {
				idFromName: (name: string) => name,
				get: () => ({
					createEmail,
					findThreadBySubject: async () => null,
				}),
			},
		});

		await expect(
			receiveEmail(
				rawEmailStream(
					[
						"From: sender@example.com",
						"To: inbox@example.com",
						"Subject: Hello",
						"",
						"Body",
					].join("\r\n"),
				),
				env as never,
				{
					waitUntil(promise: Promise<unknown>) {
						waitUntilPromises.push(promise);
					},
				} as ExecutionContext,
			),
		).resolves.toBeUndefined();

		expect(createEmail).toHaveBeenCalledTimes(1);
		await Promise.all(waitUntilPromises);
		expect(globalThis.fetch).toHaveBeenCalled();
	});

	it("does not POST when a mailbox filter misses", async () => {
		await createWebhook(db, {
			event: "email.received",
			url: "https://bots.example/mail",
			secret: "hook-secret",
			mailbox_id: "other@example.com",
		});
		const fetchMock = vi.fn(async () => new Response("ok"));
		globalThis.fetch = fetchMock as typeof fetch;

		await dispatchWebhooks(db, {
			event: "email.received",
			mailboxId: "inbox@example.com",
			payload: {
				event: "email.received",
				email_id: "e1",
				mailbox_id: "inbox@example.com",
				mailbox_address: "inbox@example.com",
				from: "sender@example.com",
				to: "inbox@example.com",
				subject: "Hello",
				thread_id: "e1",
				received_at: new Date().toISOString(),
			},
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("POSTs JSON with a Bearer secret", async () => {
		await createWebhook(db, {
			event: "task.created",
			url: "https://bots.example/tasks",
			secret: "hook-secret",
			assignee: "Ponder",
		});
		const fetchMock = vi.fn(async () => new Response("ok"));
		globalThis.fetch = fetchMock as typeof fetch;

		await dispatchWebhooks(db, {
			event: "task.created",
			assignee: "Ponder",
			payload: {
				event: "task.created",
				task_id: "t1",
				title: "Triage",
				assignee_name: "Ponder",
				status: "pending",
				created_by: "Adam",
			},
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("https://bots.example/tasks");
		expect(init.method).toBe("POST");
		expect((init.headers as Record<string, string>).Authorization).toBe(
			"Bearer hook-secret",
		);
		expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
			"application/json",
		);
		expect(JSON.parse(init.body as string)).toEqual({
			event: "task.created",
			task_id: "t1",
			title: "Triage",
			assignee_name: "Ponder",
			status: "pending",
			created_by: "Adam",
		});
	});

	it("dispatch swallows a throwing fetch", async () => {
		await createWebhook(db, {
			event: "task.created",
			url: "https://bots.example/tasks",
			secret: "hook-secret",
		});
		globalThis.fetch = vi.fn(async () => {
			throw new Error("webhook down");
		}) as typeof fetch;

		await expect(
			dispatchWebhooks(db, {
				event: "task.created",
				assignee: "Donna",
				payload: {
					event: "task.created",
					task_id: "t1",
					title: "Triage",
					assignee_name: "Donna",
					status: "pending",
					created_by: "Adam",
				},
			}),
		).resolves.toBeUndefined();
	});
});
