// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DONNA_ID, DONNA_NAME, DONE_HIDE_AFTER_MS } from "../../shared/tasks";
import { app } from "../index";
import {
	toolCreateTask,
	toolGetTask,
	toolListAgents,
	toolListTasks,
	toolUpdateTask,
} from "./tools";

const migrationSql = readFileSync(
	join(dirname(fileURLToPath(import.meta.url)), "../../migrations/0001_tasks.sql"),
	"utf8",
);

let mf: Miniflare;
let db: D1Database;

function testEnv() {
	return {
		DB: db,
		DOMAINS: "example.com",
		EMAIL_ADDRESSES: [],
		BUCKET: {
			async head() {
				return null;
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
			get: () => ({ getFolders: async () => [] }),
		},
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

describe("tasks API and MCP", () => {
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
		await db.exec("DROP TABLE IF EXISTS tasks");
		await db.exec("DROP TABLE IF EXISTS agents");
		const statements = migrationSql
			.split(";")
			.map((statement) => statement.trim())
			.filter((statement) => statement.length > 0);
		for (const statement of statements) {
			await db.prepare(statement).run();
		}
	});

	it("creates a task with empty assignee as Donna", async () => {
		const { status, body } = await jsonRequest("/api/v1/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Triage inbound", actor_name: "Adam" }),
		});
		expect(status).toBe(201);
		const task = body as { assignee_name: string; assignee_id: string; created_by: string };
		expect(task.assignee_name).toBe(DONNA_NAME);
		expect(task.assignee_id).toBe(DONNA_ID);
		expect(task.created_by).toBe("Adam");
	});

	it("rejects blocked without blocked_reason", async () => {
		const created = await jsonRequest("/api/v1/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Needs reason", actor_name: "Adam" }),
		});
		const id = (created.body as { id: string }).id;
		const { status, body } = await jsonRequest(`/api/v1/tasks/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "blocked", actor_name: "Adam" }),
		});
		expect(status).toBe(400);
		expect((body as { error: string }).error).toMatch(/blocked_reason/);
	});

	it("sets status timestamps and keeps started_at after blocked", async () => {
		const created = await jsonRequest("/api/v1/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Stamp me", actor_name: "Adam" }),
		});
		const id = (created.body as { id: string }).id;

		const inProgress = await jsonRequest(`/api/v1/tasks/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "in_progress", actor_name: "Ponder" }),
		});
		const started = inProgress.body as {
			started_at: string | null;
			completed_at: string | null;
			updated_by: string;
		};
		expect(inProgress.status).toBe(200);
		expect(started.started_at).toBeTruthy();
		expect(started.completed_at).toBeNull();
		expect(started.updated_by).toBe("Ponder");
		const startedAt = started.started_at;

		const blocked = await jsonRequest(`/api/v1/tasks/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				status: "blocked",
				blocked_reason: "waiting on DNS",
				actor_name: "Ponder",
			}),
		});
		const blockedBody = blocked.body as {
			started_at: string | null;
			blocked_at: string | null;
			blocked_reason: string | null;
			completed_at: string | null;
		};
		expect(blocked.status).toBe(200);
		expect(blockedBody.started_at).toBe(startedAt);
		expect(blockedBody.blocked_at).toBeTruthy();
		expect(blockedBody.blocked_reason).toBe("waiting on DNS");
		expect(blockedBody.completed_at).toBeNull();

		const done = await jsonRequest(`/api/v1/tasks/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "done", actor_name: "Ponder" }),
		});
		const doneBody = done.body as {
			completed_at: string | null;
			blocked_reason: string | null;
			started_at: string | null;
		};
		expect(done.status).toBe(200);
		expect(doneBody.completed_at).toBeTruthy();
		expect(doneBody.blocked_reason).toBeNull();
		expect(doneBody.started_at).toBe(startedAt);

		const back = await jsonRequest(`/api/v1/tasks/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ status: "pending", actor_name: "Ponder" }),
		});
		expect((back.body as { completed_at: string | null }).completed_at).toBeNull();
	});

	it("hides soft-deleted tasks from the list", async () => {
		const created = await jsonRequest("/api/v1/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Delete me", actor_name: "Adam" }),
		});
		const id = (created.body as { id: string }).id;
		const del = await jsonRequest(`/api/v1/tasks/${id}`, {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ actor_name: "Adam" }),
		});
		expect(del.status).toBe(204);

		const listed = await jsonRequest("/api/v1/tasks");
		expect(listed.status).toBe(200);
		expect((listed.body as { tasks: Array<{ id: string }> }).tasks).toEqual([]);

		const get = await jsonRequest(`/api/v1/tasks/${id}`);
		expect(get.status).toBe(404);
	});

	it("hides done tasks older than 7 days unless include_done_old", async () => {
		const created = await jsonRequest("/api/v1/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "Old done", actor_name: "Adam" }),
		});
		const id = (created.body as { id: string }).id;
		const old = new Date(Date.now() - DONE_HIDE_AFTER_MS - 60_000).toISOString();
		await db
			.prepare(
				"UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?",
			)
			.bind(old, old, id)
			.run();

		const hidden = await jsonRequest("/api/v1/tasks");
		expect((hidden.body as { tasks: unknown[] }).tasks).toHaveLength(0);

		const shown = await jsonRequest("/api/v1/tasks?include_done_old=true");
		expect((shown.body as { tasks: Array<{ id: string }> }).tasks[0]?.id).toBe(id);
	});

	it("upserts unknown assignees with a slug and null assignee_id", async () => {
		const { status, body } = await jsonRequest("/api/v1/tasks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "New bot work",
				assignee_name: "Fresh Bot",
				actor_name: "Adam",
			}),
		});
		expect(status).toBe(201);
		const task = body as { assignee_name: string; assignee_id: string | null };
		expect(task.assignee_name).toBe("Fresh Bot");
		expect(task.assignee_id).toBeNull();
		const agents = await jsonRequest("/api/v1/agents");
		const names = (agents.body as { agents: Array<{ id: string; name: string }> }).agents.map(
			(agent) => agent.name,
		);
		expect(names).toContain("Fresh Bot");
	});

	it("MCP task tools do not require mailboxId", async () => {
		const env = testEnv();
		const created = await toolCreateTask(env, {
			title: "From MCP",
			actor_name: "Ponder",
		});
		expect("error" in created).toBe(false);
		const task = created as { id: string; assignee_name: string };
		expect(task.assignee_name).toBe(DONNA_NAME);

		const listed = await toolListTasks(env);
		expect("error" in listed).toBe(false);
		expect((listed as { tasks: Array<{ id: string }> }).tasks[0]?.id).toBe(task.id);

		const got = await toolGetTask(env, task.id);
		expect("error" in got).toBe(false);

		const updated = await toolUpdateTask(env, {
			taskId: task.id,
			status: "in_progress",
			actor_name: "Ponder",
		});
		expect((updated as { status: string }).status).toBe("in_progress");

		const agents = await toolListAgents(env);
		expect(agents.agents.some((agent) => agent.name === DONNA_NAME)).toBe(true);
	});
});
