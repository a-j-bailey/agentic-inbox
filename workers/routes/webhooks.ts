// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Hono } from "hono";
import { z } from "zod";
import { WEBHOOK_EVENTS } from "../../shared/webhooks";
import type { Env } from "../types";
import {
	createWebhook,
	deleteWebhook,
	listWebhooks,
	updateWebhook,
} from "../lib/webhooks";

const CreateWebhookBody = z.object({
	event: z.enum(WEBHOOK_EVENTS),
	url: z.string().min(1),
	secret: z.string().min(1),
	mailbox_id: z.string().nullable().optional(),
	assignee: z.string().nullable().optional(),
});

const UpdateWebhookBody = z.object({
	enabled: z.boolean().optional(),
	url: z.string().min(1).optional(),
	secret: z.string().min(1).optional(),
	mailbox_id: z.string().nullable().optional(),
	assignee: z.string().nullable().optional(),
});

function zodErrorMessage(error: z.ZodError): string {
	return error.issues[0]?.message ?? "Invalid request";
}

export const webhookRoutes = new Hono<{ Bindings: Env }>();

webhookRoutes.get("/api/v1/webhooks", async (c) => {
	const webhooks = await listWebhooks(c.env.DB);
	return c.json({ webhooks });
});

webhookRoutes.post("/api/v1/webhooks", async (c) => {
	let body: z.infer<typeof CreateWebhookBody>;
	try {
		body = CreateWebhookBody.parse(await c.req.json());
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json({ error: zodErrorMessage(error) }, 400);
		}
		throw error;
	}
	const result = await createWebhook(c.env.DB, body);
	if (!result.ok) return c.json({ error: result.error }, result.status);
	return c.json(result.value, 201);
});

webhookRoutes.patch("/api/v1/webhooks/:id", async (c) => {
	let body: z.infer<typeof UpdateWebhookBody>;
	try {
		body = UpdateWebhookBody.parse(await c.req.json());
	} catch (error) {
		if (error instanceof z.ZodError) {
			return c.json({ error: zodErrorMessage(error) }, 400);
		}
		throw error;
	}
	const result = await updateWebhook(c.env.DB, c.req.param("id"), body);
	if (!result.ok) return c.json({ error: result.error }, result.status);
	return c.json(result.value);
});

webhookRoutes.delete("/api/v1/webhooks/:id", async (c) => {
	const result = await deleteWebhook(c.env.DB, c.req.param("id"));
	if (!result.ok) return c.json({ error: result.error }, result.status);
	return c.body(null, 204);
});
