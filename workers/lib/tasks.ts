// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	DONNA_ID,
	DONNA_NAME,
	DONE_HIDE_AFTER_MS,
	assertNever,
	isTaskStatus,
	type Agent,
	type Task,
	type TaskStatus,
} from "../../shared/tasks";

export type TaskResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: string; status: 400 | 404 | 409 };

export type TaskWebhookEnv = {
	TASK_WEBHOOK_URL?: string;
	TASK_WEBHOOK_SECRET?: string;
};

export type CreateTaskInput = {
	title: string;
	description?: string;
	assignee_name?: string;
	actor_name: string;
	mailbox_id?: string | null;
	email_id?: string | null;
};

export type UpdateTaskInput = {
	title?: string;
	description?: string;
	status?: TaskStatus;
	assignee_name?: string;
	blocked_reason?: string | null;
	actor_name: string;
};

export type ListTasksFilters = {
	status?: TaskStatus;
	assignee?: string;
	include_done_old?: boolean;
};

type TaskRow = Record<string, unknown>;

export function slugify(text: string): string {
	return text
		.toString()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^\w-]+/g, "")
		.replace(/--+/g, "-")
		.replace(/^-+/, "")
		.replace(/-+$/, "");
}

function asString(value: unknown): string {
	return typeof value === "string" ? value : String(value ?? "");
}

function asNullableString(value: unknown): string | null {
	if (value == null) return null;
	return asString(value);
}

function mapTask(row: TaskRow): Task {
	const status = asString(row.status);
	if (!isTaskStatus(status)) {
		throw new Error(`Invalid task status in database: ${status}`);
	}
	return {
		id: asString(row.id),
		title: asString(row.title),
		description: asString(row.description ?? ""),
		status,
		assignee_name: asString(row.assignee_name),
		assignee_id: asNullableString(row.assignee_id),
		created_by: asString(row.created_by),
		updated_by: asString(row.updated_by),
		blocked_reason: asNullableString(row.blocked_reason),
		mailbox_id: asNullableString(row.mailbox_id),
		email_id: asNullableString(row.email_id),
		created_at: asString(row.created_at),
		updated_at: asString(row.updated_at),
		started_at: asNullableString(row.started_at),
		completed_at: asNullableString(row.completed_at),
		blocked_at: asNullableString(row.blocked_at),
		deleted_at: asNullableString(row.deleted_at),
	};
}

function mapAgent(row: TaskRow): Agent {
	return {
		id: asString(row.id),
		name: asString(row.name),
	};
}

function fail<T>(error: string, status: 400 | 404 | 409): TaskResult<T> {
	return { ok: false, error, status };
}

function ok<T>(value: T): TaskResult<T> {
	return { ok: true, value };
}

async function resolveAssignee(
	db: D1Database,
	name: string,
): Promise<{ assignee_name: string; assignee_id: string | null }> {
	const existing = await db
		.prepare("SELECT id, name FROM agents WHERE name = ?")
		.bind(name)
		.first<TaskRow>();
	if (existing) {
		return {
			assignee_name: asString(existing.name),
			assignee_id: asString(existing.id),
		};
	}
	const slug = slugify(name) || crypto.randomUUID();
	await db
		.prepare("INSERT INTO agents (id, name) VALUES (?, ?)")
		.bind(slug, name)
		.run();
	return { assignee_name: name, assignee_id: null };
}

function applyStatusChange(
	current: Task,
	nextStatus: TaskStatus,
	blockedReason: string | null | undefined,
	now: string,
): TaskResult<Pick<Task, "started_at" | "completed_at" | "blocked_at" | "blocked_reason">> {
	let started_at = current.started_at;
	let completed_at = current.completed_at;
	let blocked_at = current.blocked_at;
	let blocked_reason = current.blocked_reason;

	switch (nextStatus) {
		case "pending":
			completed_at = null;
			blocked_reason = null;
			break;
		case "blocked": {
			const reason = (blockedReason ?? "").trim();
			if (!reason) {
				return fail("blocked_reason is required when status is blocked", 400);
			}
			blocked_reason = reason;
			if (current.status !== "blocked") blocked_at = now;
			completed_at = null;
			break;
		}
		case "in_progress":
			if (!started_at) started_at = now;
			completed_at = null;
			blocked_reason = null;
			break;
		case "done":
			if (!started_at) started_at = now;
			if (current.status !== "done") completed_at = now;
			blocked_reason = null;
			break;
		default:
			return assertNever(nextStatus);
	}

	return ok({ started_at, completed_at, blocked_at, blocked_reason });
}

export async function getTask(
	db: D1Database,
	id: string,
): Promise<TaskResult<Task>> {
	const row = await db
		.prepare("SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL")
		.bind(id)
		.first<TaskRow>();
	if (!row) return fail("Task not found", 404);
	return ok(mapTask(row));
}

export async function listTasks(
	db: D1Database,
	filters: ListTasksFilters = {},
): Promise<Task[]> {
	const clauses = ["deleted_at IS NULL"];
	const binds: unknown[] = [];

	if (filters.status) {
		clauses.push("status = ?");
		binds.push(filters.status);
	}
	if (filters.assignee) {
		clauses.push("assignee_name = ?");
		binds.push(filters.assignee);
	}
	if (!filters.include_done_old) {
		const cutoff = new Date(Date.now() - DONE_HIDE_AFTER_MS).toISOString();
		clauses.push(
			"(status != 'done' OR completed_at IS NULL OR completed_at >= ?)",
		);
		binds.push(cutoff);
	}

	const sql = `SELECT * FROM tasks WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC`;
	const stmt = db.prepare(sql);
	const { results } = binds.length > 0 ? await stmt.bind(...binds).all<TaskRow>() : await stmt.all<TaskRow>();
	return (results ?? []).map(mapTask);
}

export async function createTask(
	db: D1Database,
	input: CreateTaskInput,
	webhook?: {
		env: TaskWebhookEnv;
		waitUntil?: (promise: Promise<unknown>) => void;
	},
): Promise<TaskResult<Task>> {
	const title = input.title.trim();
	if (!title) return fail("title is required", 400);
	const actor_name = input.actor_name.trim();
	if (!actor_name) return fail("actor_name is required", 400);

	const rawAssignee = input.assignee_name?.trim() ?? "";
	const defaultedToDonna = rawAssignee.length === 0;
	const assigneeName = defaultedToDonna ? DONNA_NAME : rawAssignee;
	const assignee = defaultedToDonna
		? { assignee_name: DONNA_NAME, assignee_id: DONNA_ID }
		: await resolveAssignee(db, assigneeName);

	const now = new Date().toISOString();
	const id = crypto.randomUUID();
	const description = input.description?.trim() ?? "";

	await db
		.prepare(
			`INSERT INTO tasks (
				id, title, description, status, assignee_name, assignee_id,
				created_by, updated_by, blocked_reason, mailbox_id, email_id,
				created_at, updated_at, started_at, completed_at, blocked_at, deleted_at
			) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, NULL, NULL, NULL)`,
		)
		.bind(
			id,
			title,
			description,
			assignee.assignee_name,
			assignee.assignee_id,
			actor_name,
			actor_name,
			input.mailbox_id ?? null,
			input.email_id ?? null,
			now,
			now,
		)
		.run();

	const created = await getTask(db, id);
	if (!created.ok) return created;

	if (defaultedToDonna) {
		const notify = notifyDonnaWebhook(webhook?.env, created.value);
		if (webhook?.waitUntil) {
			webhook.waitUntil(notify);
		} else {
			void notify;
		}
	}

	return created;
}

export async function updateTask(
	db: D1Database,
	id: string,
	input: UpdateTaskInput,
): Promise<TaskResult<Task>> {
	const actor_name = input.actor_name.trim();
	if (!actor_name) return fail("actor_name is required", 400);

	const current = await getTask(db, id);
	if (!current.ok) return current;
	const task = current.value;

	const title = input.title !== undefined ? input.title.trim() : task.title;
	if (!title) return fail("title is required", 400);
	const description =
		input.description !== undefined ? input.description.trim() : task.description;

	let assignee_name = task.assignee_name;
	let assignee_id = task.assignee_id;
	if (input.assignee_name !== undefined) {
		const nextName = input.assignee_name.trim();
		if (!nextName) {
			assignee_name = DONNA_NAME;
			assignee_id = DONNA_ID;
		} else {
			const resolved = await resolveAssignee(db, nextName);
			assignee_name = resolved.assignee_name;
			assignee_id = resolved.assignee_id;
		}
	}

	const nextStatus = input.status ?? task.status;
	if (!isTaskStatus(nextStatus)) {
		return fail("Invalid status", 400);
	}

	const now = new Date().toISOString();
	const reasonForBlocked =
		input.blocked_reason !== undefined
			? input.blocked_reason
			: nextStatus === "blocked"
				? task.blocked_reason
				: null;
	const stamps = applyStatusChange(task, nextStatus, reasonForBlocked, now);
	if (!stamps.ok) return stamps;
	const blocked_reason = stamps.value.blocked_reason;

	await db
		.prepare(
			`UPDATE tasks SET
				title = ?, description = ?, status = ?, assignee_name = ?, assignee_id = ?,
				updated_by = ?, blocked_reason = ?, updated_at = ?,
				started_at = ?, completed_at = ?, blocked_at = ?
			WHERE id = ? AND deleted_at IS NULL`,
		)
		.bind(
			title,
			description,
			nextStatus,
			assignee_name,
			assignee_id,
			actor_name,
			blocked_reason,
			now,
			stamps.value.started_at,
			stamps.value.completed_at,
			stamps.value.blocked_at,
			id,
		)
		.run();

	return getTask(db, id);
}

export async function softDeleteTask(
	db: D1Database,
	id: string,
	actor_name: string,
): Promise<TaskResult<{ id: string }>> {
	const actor = actor_name.trim();
	if (!actor) return fail("actor_name is required", 400);
	const current = await getTask(db, id);
	if (!current.ok) return current;
	const now = new Date().toISOString();
	await db
		.prepare(
			"UPDATE tasks SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL",
		)
		.bind(now, now, actor, id)
		.run();
	return ok({ id });
}

export async function listAgents(db: D1Database): Promise<Agent[]> {
	const { results } = await db
		.prepare("SELECT id, name FROM agents ORDER BY name COLLATE NOCASE")
		.all<TaskRow>();
	return (results ?? []).map(mapAgent);
}

export async function createAgent(
	db: D1Database,
	input: { name: string; id?: string },
): Promise<TaskResult<Agent>> {
	const name = input.name.trim();
	if (!name) return fail("name is required", 400);
	const existing = await db
		.prepare("SELECT id, name FROM agents WHERE name = ?")
		.bind(name)
		.first<TaskRow>();
	if (existing) return fail("Agent already exists", 409);
	const id = input.id?.trim() || slugify(name) || crypto.randomUUID();
	try {
		await db.prepare("INSERT INTO agents (id, name) VALUES (?, ?)").bind(id, name).run();
	} catch {
		return fail("Agent already exists", 409);
	}
	return ok({ id, name });
}

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
	return [...new Uint8Array(sig)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export async function notifyDonnaWebhook(
	env: TaskWebhookEnv | undefined,
	task: Task,
): Promise<void> {
	const url = env?.TASK_WEBHOOK_URL?.trim();
	if (!url) return;
	const body = JSON.stringify({
		event: "task.created",
		reason: "default_assignee",
		task,
	});
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	const secret = env?.TASK_WEBHOOK_SECRET?.trim();
	if (secret) {
		headers["X-Webhook-Signature"] = `sha256=${await hmacSha256Hex(secret, body)}`;
	}
	try {
		const res = await fetch(url, {
			method: "POST",
			headers,
			body,
			signal: AbortSignal.timeout(5_000),
		});
		if (!res.ok) {
			console.error("TASK_WEBHOOK_URL responded", res.status);
		}
	} catch (error) {
		console.error("TASK_WEBHOOK_URL failed:", (error as Error).message);
	}
}
