// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Hono } from "hono";
import { z } from "zod";
import { isTaskStatus } from "../../shared/tasks";
import type { Env } from "../types";
import {
	createAgent,
	createTask,
	getTask,
	listAgents,
	listTasks,
	softDeleteTask,
	updateTask,
} from "../lib/tasks";

const CreateTaskBody = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	assignee_name: z.string().optional(),
	actor_name: z.string().min(1),
	mailbox_id: z.string().nullable().optional(),
	email_id: z.string().nullable().optional(),
});

const UpdateTaskBody = z.object({
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	status: z.enum(["pending", "blocked", "in_progress", "done"]).optional(),
	assignee_name: z.string().optional(),
	blocked_reason: z.string().nullable().optional(),
	actor_name: z.string().min(1),
});

const CreateAgentBody = z.object({
	name: z.string().min(1),
	id: z.string().min(1).optional(),
});

const DeleteTaskBody = z.object({
	actor_name: z.string().min(1),
});

function boolQuery(value: string | undefined): boolean | undefined {
	if (value === undefined || value === "") return undefined;
	return value === "true" || value === "1";
}

function zodErrorMessage(error: z.ZodError): string {
	return error.issues[0]?.message ?? "Invalid request";
}

function waitUntilFromContext(c: {
	executionCtx: { waitUntil: (promise: Promise<unknown>) => void };
}): ((promise: Promise<unknown>) => void) | undefined {
	try {
		const ctx = c.executionCtx;
		return (promise: Promise<unknown>) => {
			ctx.waitUntil(promise);
		};
	} catch {
		return undefined;
	}
}

export const taskRoutes = new Hono<{ Bindings: Env }>();

taskRoutes.get("/api/v1/tasks", async (c) => {
	const statusRaw = c.req.query("status");
	if (statusRaw && !isTaskStatus(statusRaw)) {
		return c.json({ error: "Invalid status" }, 400);
	}
	const tasks = await listTasks(c.env.DB, {
		status: statusRaw && isTaskStatus(statusRaw) ? statusRaw : undefined,
		assignee: c.req.query("assignee") || undefined,
		include_done_old: boolQuery(c.req.query("include_done_old")) === true,
	});
	return c.json({ tasks });
});

taskRoutes.get("/api/v1/tasks/:id", async (c) => {
	const result = await getTask(c.env.DB, c.req.param("id"));
	if (!result.ok) return c.json({ error: result.error }, result.status);
	return c.json(result.value);
});

taskRoutes.post("/api/v1/tasks", async (c) => {
	let body: z.infer<typeof CreateTaskBody>;
	try {
		body = CreateTaskBody.parse(await c.req.json());
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json({ error: zodErrorMessage(error) }, 400);
		}
		throw error;
	}
	const result = await createTask(c.env.DB, body, {
		env: c.env,
		waitUntil: waitUntilFromContext(c),
	});
	if (!result.ok) return c.json({ error: result.error }, result.status);
	return c.json(result.value, 201);
});

taskRoutes.patch("/api/v1/tasks/:id", async (c) => {
	let body: z.infer<typeof UpdateTaskBody>;
	try {
		body = UpdateTaskBody.parse(await c.req.json());
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json({ error: zodErrorMessage(error) }, 400);
		}
		throw error;
	}
	const result = await updateTask(c.env.DB, c.req.param("id"), body);
	if (!result.ok) return c.json({ error: result.error }, result.status);
	return c.json(result.value);
});

taskRoutes.delete("/api/v1/tasks/:id", async (c) => {
	let actor_name = c.req.query("actor_name") ?? "";
	if (!actor_name) {
		try {
			const body = DeleteTaskBody.parse(await c.req.json());
			actor_name = body.actor_name;
		} catch (error) {
			if (error instanceof z.ZodError) {
				return c.json({ error: zodErrorMessage(error) }, 400);
			}
			return c.json({ error: "actor_name is required" }, 400);
		}
	}
	const result = await softDeleteTask(c.env.DB, c.req.param("id"), actor_name);
	if (!result.ok) return c.json({ error: result.error }, result.status);
	return c.body(null, 204);
});

taskRoutes.get("/api/v1/agents", async (c) => {
	const agents = await listAgents(c.env.DB);
	return c.json({ agents });
});

taskRoutes.post("/api/v1/agents", async (c) => {
	let body: z.infer<typeof CreateAgentBody>;
	try {
		body = CreateAgentBody.parse(await c.req.json());
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json({ error: zodErrorMessage(error) }, 400);
		}
		throw error;
	}
	const result = await createAgent(c.env.DB, body);
	if (!result.ok) return c.json({ error: result.error }, result.status);
	return c.json(result.value, 201);
});
